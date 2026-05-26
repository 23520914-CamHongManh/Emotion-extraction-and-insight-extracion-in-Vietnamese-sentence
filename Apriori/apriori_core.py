from __future__ import annotations

from collections import Counter, defaultdict
import itertools
import math
import re
import unicodedata

import pandas as pd


ASPECT_LABELS = {
    "Giao_Hang": "Giao hàng",
    "CSKH_Hau_Mai": "CSKH / hậu mãi",
    "Chat_Luong_Chat_Lieu": "Chất lượng / chất liệu",
    "Dong_Goi": "Đóng gói",
    "Gia_Ca": "Giá cả",
    "Mau_Sac_Mau_Ma": "Màu sắc / mẫu mã",
    "Form_Size": "Form / size",
    "Tong_Quan": "Tổng quan",
}

ASPECT_ALIASES = {
    "Giao_Hang": [
        "giao_hang",
        "giao hang",
        "van_chuyen",
        "vận chuyển",
        "ship",
        "shipping",
        "delivery",
        "giao",
    ],
    "CSKH_Hau_Mai": [
        "cskh_hau_mai",
        "cskh",
        "hau_mai",
        "hậu mãi",
        "cham_soc_khach_hang",
        "chăm sóc khách hàng",
        "tu_van",
        "tư vấn",
        "customer_service",
        "support",
    ],
    "Chat_Luong_Chat_Lieu": [
        "chat_luong_chat_lieu",
        "chat_luong",
        "chất lượng",
        "chat_lieu",
        "chất liệu",
        "quality",
        "material",
        "san_pham",
        "sản phẩm",
    ],
    "Dong_Goi": ["dong_goi", "đóng gói", "bao_bi", "bao bì", "packaging", "package"],
    "Gia_Ca": ["gia_ca", "giá cả", "gia", "giá", "price", "cost"],
    "Mau_Sac_Mau_Ma": [
        "mau_sac_mau_ma",
        "mau_sac",
        "màu sắc",
        "mau_ma",
        "mẫu mã",
        "color",
        "design",
        "style",
    ],
    "Form_Size": ["form_size", "form", "size", "kich_co", "kích cỡ", "vua_van", "vừa vặn"],
    "Tong_Quan": ["tong_quan", "tổng quan", "overall", "general"],
}

POSITIVE_TERMS = {
    "pos",
    "positive",
    "tich_cuc",
    "tích cực",
    "tot",
    "tốt",
    "good",
    "great",
    "hai_long",
    "hài lòng",
    "ok",
    "yes",
}

NEGATIVE_TERMS = {
    "neg",
    "negative",
    "tieu_cuc",
    "tiêu cực",
    "xau",
    "xấu",
    "bad",
    "poor",
    "that_vong",
    "thất vọng",
    "khong_hai_long",
    "không hài lòng",
    "no",
}

NEUTRAL_TERMS = {"neu", "neutral", "trung_lap", "trung lập", "binh_thuong", "bình thường"}

COMMENT_COLUMNS = [
    "comment",
    "comments",
    "review",
    "reviews",
    "content",
    "text",
    "noi_dung",
    "nội dung",
    "binh_luan",
    "bình luận",
]

ID_COLUMNS = ["comment_id", "commentid", "id", "review_id", "ma_binh_luan", "mã bình luận"]
RATING_COLUMNS = ["rating", "ratings", "rate", "star", "stars", "score", "diem", "điểm"]
ASPECT_COLUMNS = ["aspect", "aspect_en", "aspect_name", "khia_canh", "khía cạnh", "category"]
SENTIMENT_COLUMNS = [
    "predicted_sentiment",
    "sentiment",
    "polarity",
    "label",
    "nhan",
    "nhãn",
    "cam_xuc",
    "cảm xúc",
]
ITEM_COLUMNS = ["item", "items", "transaction_item"]


def strip_accents(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def normalize_key(value: object) -> str:
    text = strip_accents(value).lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def safe_float(value: object, default: float = 0.0) -> float:
    try:
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return default
        return number
    except (TypeError, ValueError):
        return default


ALIAS_LOOKUP = {
    normalize_key(alias): aspect for aspect, aliases in ASPECT_ALIASES.items() for alias in aliases
}
ALIAS_LOOKUP.update({normalize_key(aspect): aspect for aspect in ASPECT_LABELS})


def canonical_aspect(value: object, allow_unknown: bool = True) -> str | None:
    key = normalize_key(value)
    if not key:
        return None

    if key in ALIAS_LOOKUP:
        return ALIAS_LOOKUP[key]

    if "giao" in key and ("hang" in key or "ship" in key or "delivery" in key):
        return "Giao_Hang"
    if "cskh" in key or "hau_mai" in key or ("khach" in key and "hang" in key):
        return "CSKH_Hau_Mai"
    if "chat_luong" in key or "chat_lieu" in key or "quality" in key or "material" in key:
        return "Chat_Luong_Chat_Lieu"
    if "dong_goi" in key or "bao_bi" in key or "pack" in key:
        return "Dong_Goi"
    if key.startswith("gia") or "price" in key or "cost" in key:
        return "Gia_Ca"
    if "mau" in key or "color" in key or "design" in key:
        return "Mau_Sac_Mau_Ma"
    if "size" in key or "form" in key or "kich_co" in key:
        return "Form_Size"

    if not allow_unknown:
        return None

    return "_".join(part.capitalize() for part in key.split("_") if part) or "Tong_Quan"


def canonical_sentiment(value: object) -> str | None:
    key = normalize_key(value)
    if not key:
        return None

    if key in {normalize_key(term) for term in POSITIVE_TERMS} or key.endswith("_pos"):
        return "POS"
    if key in {normalize_key(term) for term in NEGATIVE_TERMS} or key.endswith("_neg"):
        return "NEG"
    if key in {normalize_key(term) for term in NEUTRAL_TERMS} or key.endswith("_neu"):
        return "NEU"

    if "positive" in key or re.search(r"(^|_)pos($|_)", key):
        return "POS"
    if "negative" in key or re.search(r"(^|_)neg($|_)", key):
        return "NEG"
    if "neutral" in key or re.search(r"(^|_)neu($|_)", key):
        return "NEU"

    return None


def rating_to_sentiment(value: object) -> str | None:
    rating = safe_float(value, default=math.nan)
    if math.isnan(rating):
        return None
    if rating >= 4:
        return "POS"
    if rating <= 2:
        return "NEG"
    return "NEU"


def find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    normalized_columns = {normalize_key(column): column for column in df.columns}
    candidate_keys = [normalize_key(candidate) for candidate in candidates]

    for candidate in candidate_keys:
        if candidate in normalized_columns:
            return normalized_columns[candidate]

    for key, column in normalized_columns.items():
        if any(candidate and candidate in key for candidate in candidate_keys):
            return column

    return None


def split_rule_cell(value: object) -> list[str]:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return []

    text = str(value).strip()
    if not text:
        return []

    text = text.replace("frozenset", "")
    text = re.sub(r"[{}\[\]()'\"`]", "", text)
    return [part.strip() for part in re.split(r"\s*,\s*|\s*;\s*|\s*\|\s*", text) if part.strip()]


def parse_item(value: object) -> tuple[str | None, str | None]:
    raw = str(value or "").strip()
    if not raw:
        return None, None

    match = re.match(r"^(.*?)[_\s-](POS|NEG|NEU)$", raw, flags=re.IGNORECASE)
    if match:
        return canonical_aspect(match.group(1)), canonical_sentiment(match.group(2))

    sentiment = canonical_sentiment(raw)
    if sentiment:
        aspect_key = re.sub(r"[_\s-]?(POS|NEG|NEU)$", "", raw, flags=re.IGNORECASE)
        return canonical_aspect(aspect_key or "Tong_Quan"), sentiment

    return canonical_aspect(raw), None


def item_key(aspect: str, sentiment: str) -> str:
    return f"{aspect}_{sentiment}"


def item_payload(item: str) -> dict:
    aspect, sentiment = parse_item(item)
    aspect = aspect or "Tong_Quan"
    sentiment = sentiment or "NEU"
    return {
        "key": item_key(aspect, sentiment),
        "aspect": aspect,
        "aspect_label": ASPECT_LABELS.get(aspect, aspect.replace("_", " ")),
        "sentiment": sentiment,
        "label": f"{ASPECT_LABELS.get(aspect, aspect.replace('_', ' '))} {sentiment}",
    }


def infer_text_sentiment(text: object, rating: object = None) -> str | None:
    from_rating = rating_to_sentiment(rating)
    if from_rating in {"POS", "NEG"}:
        return from_rating

    normalized = normalize_key(text)
    positive_score = sum(1 for term in POSITIVE_TERMS if normalize_key(term) in normalized)
    negative_score = sum(1 for term in NEGATIVE_TERMS if normalize_key(term) in normalized)

    if positive_score > negative_score:
        return "POS"
    if negative_score > positive_score:
        return "NEG"
    return None


def infer_text_aspects(text: object) -> list[str]:
    normalized = normalize_key(text)
    aspects = []

    for aspect, aliases in ASPECT_ALIASES.items():
        if aspect == "Tong_Quan":
            continue
        if any(normalize_key(alias) in normalized for alias in aliases):
            aspects.append(aspect)

    return aspects or ["Tong_Quan"]


def build_records_from_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    if df.empty:
        raise ValueError("CSV không có dòng dữ liệu.")

    df = df.copy()
    df.columns = [str(column).strip() for column in df.columns]

    comment_id_col = find_column(df, ID_COLUMNS)
    rating_col = find_column(df, RATING_COLUMNS)
    aspect_col = find_column(df, ASPECT_COLUMNS)
    sentiment_col = find_column(df, SENTIMENT_COLUMNS)
    item_col = find_column(df, ITEM_COLUMNS)
    comment_col = find_column(df, COMMENT_COLUMNS)

    records = []

    def base_record(row: pd.Series, index: int) -> dict:
        return {
            "comment_id": str(row.get(comment_id_col, index + 1)) if comment_id_col else str(index + 1),
            "rating": safe_float(row.get(rating_col), default=math.nan) if rating_col else math.nan,
            "comment": str(row.get(comment_col, "")) if comment_col else "",
        }

    if aspect_col and sentiment_col:
        source_mode = "aspect_sentiment"
        for index, row in df.iterrows():
            aspect = canonical_aspect(row.get(aspect_col))
            sentiment = canonical_sentiment(row.get(sentiment_col))
            if not aspect or sentiment not in {"POS", "NEG"}:
                continue
            record = base_record(row, index)
            record.update({"aspect": aspect, "sentiment": sentiment, "item": item_key(aspect, sentiment)})
            records.append(record)

    elif item_col:
        source_mode = "transaction_items"
        for index, row in df.iterrows():
            for raw_item in split_rule_cell(row.get(item_col)):
                aspect, sentiment = parse_item(raw_item)
                if not aspect or sentiment not in {"POS", "NEG"}:
                    continue
                record = base_record(row, index)
                record.update({"aspect": aspect, "sentiment": sentiment, "item": item_key(aspect, sentiment)})
                records.append(record)

    else:
        aspect_columns = [
            column for column in df.columns if canonical_aspect(column, allow_unknown=False)
        ]

        if aspect_columns:
            source_mode = "wide_aspect_sentiment"
            for index, row in df.iterrows():
                for column in aspect_columns:
                    aspect = canonical_aspect(column, allow_unknown=False)
                    sentiment = canonical_sentiment(row.get(column))
                    if not aspect or sentiment not in {"POS", "NEG"}:
                        continue
                    record = base_record(row, index)
                    record.update({"aspect": aspect, "sentiment": sentiment, "item": item_key(aspect, sentiment)})
                    records.append(record)

        elif comment_col:
            source_mode = "comment_heuristic"
            for index, row in df.iterrows():
                sentiment = infer_text_sentiment(row.get(comment_col), row.get(rating_col) if rating_col else None)
                if sentiment not in {"POS", "NEG"}:
                    continue
                for aspect in infer_text_aspects(row.get(comment_col)):
                    record = base_record(row, index)
                    record.update({"aspect": aspect, "sentiment": sentiment, "item": item_key(aspect, sentiment)})
                    records.append(record)

        else:
            raise ValueError(
                "CSV cần có cột aspect + sentiment, item, các cột aspect dạng rộng, hoặc cột comment/text."
            )

    records_df = pd.DataFrame(records)
    if records_df.empty:
        raise ValueError("Không tìm thấy item POS/NEG hợp lệ để chạy Apriori.")

    records_df = records_df.drop_duplicates(subset=["comment_id", "item"]).reset_index(drop=True)
    return records_df, source_mode


def run_apriori_and_rules(
    transactions: list[list[str]],
    min_support: float = 0.05,
    min_confidence: float = 0.6,
    max_itemset_size: int = 4,
    prune_threshold: float = 0.05,  # Ngưỡng 5% để phân biệt luật dư thừa
) -> pd.DataFrame:
    transaction_count = len(transactions)
    if transaction_count == 0:
        return pd.DataFrame()

    tx_sets = [set(transaction) for transaction in transactions if transaction]
    if not tx_sets:
        return pd.DataFrame()

    all_items = sorted({item for transaction in tx_sets for item in transaction})
    frequent_itemsets: dict[frozenset[str], float] = {}

    current_level = {
        frozenset([item]): sum(1 for transaction in tx_sets if item in transaction) / transaction_count
        for item in all_items
    }
    current_level = {itemset: support for itemset, support in current_level.items() if support >= min_support}
    frequent_itemsets.update(current_level)

    size = 2
    while current_level and size <= max_itemset_size:
        level_items = sorted({item for itemset in current_level for item in itemset})
        candidates = {frozenset(candidate) for candidate in itertools.combinations(level_items, size)}

        next_level = {}
        for candidate in candidates:
            if any(frozenset(subset) not in frequent_itemsets for subset in itertools.combinations(candidate, size - 1)):
                continue

            support = sum(1 for transaction in tx_sets if candidate.issubset(transaction)) / transaction_count
            if support >= min_support:
                next_level[candidate] = support

        if not next_level:
            break

        frequent_itemsets.update(next_level)
        current_level = next_level
        size += 1

    rules = []
    for itemset, support in frequent_itemsets.items():
        if len(itemset) < 2:
            continue

        items = list(itemset)
        for antecedent_size in range(1, len(items)):
            for antecedent_tuple in itertools.combinations(items, antecedent_size):
                antecedents = frozenset(antecedent_tuple)
                consequents = itemset - antecedents
                antecedent_support = frequent_itemsets.get(antecedents, 0)
                consequent_support = frequent_itemsets.get(consequents, 0)
                if not antecedent_support or not consequent_support:
                    continue

                confidence = support / antecedent_support
                if confidence < min_confidence:
                    continue

                lift = support / (antecedent_support * consequent_support)
                leverage = support - (antecedent_support * consequent_support)
                conviction = (1 - consequent_support) / (1 - confidence) if confidence < 1 else math.inf

                rules.append(
                    {
                        "antecedents": antecedents,
                        "consequents": consequents,
                        "antecedent support": antecedent_support,
                        "consequent support": consequent_support,
                        "support": support,
                        "confidence": confidence,
                        "lift": lift,
                        "leverage": leverage,
                        "conviction": conviction,
                    }
                )

    # =========================================================================
    # 🔥 THUẬT TOÁN TỰ ĐỘNG LỌC BỎ LUẬT RÁC VÀ DƯ THỪA (RULE PRUNING)
    # =========================================================================
    
    # BƯỚC 1: Lọc vế trái (Antecedents) phức tạp không cần thiết
    # Sắp xếp luật từ có vế trái NGẮN đến DÀI
    sorted_by_ant = sorted(rules, key=lambda r: len(r["antecedents"]))
    pruned_rules = []
    
    for rule in sorted_by_ant:
        is_redundant = False
        for accepted in pruned_rules:
            # Nếu trùng vế phải hoàn toàn VÀ vế trái luật cũ là tập con của luật hiện tại
            if accepted["consequents"] == rule["consequents"] and accepted["antecedents"].issubset(rule["antecedents"]):
                # Nếu việc nhét thêm điều kiện mới không làm tăng confidence vượt trội (> 5%)
                if rule["confidence"] - accepted["confidence"] <= prune_threshold:
                    is_redundant = True
                    break
        if not is_redundant:
            pruned_rules.append(rule)

    # BƯỚC 2: Gộp/Lọc vế phải (Consequents) để tối ưu hiển thị
    # Sắp xếp luật từ có vế phải DÀI đến NGẮN (Ưu tiên giữ luật gộp nhiều hậu quả trước)
    sorted_by_con = sorted(pruned_rules, key=lambda r: len(r["consequents"]), reverse=True)
    final_rules = []
    
    for rule in sorted_by_con:
        is_subsumed = False
        for accepted in final_rules:
            # Nếu trùng vế trái hoàn toàn VÀ vế phải luật hiện tại nằm gọn trong vế phải của luật gộp
            if accepted["antecedents"] == rule["antecedents"] and rule["consequents"].issubset(accepted["consequents"]):
                # Nếu luật gộp đã giữ có độ tin cậy tốt tương đương luật đơn lẻ này (chênh lệch <= 5%)
                if accepted["confidence"] >= rule["confidence"] - prune_threshold:
                    is_subsumed = True
                    break
        if not is_subsumed:
            final_rules.append(rule)

    # Trả về kết quả sạch sẽ sau khi lọc
    return pd.DataFrame(final_rules)


def build_transactions(records_df: pd.DataFrame, comment_ids: set[str] | None = None) -> list[list[str]]:
    source = records_df
    if comment_ids is not None:
        source = records_df[records_df["comment_id"].isin(comment_ids)]

    transactions = []
    for _, group in source.groupby("comment_id"):
        items = sorted(set(group["item"].dropna().astype(str)))
        if items:
            transactions.append(items)
    return transactions


def serialize_rule(row: dict | pd.Series, rating_group: str | None = None) -> dict:
    antecedent_items = sorted(row.get("antecedents", []))
    consequent_items = sorted(row.get("consequents", []))

    if isinstance(antecedent_items, str):
        antecedent_items = split_rule_cell(antecedent_items)
    if isinstance(consequent_items, str):
        consequent_items = split_rule_cell(consequent_items)

    support = safe_float(row.get("support"))
    confidence = safe_float(row.get("confidence"))
    lift = safe_float(row.get("lift"))

    group = rating_group or str(row.get("rating_group", "ALL") or "ALL")

    return {
        "antecedents": [item_payload(item) for item in antecedent_items],
        "consequents": [item_payload(item) for item in consequent_items],
        "antecedent_support": safe_float(row.get("antecedent support")),
        "consequent_support": safe_float(row.get("consequent support")),
        "support": support,
        "confidence": confidence,
        "lift": lift,
        "leverage": safe_float(row.get("leverage")),
        "conviction": safe_float(row.get("conviction"), default=999.0),
        "rating_group": group,
        "score": confidence * max(lift, 0.1) * max(support, 0.01),
    }


def build_aspect_summary(records_df: pd.DataFrame) -> list[dict]:
    grouped = defaultdict(Counter)

    unique_records = records_df.drop_duplicates(subset=["comment_id", "aspect", "sentiment"])
    for _, row in unique_records.iterrows():
        grouped[row["aspect"]][row["sentiment"]] += 1

    summary = []
    for aspect, counts in grouped.items():
        pos = counts.get("POS", 0)
        neg = counts.get("NEG", 0)
        total = pos + neg
        if total == 0:
            continue
        summary.append(
            {
                "aspect": aspect,
                "label": ASPECT_LABELS.get(aspect, aspect.replace("_", " ")),
                "POS": pos,
                "NEG": neg,
                "total": total,
                "positive_rate": round(pos / total * 100, 2),
                "negative_rate": round(neg / total * 100, 2),
            }
        )

    return sorted(summary, key=lambda item: item["total"], reverse=True)


def build_summary_from_rules(rules: list[dict]) -> list[dict]:
    grouped = defaultdict(Counter)

    for rule in rules:
        for item in rule["antecedents"] + rule["consequents"]:
            sentiment = item.get("sentiment")
            if sentiment in {"POS", "NEG"}:
                grouped[item["aspect"]][sentiment] += 1

    summary = []
    for aspect, counts in grouped.items():
        pos = counts.get("POS", 0)
        neg = counts.get("NEG", 0)
        total = pos + neg
        if total == 0:
            continue
        summary.append(
            {
                "aspect": aspect,
                "label": ASPECT_LABELS.get(aspect, aspect.replace("_", " ")),
                "POS": pos,
                "NEG": neg,
                "total": total,
                "positive_rate": round(pos / total * 100, 2),
                "negative_rate": round(neg / total * 100, 2),
            }
        )

    return sorted(summary, key=lambda item: item["total"], reverse=True)


def build_recommendations(rules: list[dict], limit: int = 6) -> list[dict]:
    ranked = sorted(
        rules,
        key=lambda rule: (rule["confidence"], rule["lift"], rule["support"]),
        reverse=True,
    )

    recommendations = []
    for rule in ranked[:limit]:
        antecedents = " + ".join(item["label"] for item in rule["antecedents"])
        consequents = " + ".join(item["label"] for item in rule["consequents"])
        recommendations.append(
            {
                "title": f"Nếu {antecedents}",
                "outcome": consequents,
                "confidence": rule["confidence"],
                "support": rule["support"],
                "lift": rule["lift"],
                "rating_group": rule["rating_group"],
            }
        )

    return recommendations


def rules_from_dataframe(rules_df: pd.DataFrame) -> list[dict]:
    if rules_df.empty:
        return []

    rules = []
    for _, row in rules_df.iterrows():
        row_dict = row.to_dict()
        if not isinstance(row_dict.get("antecedents"), frozenset):
            row_dict["antecedents"] = split_rule_cell(row_dict.get("antecedents"))
        if not isinstance(row_dict.get("consequents"), frozenset):
            row_dict["consequents"] = split_rule_cell(row_dict.get("consequents"))
        rules.append(serialize_rule(row_dict))

    return sorted(rules, key=lambda rule: (rule["confidence"], rule["lift"], rule["support"]), reverse=True)


def analyze_apriori_dataframe(
    df: pd.DataFrame,
    min_support: float = 0.05,
    min_confidence: float = 0.6,
    max_rules: int = 200,
) -> dict:
    min_support = min(max(min_support, 0.01), 0.9)
    min_confidence = min(max(min_confidence, 0.1), 0.99)

    records_df, source_mode = build_records_from_dataframe(df)

    all_transactions = build_transactions(records_df)
    groups = [{"key": "ALL", "label": "Tất cả đánh giá", "transactions": all_transactions}]

    if "rating" in records_df:
        low_ids = set(records_df[records_df["rating"] < 4]["comment_id"].astype(str))
        high_ids = set(records_df[records_df["rating"] >= 4]["comment_id"].astype(str))
        if low_ids:
            groups.append({"key": "LOW", "label": "Rating thấp", "transactions": build_transactions(records_df, low_ids)})
        if high_ids:
            groups.append({"key": "HIGH", "label": "Rating cao", "transactions": build_transactions(records_df, high_ids)})

    serialized_rules = []
    group_stats = []

    for group in groups:
        rules_df = run_apriori_and_rules(
            group["transactions"],
            min_support=min_support,
            min_confidence=min_confidence,
        )
        group_rules = []
        if not rules_df.empty:
            rules_df["rating_group"] = group["key"]
            group_rules = rules_from_dataframe(rules_df)
            serialized_rules.extend(group_rules)

        group_stats.append(
            {
                "key": group["key"],
                "label": group["label"],
                "transactions": len(group["transactions"]),
                "rules": len(group_rules),
            }
        )

    serialized_rules = sorted(
        serialized_rules,
        key=lambda rule: (rule["confidence"], rule["lift"], rule["support"]),
        reverse=True,
    )

    total_comments = records_df["comment_id"].nunique()
    pos_count = int((records_df["sentiment"] == "POS").sum())
    neg_count = int((records_df["sentiment"] == "NEG").sum())

    result_rules = serialized_rules[:max_rules]
    return {
        "source_mode": source_mode,
        "columns": list(df.columns),
        "metrics": {
            "comments": int(total_comments),
            "items": int(len(records_df)),
            "transactions": int(len(all_transactions)),
            "positive_items": pos_count,
            "negative_items": neg_count,
            "rules": int(len(serialized_rules)),
        },
        "groups": group_stats,
        "aspect_summary": build_aspect_summary(records_df),
        "rules": result_rules,
        "recommendations": build_recommendations(result_rules),
    }


def load_rules_csv(path: str) -> dict:
    rules_df = pd.read_csv(path)
    rules = rules_from_dataframe(rules_df)
    return {
        "source_mode": "sample_rules_csv",
        "columns": list(rules_df.columns),
        "metrics": {
            "comments": 0,
            "items": 0,
            "transactions": 0,
            "positive_items": 0,
            "negative_items": 0,
            "rules": int(len(rules)),
        },
        "groups": [],
        "aspect_summary": build_summary_from_rules(rules),
        "rules": rules[:200],
        "recommendations": build_recommendations(rules),
    }
