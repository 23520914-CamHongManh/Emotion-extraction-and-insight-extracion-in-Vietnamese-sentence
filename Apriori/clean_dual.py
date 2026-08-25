from __future__ import annotations

import gc
import json
from datetime import datetime
from pathlib import Path
import os
import re
import shutil
import unicodedata
import uuid
from zipfile import ZipFile

import pandas as pd
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from tqdm import tqdm

from .apriori_core import (
    COMMENT_COLUMNS,
    ID_COLUMNS,
    RATING_COLUMNS,
    analyze_apriori_dataframe,
    find_column,
    safe_float,
)

try:
    from underthesea import word_tokenize
except ImportError as exc:
    raise ImportError("Thiếu underthesea. Cài bằng: pip install underthesea") from exc

# ============================================================
# PATHS & CONFIGURATION
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
MODEL_ZIP_PATH = BASE_DIR / "phobert_absa_model.zip"
MODEL_DIR = BASE_DIR / "phobert_absa_model"
TEENCODE_DICT_PATH = BASE_DIR / "teencode.json" # Đảm bảo bạn có file này trong thư mục Apriori

NLI_ASPECTS = [
    ("Giao_Hang", "giao hàng"),
    ("CSKH_Hau_Mai", "chăm sóc khách hàng và hậu mãi"),
    ("Chat_Luong_Chat_Lieu", "chất lượng và chất liệu"),
    ("Dong_Goi", "đóng gói"),
    ("Gia_Ca", "giá cả"),
    ("Mau_Sac_Mau_Ma", "màu sắc và mẫu mã"),
    ("Form_Size", "form và size"),
]

DEFAULT_LABEL_MAPPING = {
    0: "NEG",
    1: "NEU",
    2: "POS"
}

SAFE_MANUAL_OVERRIDES = {
    "nan": "nản",
}

# Khởi tạo Global Models (Dùng chung cho inference in-memory)
phobert_bundle = None

# ============================================================
# TEXT CLEANING CORE (TỪ CLEAN_PHOBERT_TEST)
# ============================================================

def load_teencode_dictionary(path: Path | None) -> dict[str, str]:
    """Tải từ điển teencode một cách an toàn."""
    teencode_dict = {}
    if path is not None and path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            teencode_dict.update(data.get("normalization_map_safe", data))
        except Exception as e:
            print(f"Could not read teencode JSON: {e}")
            
    teencode_dict.update(SAFE_MANUAL_OVERRIDES)
    return teencode_dict

def normalize_teencode_exact(text: str, teencode_dict: dict[str, str]) -> str:
    """Thay thế teencode chính xác theo từ (word boundary)."""
    if not teencode_dict:
        return text
    words = text.split()
    replaced_words = [teencode_dict.get(w, w) for w in words]
    return " ".join(replaced_words)

def clean_for_phobert(text: object, teencode_dict: dict[str, str]) -> str:
    """Hàm clean tổng thể cho PhoBERT."""
    if pd.isna(text):
        return ""
        
    # 1. Unicode & Lowercase
    text = unicodedata.normalize("NFC", str(text)).lower().strip()
    
    # 2. Xóa link, html
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    
    # 3. Chuẩn hóa Teencode
    text = normalize_teencode_exact(text, teencode_dict)
    
    # 4. Xóa ký tự đặc biệt, giữ lại chữ, số, và một số dấu câu cơ bản
    text = re.sub(r"[^0-9a-zA-ZÀ-ỹ\s.,;:?_]", " ", text)
    
    # 5. Chống lặp ký tự (vd: đẹpppp -> đẹp) & xóa khoảng trắng thừa
    text = re.sub(r"(.)\1{2,}", r"\1", text) 
    text = re.sub(r"\s+", " ", text).strip()
    
    # 6. Tách từ (Word Segmentation)
    try:
        return word_tokenize(text, format="text")
    except Exception:
        return text

# ============================================================
# DATAFRAME PIPELINE 
# ============================================================

def clean_uploaded_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Bước 1: Clean in-memory (Không ghi file).
    Chỉ giữ lại comment_id, text_segmented, và rate (nếu có).
    """
    # Xử lý ID
    if "comment_id" not in df.columns:
        df["comment_id"] = [str(uuid.uuid4()) for _ in range(len(df))]
        
    # Tìm cột comment
    comment_col = find_column(df, COMMENT_COLUMNS)
    if not comment_col:
        for col in df.columns:
            if df[col].dtype == object and col != "comment_id":
                comment_col = col
                break
    if not comment_col:
        raise ValueError("Không tìm thấy cột chứa nội dung bình luận (comment).")

    # Clean & Segment
    teencode_dict = load_teencode_dictionary(TEENCODE_DICT_PATH)
    df["text_segmented"] = df[comment_col].apply(lambda x: clean_for_phobert(x, teencode_dict))
    
    # Loại bỏ dòng rỗng
    df = df[df["text_segmented"].str.strip() != ""]
    
    # ============================================================
    # 🚀 FIX LỖI Ở ĐÂY: Dùng hàm thông minh để tìm cột Rate/Rating 
    # bất kể viết hoa, viết thường hay dùng từ đồng nghĩa (stars, diem)
    # ============================================================
    rating_col = find_column(df, RATING_COLUMNS)
    if rating_col:
        df = df.rename(columns={rating_col: "rate"})
        
    # Trích xuất các cột cần thiết, giữ lại cột rate vừa tìm được
    cols_to_keep = ["comment_id", "text_segmented"]
    if rating_col:
        cols_to_keep.append("rate")
        
    return df[cols_to_keep].copy()

def split_clean_to_nli(df: pd.DataFrame) -> pd.DataFrame:
    """
    Bước 2: Chuyển dữ liệu sang định dạng NLI (Tách 1 comment thành 7 dòng aspect).
    Thực hiện hoàn toàn trên RAM.
    """
    rows = []
    for _, row in df.iterrows():
        base_dict = {
            "comment_id": row["comment_id"],
            "text_segmented": row["text_segmented"]
        }
        if "rate" in row:
            base_dict["rate"] = row["rate"]
            
        for aspect_code, aspect_text in NLI_ASPECTS:
            # Format chuẩn PhoBERT NLI: "text_segmented </s></s> aspect_text"
            nli_text = f"{row['text_segmented']} </s></s> {aspect_text}"
            new_row = base_dict.copy()
            new_row["aspect"] = aspect_code
            new_row["nli_text"] = nli_text
            rows.append(new_row)
            
    return pd.DataFrame(rows)

def load_phobert_absa_model():
    """Tải model vào global variable."""
    global phobert_bundle
    if phobert_bundle is not None:
        return phobert_bundle

    if not MODEL_DIR.exists():
        if not MODEL_ZIP_PATH.exists():
            raise FileNotFoundError(f"Không tìm thấy model tại {MODEL_ZIP_PATH}")
        print("Extracting PhoBERT ABSA model...")
        with ZipFile(MODEL_ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(MODEL_DIR)

    print("Loading PhoBERT ABSA model into memory...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_DIR,
        low_cpu_mem_usage=True,
    )
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()

    phobert_bundle = {
        "tokenizer": tokenizer,
        "model": model,
        "device": device
    }
    return phobert_bundle


def unload_phobert_absa_model() -> bool:
    """Release the ABSA PhoBERT bundle before activating the Tennis model."""
    global phobert_bundle
    if phobert_bundle is None:
        return False

    bundle = phobert_bundle
    phobert_bundle = None
    del bundle
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return True

def predict_nli_dataframe(df: pd.DataFrame, output_path: Path | None = None) -> pd.DataFrame:
    """
    Bước 3: Chạy Inference trên tập NLI. Ghi ra file CSV cuối cùng nếu được yêu cầu.
    """
    bundle = load_phobert_absa_model()
    tokenizer = bundle["tokenizer"]
    model = bundle["model"]
    device = bundle["device"]

    predictions = []
    batch_size = 4  # Limit activation memory for the Render Standard instance.
    
    texts = df["nli_text"].tolist()
    
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            inputs = tokenizer(
                batch_texts, 
                padding=True, 
                truncation=True, 
                max_length=256, 
                return_tensors="pt"
            ).to(device)
            
            outputs = model(**inputs)
            logits = outputs.logits
            preds = torch.argmax(logits, dim=-1).cpu().numpy()
            
            for p in preds:
                predictions.append(DEFAULT_LABEL_MAPPING.get(int(p), "NEU"))

    df["sentiment"] = predictions
    
    # Dọn dẹp cột nli_text (không cần thiết xuất ra)
    if "nli_text" in df.columns:
        df = df.drop(columns=["nli_text"])

    # Xóa file kết quả cũ nếu tồn tại và ghi file mới
    if output_path is not None:
        if output_path.exists():
            output_path.unlink() # Xóa file cũ
        output_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(output_path, index=False, encoding="utf-8-sig")

    return df

# ============================================================
# MAIN ORCHESTRATION FUNCTIONS (DÙNG CHO API)
# ============================================================

def make_job_id() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def build_phobert_prediction_csv(df: pd.DataFrame, job_id: str | None = None) -> dict:
    """
    Thực hiện luồng Pipeline hoàn toàn trong RAM.
    """
    job_id = job_id or make_job_id()
    
    # 1. Clean data in-memory
    clean_df = clean_uploaded_dataframe(df)
    
    # 2. Split sang NLI in-memory
    nli_df = split_clean_to_nli(clean_df)
    
    # 3. Predict in-memory; do not share a CSV file between requests.
    prediction_df = predict_nli_dataframe(nli_df)

    return {
        "job_id": job_id,
        "prediction_df": prediction_df,
    }

def analyze_upload_via_phobert_apriori(
    df: pd.DataFrame,
    min_support: float = 0.05,
    min_confidence: float = 0.6,
    max_rules: int = 200,
) -> dict:
    """
    Hàm được gọi trực tiếp từ Flask API (api_server.py).
    """
    artifacts = build_phobert_prediction_csv(df)
    prediction_df = artifacts["prediction_df"]

    # Đẩy kết quả dataframe thẳng vào hàm của apriori_core
    result = analyze_apriori_dataframe(
        prediction_df,
        min_support=min_support,
        min_confidence=min_confidence,
        max_rules=max_rules,
    )

    result["source_mode"] = "phobert_absa_predictions"
    result["columns"] = list(prediction_df.columns)
    result["artifacts"] = {
        "job_id": artifacts["job_id"],
    }

    return result
