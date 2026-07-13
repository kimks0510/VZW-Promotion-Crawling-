import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup


BRAND_URLS = {
    "Apple": "https://www.att.com/buy/phones/browse/apple/",
    "Samsung": "https://www.att.com/buy/phones/browse/samsung/",
    "Google": "https://www.att.com/buy/phones/browse/google/",
    "Motorola": "https://www.att.com/buy/phones/browse/motorola/",
}
MODEL_PATTERN = re.compile(
    r"(iPhone\s+[A-Za-z0-9 +.-]+|Galaxy\s+[A-Za-z0-9 +.-]+|Pixel\s+[A-Za-z0-9 +.-]+|(?:Motorola\s+)?(?:moto|razr|edge)\s+[A-Za-z0-9 +.-]+)",
    re.I,
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9"})
    with urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_card_text(text: str, brand: str, source: str) -> dict | None:
    text = clean(text)
    model_matches = list(MODEL_PATTERN.finditer(text))
    price_match = re.search(
        r"Price was \$([0-9,.]+) per month, now (?:As low as )?\$([0-9,.]+) per month",
        text,
        re.I,
    )
    if not model_matches or not price_match:
        return None
    model = re.split(r"\s+Price was\b", clean(model_matches[-1].group(1)), flags=re.I)[0]
    regular = float(price_match.group(1).replace(",", ""))
    monthly = float(price_match.group(2).replace(",", ""))
    retail = round(regular * 36, 2)
    credit = round((regular - monthly) * 36, 2)
    trade_in = bool(re.search(r"eligible trade-in|with trade-in|trade-in req", text, re.I))
    new_line = bool(re.search(r"new line|new lines only", text, re.I))
    mechanic = "Trade-in" if trade_in else "EIP"
    offer_id = hashlib.sha256(f"AT&T|{brand}|{model}|{monthly}|{mechanic}".encode()).hexdigest()[:16]
    return {
        "id": f"att-{offer_id}", "offerId": offer_id, "carrier": "AT&T", "brand": brand,
        "model": model, "mechanic": mechanic, "internalShorthand": f"${monthly:g} / N/C / N/C",
        "anyCondition": bool(re.search(r"any condition", text, re.I)), "tiv": None,
        "eligibleGenerations": None, "tierLadder": {"low": None, "mid": None, "high": monthly},
        "headline": f"${credit:,.0f} off", "verizonDisplay": f"${monthly:g}/mo after 36-month credits",
        "rawText": text[:2400], "credit": credit, "monthly": monthly, "retail": retail,
        "plan": "Eligible unlimited plan", "lineAction": "New line" if new_line else "Offer-dependent",
        "tradeIn": trade_in, "portIn": None, "term": 36, "confidence": "High",
        "status": "Live direct", "source": source, "sourceLabel": f"AT&T {brand} phones",
        "observed": datetime.now(timezone.utc).date().isoformat(),
        "note": "Direct AT&T Grid card and offer terms.", "detailScreenshot": None, "detailText": None,
    }


def parse_brand_page(raw_html: str, brand: str, source: str) -> list[dict]:
    soup = BeautifulSoup(raw_html, "html.parser")
    offers = []
    seen = set()
    price_nodes = soup.find_all(string=lambda value: value and "Price was $" in value and "per month, now" in value)
    for node in price_nodes:
        parent = node.parent
        while parent:
            text = clean(" ".join(parent.stripped_strings))
            if "See offer details" in text and len(text) < 3000:
                break
            parent = parent.parent
        offer = parse_card_text(text, brand, source) if parent else None
        if offer and offer["id"] not in seen:
            offers.append(offer)
            seen.add(offer["id"])
    return offers


def apply_detail_terms(offer: dict, detail_text: str) -> None:
    any_condition = bool(re.search(r"any year,? (?:in )?any condition", detail_text, re.I))
    condition_excluded = offer["credit"] >= 1249 and bool(re.search(
        r"any year,? (?:in )?any condition does not apply", detail_text, re.I
    ))
    offer["anyCondition"] = any_condition and not condition_excluded
    value_match = re.search(
        r"Value 2\.0 plan[^.]{0,180}?(?:max(?:imum)? credit of )?up to \$([0-9,]+)",
        detail_text,
        re.I,
    )
    extra_or_higher = bool(re.search(r"Extra 2\.0 (?:plan )?or higher", detail_text, re.I))
    if extra_or_higher:
        offer["tierLadder"]["high"] = offer["monthly"]
        offer["tierLadder"]["mid"] = offer["monthly"]
        offer["plan"] = "Extra 2.0 or higher for maximum credit"
    if value_match:
        value_credit = float(value_match.group(1).replace(",", ""))
        offer["tierLadder"]["low"] = round(max(0, offer["retail"] - value_credit) / 36, 2)
        offer["plan"] += f"; Value 2.0 up to ${value_credit:,.0f} credit"

    tiv_values = [int(value.replace(",", "")) for value in re.findall(
        r"(?:trade-in value|Trade-In value|TiV)[^$]{0,45}\$([0-9,]+)", detail_text, re.I
    )]
    if tiv_values:
        if offer["credit"] >= 1249 and 200 in tiv_values:
            offer["tiv"] = "$200"
        elif offer["credit"] >= 1049 and offer["credit"] < 1100 and 35 in tiv_values:
            offer["tiv"] = "$35"
        else:
            offer["tiv"] = " / ".join(f"${value}" for value in sorted(set(tiv_values)))

    def tier_text(value):
        if value is None:
            return "N/C"
        if value == 0:
            return "free"
        return f"${value:g}"

    ladder = offer["tierLadder"]
    offer["internalShorthand"] = " / ".join(
        tier_text(ladder[key]) for key in ("high", "mid", "low")
    )


def capture_brand_evidence(offers: list[dict], output_dir: Path) -> None:
    from playwright.sync_api import sync_playwright

    output_dir.mkdir(parents=True, exist_ok=True)
    offer_map = {(item["brand"], clean(item["model"]).lower()): item for item in offers}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(locale="en-US", viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        for brand, url in BRAND_URLS.items():
            page.goto(url, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(7000)
            page.screenshot(path=output_dir / f"{brand.lower()}-grid.jpg", type="jpeg", quality=72, full_page=True)
            controls = page.get_by_text("See offer details", exact=True)
            for index in range(controls.count()):
                control = controls.nth(index)
                card_text = control.evaluate(r"""el => {
                  let node = el;
                  while (node && node !== document.body) {
                    const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
                    if (/Price was \$/i.test(text) && text.length < 3000) return text;
                    node = node.parentElement;
                  }
                  return '';
                }""")
                parsed = parse_card_text(card_text, brand, url)
                if not parsed:
                    continue
                target = offer_map.get((brand, clean(parsed["model"]).lower()))
                if not target:
                    continue
                try:
                    control.click(timeout=5000)
                    page.wait_for_timeout(600)
                    dialogs = page.locator("[role='dialog']")
                    visible_dialog = next((dialog for dialog in dialogs.all() if dialog.is_visible()), None)
                    if visible_dialog:
                        initial_filename = f"{target['offerId']}-offer.jpg"
                        visible_dialog.screenshot(path=output_dir / "details" / initial_filename, type="jpeg", quality=82)
                        target["detailInitialScreenshot"] = f"./att-evidence/details/{initial_filename}"
                        target["detailScreenshot"] = target["detailInitialScreenshot"]
                        initial_text = clean(visible_dialog.inner_text(timeout=5000))
                        target["detailText"] = initial_text[:20000]
                        target["additionalTermsExpanded"] = False

                        additional = visible_dialog.get_by_text(
                            re.compile(r"See additional (?:terms|details)", re.I)
                        )
                        try:
                            if additional.count() > 0 and additional.first.is_visible():
                                additional.first.click(timeout=5000)
                                page.wait_for_timeout(500)
                                expanded_text = clean(visible_dialog.inner_text(timeout=5000))
                                expanded_filename = f"{target['offerId']}-expanded.jpg"
                                target["detailText"] = expanded_text[:20000]
                                target["additionalTermsExpanded"] = True
                                try:
                                    visible_dialog.screenshot(
                                        path=output_dir / "details" / expanded_filename,
                                        type="jpeg",
                                        quality=82,
                                        animations="disabled",
                                        timeout=8000,
                                    )
                                except Exception:
                                    page.screenshot(
                                        path=output_dir / "details" / expanded_filename,
                                        type="jpeg",
                                        quality=82,
                                        full_page=False,
                                        animations="disabled",
                                        timeout=8000,
                                    )
                                target["detailScreenshot"] = f"./att-evidence/details/{expanded_filename}"
                        except Exception as error:
                            target["additionalTermsError"] = type(error).__name__

                        apply_detail_terms(target, target["detailText"])
                    page.keyboard.press("Escape")
                except Exception:
                    page.keyboard.press("Escape")
        browser.close()


def collect_att(output_path: Path, evidence_dir: Path) -> dict:
    offers = []
    sources = []
    for brand, url in BRAND_URLS.items():
        raw_html = fetch_html(url)
        brand_offers = parse_brand_page(raw_html, brand, url)
        offers.extend(brand_offers)
        sources.append({"label": f"AT&T {brand}", "url": url, "priority": "P0", "capture": f"{len(brand_offers)} direct offer cards"})
    (evidence_dir / "details").mkdir(parents=True, exist_ok=True)
    capture_brand_evidence(offers, evidence_dir)
    payload = {
        "meta": {"carrier": "AT&T", "market": "US", "snapshotDate": datetime.now(timezone.utc).date().isoformat(),
                 "zipCode": "Public national listing", "verification": "Direct AT&T brand Grid and offer details"},
        "promotions": offers, "plans": [], "targets": sources,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload
