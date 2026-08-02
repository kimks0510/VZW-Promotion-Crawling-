import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

BRAND_URLS = {
    "Apple": "https://www.t-mobile.com/offers/apple-iphone-deals",
    "Samsung": "https://www.t-mobile.com/offers/samsung-phone-deals",
    "Google": "https://www.t-mobile.com/offers/google-phone-deals",
}
MODEL_PATTERN = re.compile(
    r"(iPhone\s+[A-Za-z0-9 +.-]+|Galaxy\s+[A-Za-z0-9 +.-]+|Pixel\s+[A-Za-z0-9 +.-]+)",
    re.I,
)
# T-Mobile's offer-detail modal states the exact device price as
# "$X <dash> <Brand Model Storage>)" inside a parenthetical, e.g.
# "(e.g., $1,899.99 - Samsung Galaxy Z Fold8 256GB)". The dash glyph varies
# (en dash / em dash), so match any single separator character.
PRICE_MODEL_PATTERN = re.compile(r"\$([\d,]+(?:\.\d{2})?)\s*.\s*([A-Za-z][A-Za-z0-9 ]{2,50}?)\)")
CREDIT_PATTERN = re.compile(r"Up to \$([\d,]+(?:\.\d{2})?) via bill credits", re.I)
PLAN_PATTERN = re.compile(r"\$(\d+)\+/mo\.? plan", re.I)
TRADE_IN_SAVE_PATTERN = re.compile(r"Save \$([\d,]+(?:\.\d{2})?):\s*([A-Za-z0-9 ]+?)(?:\s*/|\)|$)", re.I)
TERM_MONTHS = 24
# The current qualifying-plan list sits before the "Better Value" alt-line-count
# clause and the legacy "(Existing members only)" Go5G carve-out, e.g. "Most
# voice plans, e.g., Essentials, Experience More, Experience Beyond: At least
# 1 new line." When this section names a tier explicitly, that tier shares the
# same advertised price as every named tier above it; unnamed tiers stay
# unverified rather than assumed.
QUALIFYING_SECTION_PATTERN = re.compile(r"^(.*?)Better Value", re.I | re.S)
TIER_NAME_PATTERN = {
    "low": re.compile(r"\bEssentials\b|\bGo5G\b(?!\s*Next)", re.I),
    "mid": re.compile(r"Experience More", re.I),
    "high": re.compile(r"Experience Beyond", re.I),
}


def qualifying_tiers(detail_text: str) -> set[str]:
    match = QUALIFYING_SECTION_PATTERN.search(detail_text)
    section = match.group(1) if match else detail_text
    return {tier for tier, pattern in TIER_NAME_PATTERN.items() if pattern.search(section)}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def strip_storage(model_text: str) -> str:
    return re.sub(r"\s*\d+\s*GB$", "", model_text, flags=re.I).strip()


def canonical_model(text: str) -> str | None:
    matches = list(MODEL_PATTERN.finditer(text))
    if not matches:
        return None
    return clean(strip_storage(clean(matches[-1].group(1))))




def parse_offer_detail(headline: str, detail_text: str, brand: str, source: str) -> dict | None:
    detail_text = clean(detail_text)
    price_match = PRICE_MODEL_PATTERN.search(detail_text)
    if not price_match:
        return None
    model = canonical_model(price_match.group(2))
    if not model:
        return None
    retail = round(float(price_match.group(1).replace(",", "")), 2)

    credit_match = CREDIT_PATTERN.search(detail_text)
    credit = min(round(float(credit_match.group(1).replace(",", "")), 2), retail) if credit_match else 0.0
    monthly = round(max(0.0, retail - credit) / TERM_MONTHS, 2)

    no_trade_in = bool(re.search(r"no trade-in needed", detail_text, re.I))
    trade_in = not no_trade_in and bool(re.search(r"trade-in\s*\(e\.g\.,\s*Save \$", detail_text, re.I))
    mechanic = "Trade-in" if trade_in else "EIP"

    plan_match = PLAN_PATTERN.search(detail_text)
    plan = f"${plan_match.group(1)}+/mo. plan w/AutoPay" if plan_match else "Eligible T-Mobile plan"

    tiv = None
    if trade_in:
        save_values = TRADE_IN_SAVE_PATTERN.findall(detail_text)
        if save_values:
            tiv = " / ".join(f"${value}: {clean(name)}" for value, name in save_values[:3])

    any_condition = bool(re.search(r"any condition", detail_text, re.I))
    offer_id = hashlib.sha256(f"T-Mobile|{brand}|{model}|{retail}|{mechanic}".encode()).hexdigest()[:16]

    tiers = qualifying_tiers(detail_text)
    tiers.add("high")  # every offer's own advertised price is at least valid for the top tier
    tier_ladder = {tier: (monthly if tier in tiers else None) for tier in ("low", "mid", "high")}

    def tier_text(value: float | None) -> str:
        if value is None:
            return "N/C"
        return "free" if value == 0 else f"${value:g}"

    return {
        "id": f"tmobile-{offer_id}", "offerId": offer_id, "carrier": "T-Mobile", "brand": brand,
        "model": model, "mechanic": mechanic,
        "internalShorthand": " / ".join(tier_text(tier_ladder[k]) for k in ("high", "mid", "low")),
        "anyCondition": any_condition, "tiv": tiv, "eligibleGenerations": None,
        "tierLadder": tier_ladder,
        "headline": clean(headline)[:160], "verizonDisplay": f"${monthly:g}/mo after {TERM_MONTHS}-month bill credits",
        "rawText": detail_text[:2400], "credit": credit, "monthly": monthly, "retail": retail,
        "plan": plan, "lineAction": "New line / port-in" if "port-in" in detail_text.lower() else "Offer-dependent",
        "tradeIn": trade_in, "portIn": None, "term": TERM_MONTHS, "confidence": "High",
        "status": "Live direct", "source": source, "sourceLabel": f"T-Mobile {brand} offers",
        "observed": datetime.now(timezone.utc).date().isoformat(),
        "note": "Direct T-Mobile offer card and full-terms modal.",
        "detailScreenshot": None, "detailText": None,
    }


def collect_brand(page, brand: str, url: str, evidence_dir: Path) -> list[dict]:
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(7000)
    page.screenshot(path=evidence_dir / f"{brand.lower()}-grid.jpg", type="jpeg", quality=72, full_page=True)

    offers: list[dict] = []
    seen: set[str] = set()
    controls = page.get_by_text("Get full terms", exact=True)
    for index in range(controls.count()):
        control = controls.nth(index)
        headline = control.evaluate(r"""el => {
          let node = el;
          for (let depth = 0; depth < 8 && node; depth++) {
            const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
            if (text.length > 20 && text.length < 700) return text;
            node = node.parentElement;
          }
          return '';
        }""")
        try:
            control.click(timeout=5000)
            page.wait_for_timeout(900)
            dialogs = page.locator("[role='dialog']")
            visible_dialog = next((dialog for dialog in dialogs.all() if dialog.is_visible()), None)
            if visible_dialog:
                detail_text = visible_dialog.inner_text(timeout=5000)
                offer = parse_offer_detail(headline, detail_text, brand, url)
                if offer and offer["id"] not in seen:
                    filename = f"{offer['offerId']}.jpg"
                    (evidence_dir / "details").mkdir(parents=True, exist_ok=True)
                    visible_dialog.screenshot(path=evidence_dir / "details" / filename, type="jpeg", quality=82)
                    offer["detailScreenshot"] = f"./tmobile-evidence/details/{filename}"
                    offer["detailText"] = detail_text[:20000]
                    offers.append(offer)
                    seen.add(offer["id"])
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
        except Exception:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
    return offers


def collect_tmobile(output_path: Path, evidence_dir: Path) -> dict:
    from playwright.sync_api import sync_playwright

    evidence_dir.mkdir(parents=True, exist_ok=True)
    offers: list[dict] = []
    sources = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(locale="en-US", viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        for brand, url in BRAND_URLS.items():
            brand_offers = collect_brand(page, brand, url, evidence_dir)
            offers.extend(brand_offers)
            sources.append({"label": f"T-Mobile {brand}", "url": url, "priority": "P0", "capture": f"{len(brand_offers)} direct offer cards"})
        browser.close()

    payload = {
        "meta": {"carrier": "T-Mobile", "market": "US", "snapshotDate": datetime.now(timezone.utc).date().isoformat(),
                 "zipCode": "Public national listing", "verification": "Direct T-Mobile offer cards and full-terms modal"},
        "promotions": offers, "plans": [], "targets": sources,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload
