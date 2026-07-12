import re
from dataclasses import dataclass


BRAND_PATTERNS = {
    "Samsung": re.compile(r"\bSamsung\b|\bGalaxy\b", re.I),
    "Apple": re.compile(r"\bApple\b|\biPhone\b", re.I),
    "Google": re.compile(r"\bGoogle\b|\bPixel\b", re.I),
}

MODEL_PATTERN = re.compile(
    r"\b((?:Samsung\s+)?Galaxy\s+[A-Z0-9][A-Za-z0-9 +.-]*|(?:Apple\s+)?iPhone\s+[A-Za-z0-9 +.-]+|(?:Google\s+)?Pixel\s+[A-Za-z0-9 +.-]+)",
    re.I,
)

MONEY_PATTERN = re.compile(r"\$\s?([0-9][0-9,]*(?:\.\d{2})?)")
TERM_PATTERN = re.compile(r"\b(24|30|36)\s+months?\b", re.I)
PROMO_WORD_PATTERN = re.compile(
    r"\b(free|promo|promotion|credit|trade[- ]?in|save|savings|off|deal|discount|gift card|new line|unlimited)\b",
    re.I,
)


@dataclass
class PromotionCandidate:
    brand: str | None
    model: str | None
    offer_type: str | None
    max_credit_usd: float | None
    term_months: int | None
    requires_trade_in: bool
    requires_new_line: bool
    requires_unlimited_plan: bool
    source_text: str


def compact_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def split_sentences(text: str) -> list[str]:
    text = compact_text(text)
    pieces = re.split(r"(?<=[.!?])\s+|(?<=\))\s+|\s{2,}", text)
    return [piece.strip() for piece in pieces if piece.strip()]


def infer_brand(text: str) -> str | None:
    for brand, pattern in BRAND_PATTERNS.items():
        if pattern.search(text):
            return brand
    return None


def infer_model(text: str) -> str | None:
    match = MODEL_PATTERN.search(text)
    return compact_text(match.group(1)) if match else None


def infer_offer_type(text: str) -> str | None:
    lower = text.lower()
    if "trade" in lower:
        return "trade_in"
    if "gift card" in lower or "egift" in lower:
        return "gift_card"
    if "free" in lower or "$0" in lower:
        return "free_after_credit"
    if "off" in lower or "save" in lower or "credit" in lower:
        return "bill_credit"
    return None


def extract_money(text: str) -> float | None:
    amounts = []
    for match in MONEY_PATTERN.finditer(text):
        try:
            amounts.append(float(match.group(1).replace(",", "")))
        except ValueError:
            continue
    return max(amounts) if amounts else None


def extract_term(text: str) -> int | None:
    match = TERM_PATTERN.search(text)
    return int(match.group(1)) if match else None


def extract_candidates(raw_text: str) -> list[PromotionCandidate]:
    candidates: list[PromotionCandidate] = []
    seen: set[str] = set()

    for sentence in split_sentences(raw_text):
        if not PROMO_WORD_PATTERN.search(sentence):
            continue
        if len(sentence) < 24:
            continue

        normalized = compact_text(sentence)
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)

        candidates.append(
            PromotionCandidate(
                brand=infer_brand(normalized),
                model=infer_model(normalized),
                offer_type=infer_offer_type(normalized),
                max_credit_usd=extract_money(normalized),
                term_months=extract_term(normalized),
                requires_trade_in=bool(re.search(r"trade[- ]?in", normalized, re.I)),
                requires_new_line=bool(re.search(r"new line|add a line", normalized, re.I)),
                requires_unlimited_plan=bool(re.search(r"unlimited", normalized, re.I)),
                source_text=normalized[:1200],
            )
        )

    return candidates

