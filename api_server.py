from pathlib import Path
import io
import re
import unicodedata
import pickle

import numpy as np
import pandas as pd
import torch
from flask import Flask, jsonify, request
from flask_cors import CORS
from catboost import CatBoostClassifier
from transformers import AutoTokenizer, AutoModelForSequenceClassification

from Apriori.apriori_core import load_rules_csv
from Apriori.clean_dual import MODEL_DIR as APRIORI_ABSA_MODEL_DIR
from Apriori.clean_dual import analyze_upload_via_phobert_apriori

try:
    from underthesea import word_tokenize
except ImportError as exc:
    raise ImportError("Thiếu underthesea. Cài bằng: pip install underthesea") from exc


BASE_DIR = Path(__file__).resolve().parent

PHOBERT_DIR = BASE_DIR / "phobert_tennis_saved"
CATBOOST_PATH = BASE_DIR / "catboost_tennis.cbm"
ENCODER_PATH = BASE_DIR / "tennis_label_encoder.pkl"
APRIORI_DIR = BASE_DIR / "Apriori"
APRIORI_RULES_PATH = APRIORI_DIR / "apriori_rules.csv"
APRIORI_ABSA_ZIP = APRIORI_DIR / "phobert_absa_model.zip"

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
CORS(app)

catboost_model = None
phobert_bundle = None


def preprocess_text(text: str) -> str:
    if text is None:
        return ""

    text = unicodedata.normalize("NFC", str(text)).lower().strip()
    text = re.sub(r"[^0-9a-zA-ZÀ-ỹ\s.,;:?]", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"(.)\1{2,}", r"\1", text)

    try:
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

    if phobert_bundle is not None:
        return phobert_bundle

    if not PHOBERT_DIR.exists():
        raise FileNotFoundError(f"Không tìm thấy thư mục PhoBERT: {PHOBERT_DIR}")

    if not ENCODER_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy label encoder: {ENCODER_PATH}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tokenizer = AutoTokenizer.from_pretrained(str(PHOBERT_DIR))
    phobert_model = AutoModelForSequenceClassification.from_pretrained(str(PHOBERT_DIR))
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


def extract_aspects(segmented_text: str) -> dict:
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
            return pd.read_csv(io.BytesIO(raw), encoding=encoding)
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
        "catboost_exists": CATBOOST_PATH.exists(),
        "phobert_dir_exists": PHOBERT_DIR.exists(),
        "encoder_exists": ENCODER_PATH.exists(),
        "apriori_dir_exists": APRIORI_DIR.exists(),
        "apriori_rules_exists": APRIORI_RULES_PATH.exists(),
        "apriori_absa_zip_exists": APRIORI_ABSA_ZIP.exists(),
        "apriori_absa_model_dir_exists": APRIORI_ABSA_MODEL_DIR.exists(),
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
        uploaded_file = request.files.get("file")
        if uploaded_file is None:
            return jsonify({
                "error": "Vui lòng chọn file CSV để phân tích Apriori.",
            }), 400

        min_support = float(request.form.get("min_support", 0.05))
        min_confidence = float(request.form.get("min_confidence", 0.6))

        df = read_uploaded_csv(uploaded_file)
        result = analyze_upload_via_phobert_apriori(
            df,
            min_support=min_support,
            min_confidence=min_confidence,
        )

        return jsonify(result)

    except Exception as exc:
        return jsonify({
            "error": str(exc),
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
