from pathlib import Path
import gc
import io
import os
import re
import threading
import unicodedata
import pickle

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from catboost import CatBoostClassifier
from werkzeug.exceptions import RequestEntityTooLarge

from Apriori.apriori_core import load_rules_csv


BASE_DIR = Path(__file__).resolve().parent

PHOBERT_DIR = BASE_DIR / "phobert_tennis_saved"
CATBOOST_PATH = BASE_DIR / "catboost_tennis.cbm"
ENCODER_PATH = BASE_DIR / "tennis_label_encoder.pkl"
APRIORI_DIR = BASE_DIR / "Apriori"
APRIORI_RULES_PATH = APRIORI_DIR / "apriori_rules.csv"
APRIORI_ABSA_MODEL_DIR = APRIORI_DIR / "phobert_absa_model"
FREE_DEMO_MODE = os.getenv("FREE_DEMO_MODE", "false").lower() in {"1", "true", "yes"}
MAX_APRIORI_ROWS = int(os.getenv("MAX_APRIORI_ROWS", "50"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(2 * 1024 * 1024)))

if not FREE_DEMO_MODE:
    from Apriori.clean_dual import analyze_upload_via_phobert_apriori, unload_phobert_absa_model
else:
    def unload_phobert_absa_model() -> bool:
        return False


def has_huggingface_weights(model_dir: Path) -> bool:
    """Check that a locally stored Transformers model has loadable weights."""
    return (model_dir / "model.safetensors").is_file() or (model_dir / "pytorch_model.bin").is_file()


ASPECT_MAPPING = {
    "Outlook": "thời tiết",
    "Temperature": "nhiệt độ",
    "Humidity": "độ ẩm",
    "Wind": "gió",
}

VALID_FEATURES = {
    "Outlook": {"None", "Sunny", "Overcast", "Rain"},
    "Temperature": {"None", "Hot", "Mild", "Cool"},
    "Humidity": {"None", "High", "Normal"},
    "Wind": {"None", "Weak", "Strong"},
}

EMPTY_FEATURES = {
    "Outlook": "None",
    "Temperature": "None",
    "Humidity": "None",
    "Wind": "None",
}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
CORS(app)

catboost_model = None
phobert_bundle = None
model_runtime_lock = threading.RLock()


@app.errorhandler(RequestEntityTooLarge)
def request_too_large(_error):
    return jsonify({
        "error": f"CSV exceeds the {MAX_UPLOAD_BYTES // 1024 // 1024} MB upload limit.",
    }), 413


def preprocess_text(text: str) -> str:
    if text is None:
        return ""

    text = unicodedata.normalize("NFC", str(text)).lower().strip()
    text = re.sub(r"[^0-9a-zA-ZÀ-ỹ\s.,;:?]", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"(.)\1{2,}", r"\1", text)

    try:
        from underthesea import word_tokenize
        return word_tokenize(text.strip(), format="text")
    except Exception:
        return text.strip()


def load_catboost_model():
    global catboost_model

    if catboost_model is not None:
        return catboost_model

    if not CATBOOST_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy CatBoost model: {CATBOOST_PATH}")

    model = CatBoostClassifier()
    model.load_model(str(CATBOOST_PATH))

    catboost_model = model
    return catboost_model


def load_phobert_bundle():
    global phobert_bundle

    if FREE_DEMO_MODE:
        raise RuntimeError("PhoBERT is disabled in FREE_DEMO_MODE.")

    if phobert_bundle is not None:
        return phobert_bundle

    if not PHOBERT_DIR.exists():
        raise FileNotFoundError(f"Không tìm thấy thư mục PhoBERT: {PHOBERT_DIR}")

    if not ENCODER_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy label encoder: {ENCODER_PATH}")

    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tokenizer = AutoTokenizer.from_pretrained(str(PHOBERT_DIR))
    phobert_model = AutoModelForSequenceClassification.from_pretrained(
        str(PHOBERT_DIR),
        low_cpu_mem_usage=True,
    )
    phobert_model.to(device)
    phobert_model.eval()

    with open(ENCODER_PATH, "rb") as file:
        label_encoder = pickle.load(file)

    phobert_bundle = {
        "device": device,
        "tokenizer": tokenizer,
        "phobert": phobert_model,
        "encoder": label_encoder,
    }

    return phobert_bundle


def unload_phobert_bundle() -> bool:
    """Release the Tennis PhoBERT bundle before activating the ABSA model."""
    global phobert_bundle
    if phobert_bundle is None:
        return False

    bundle = phobert_bundle
    phobert_bundle = None
    del bundle
    gc.collect()
    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return True


def extract_aspects(segmented_text: str) -> dict:
    import torch

    bundle = load_phobert_bundle()

    tokenizer = bundle["tokenizer"]
    phobert = bundle["phobert"]
    encoder = bundle["encoder"]
    device = bundle["device"]

    extracted = {}

    for aspect_en, aspect_vi in ASPECT_MAPPING.items():
        encoding = tokenizer(
            segmented_text,
            aspect_vi,
            add_special_tokens=True,
            max_length=64,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        with torch.no_grad():
            outputs = phobert(
                input_ids=encoding["input_ids"].to(device),
                attention_mask=encoding["attention_mask"].to(device),
            )
            pred_idx = torch.argmax(outputs.logits, dim=1).cpu().numpy()[0]

        pred_label = encoder.inverse_transform([pred_idx])[0]
        extracted[aspect_en] = str(pred_label)

    return extracted


def normalize_manual_features(raw_features: dict) -> dict:
    features = EMPTY_FEATURES.copy()

    if not isinstance(raw_features, dict):
        return features

    for key in EMPTY_FEATURES:
        value = str(raw_features.get(key, "None")).strip()
        if value in VALID_FEATURES[key]:
            features[key] = value
        else:
            features[key] = "None"

    return features


def read_uploaded_csv(file_storage) -> pd.DataFrame:
    raw = file_storage.read()
    if not raw:
        raise ValueError("File CSV rỗng.")

    errors = []
    for encoding in ("utf-8-sig", "utf-8", "cp1258", "latin1"):
        try:
            dataframe = pd.read_csv(io.BytesIO(raw), encoding=encoding)
            if len(dataframe) > MAX_APRIORI_ROWS:
                raise ValueError(
                    f"CSV exceeds the {MAX_APRIORI_ROWS}-row limit for the memory-optimized deployment."
                )
            return dataframe
        except UnicodeDecodeError as exc:
            errors.append(f"{encoding}: {exc}")
        except pd.errors.ParserError as exc:
            errors.append(f"{encoding}: {exc}")

    raise ValueError("Không đọc được CSV. Kiểm tra delimiter, encoding hoặc cấu trúc cột.")


def predict_decision(features: dict) -> dict:
    model = load_catboost_model()

    df_input = pd.DataFrame(
        [features],
        columns=["Outlook", "Temperature", "Humidity", "Wind"],
    )

    prediction = model.predict(df_input)[0]

    if isinstance(prediction, np.ndarray):
        prediction = prediction[0]

    probabilities = model.predict_proba(df_input)[0]
    classes = model.classes_

    prob_dict = {
        str(classes[index]): float(probabilities[index] * 100)
        for index in range(len(classes))
    }

    return {
        "decision": str(prediction),
        "probability_yes": prob_dict.get("Yes", 0.0),
        "probability_no": prob_dict.get("No", 0.0),
    }


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "free_demo_mode": FREE_DEMO_MODE,
        "catboost_exists": CATBOOST_PATH.exists(),
        "phobert_dir_exists": PHOBERT_DIR.exists(),
        "phobert_weights_exists": has_huggingface_weights(PHOBERT_DIR),
        "encoder_exists": ENCODER_PATH.exists(),
        "apriori_dir_exists": APRIORI_DIR.exists(),
        "apriori_rules_exists": APRIORI_RULES_PATH.exists(),
        "apriori_absa_model_dir_exists": APRIORI_ABSA_MODEL_DIR.exists(),
        "apriori_absa_weights_exists": has_huggingface_weights(APRIORI_ABSA_MODEL_DIR),
    })


@app.post("/api/predict")
def api_predict():
    try:
        payload = request.get_json(force=True) or {}

        text = str(payload.get("text", "")).strip()
        manual_features = normalize_manual_features(payload.get("features", {}))

        final_features = EMPTY_FEATURES.copy()
        source = "none"

        if text:
            if FREE_DEMO_MODE:
                return jsonify({
                    "error": "PhoBERT text analysis is unavailable in the free demo. Use manual feature selectors.",
                }), 503
            with model_runtime_lock:
                unload_phobert_absa_model()
                segmented_text = preprocess_text(text)
                final_features = extract_aspects(segmented_text)
            source = "phobert"

        for key, value in manual_features.items():
            if value != "None":
                final_features[key] = value
                source = "phobert + manual override" if text else "manual combobox"

        if all(value == "None" for value in final_features.values()):
            return jsonify({
                "decision": "None",
                "probability_yes": 0,
                "probability_no": 0,
                "features": final_features,
                "source": source,
            })

        result = predict_decision(final_features)

        return jsonify({
            **result,
            "features": final_features,
            "source": source,
        })

    except Exception as exc:
        return jsonify({
            "error": str(exc),
        }), 500


@app.get("/api/apriori/sample")
def api_apriori_sample():
    try:
        if not APRIORI_RULES_PATH.exists():
            return jsonify({
                "error": f"Không tìm thấy file luật mẫu: {APRIORI_RULES_PATH}",
            }), 404

        return jsonify(load_rules_csv(str(APRIORI_RULES_PATH)))

    except Exception as exc:
        return jsonify({
            "error": str(exc),
        }), 500


@app.post("/api/apriori/analyze")
def api_apriori_analyze():
    try:
        if FREE_DEMO_MODE:
            return jsonify({
                "error": "Apriori and PhoBERT ABSA are unavailable in the free demo.",
            }), 503

        uploaded_file = request.files.get("file")
        if uploaded_file is None:
            return jsonify({
                "error": "Vui lòng chọn file CSV để phân tích Apriori.",
            }), 400

        min_support = float(request.form.get("min_support", 0.05))
        min_confidence = float(request.form.get("min_confidence", 0.6))

        df = read_uploaded_csv(uploaded_file)
        with model_runtime_lock:
            unload_phobert_bundle()
            result = analyze_upload_via_phobert_apriori(
                df,
                min_support=min_support,
                min_confidence=min_confidence,
            )

        return jsonify(result)

    except ValueError as exc:
        return jsonify({
            "error": str(exc),
        }), 400
    except Exception as exc:
        return jsonify({
            "error": str(exc),
        }), 500


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() in {"1", "true", "yes"}
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        debug=debug,
    )
