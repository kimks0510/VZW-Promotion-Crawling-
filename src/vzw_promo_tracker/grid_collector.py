import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse


GRID_URL = "https://www.verizon.com/smartphones/"
SUPPORTED_BRANDS = ("Apple", "Samsung", "Google", "Motorola")
DETAIL_PATH = "/us/promotion/details"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def money(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text, re.I)
    return float(match.group(1).replace(",", "")) if match else None


def infer_brand(text: str) -> str | None:
    lowered = text.lower()
    aliases = {
        "Apple": ("apple", "iphone"),
        "Samsung": ("samsung", "galaxy"),
        "Google": ("google", "pixel"),
        "Motorola": ("motorola", "moto ", "razr"),
    }
    return next((brand for brand, words in aliases.items() if any(word in lowered for word in words)), None)


def parse_detail_url(url: str | None) -> dict:
    if not url:
        return {}
    query = parse_qs(urlparse(url).query)
    return {
        key: query.get(key, [None])[0]
        for key in ("promoId", "deviceId", "skuId", "flow", "loanTerm")
        if query.get(key)
    }


@dataclass
class GridOffer:
    offer_id: str
    brand: str
    model: str
    advertised_monthly: float | None
    regular_monthly: float | None
    retail_price: float | None
    saving: float | None
    term_months: int | None
    card_text: str
    product_url: str | None
    detail_url: str | None
    detail_params: dict
    detail_text: str | None
    evidence_level: str
    detail_error: str | None


def parse_card(card_text: str, product_url: str | None = None, detail_url: str | None = None) -> GridOffer | None:
    text = clean_text(card_text)
    brand = infer_brand(text)
    model_match = re.search(
        r"(?:Apple\s+)?iPhone\s+[A-Za-z0-9 +.-]+|(?:Samsung\s+)?Galaxy\s+[A-Za-z0-9 +.-]+|"
        r"(?:Google\s+)?Pixel\s+[A-Za-z0-9 +.-]+|(?:Motorola\s+)?(?:moto|razr)\s+[A-Za-z0-9 +.-]+",
        text,
        re.I,
    )
    if not brand or not model_match:
        return None
    model = clean_text(model_match.group(0))
    model = re.split(r"\s+(?:Starts|starting|was|Retail|Save|Details)\b", model, flags=re.I)[0]
    advertised = money(r"Starts?\s+at\s+\$([0-9,.]+)\s*/?mo", text)
    regular = money(r"was\s+\$([0-9,.]+)\s*/?mo", text)
    if regular is None:
        monthly_values = [float(value.replace(",", "")) for value in re.findall(r"\$([0-9,.]+)\s*/?mo", text, re.I)]
        regular = monthly_values[1] if len(monthly_values) > 1 else None
    retail = money(r"Retail\s+price\s*:?\s*\$([0-9,.]+)", text)
    saving = money(r"Save\s+\$([0-9,.]+)", text)
    term_match = re.search(r"(?:for\s+)?(24|30|36)\s+months?", text, re.I)
    identity = f"{brand}|{model}|{advertised}|{retail}|{detail_url or ''}"
    return GridOffer(
        offer_id=hashlib.sha256(identity.encode()).hexdigest()[:16],
        brand=brand,
        model=model,
        advertised_monthly=advertised,
        regular_monthly=regular,
        retail_price=retail,
        saving=saving,
        term_months=int(term_match.group(1)) if term_match else None,
        card_text=text[:2000],
        product_url=product_url,
        detail_url=detail_url,
        detail_params=parse_detail_url(detail_url),
        detail_text=None,
        evidence_level="card_confirmed",
        detail_error=None,
    )


def _card_candidates(page):
    return page.locator("[aria-label^='see details about ']")


def collect_grid(output_path: Path, screenshot_dir: Path) -> dict:
    from playwright.sync_api import sync_playwright

    screenshot_dir.mkdir(parents=True, exist_ok=True)
    network_observations = []
    offers: list[GridOffer] = []
    errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(locale="en-US", viewport={"width": 1440, "height": 1000})
        page = context.new_page()

        def record_response(response):
            if any(fragment in response.url for fragment in ("/productList", "/us/json/smartphones", "/getCradleData")):
                item = {"url": response.url, "status": response.status, "contentType": response.headers.get("content-type")}
                try:
                    body = response.body()
                    item["bytes"] = len(body)
                    item["sha256"] = hashlib.sha256(body).hexdigest()
                except Exception as exc:
                    item["error"] = str(exc)
                network_observations.append(item)

        page.on("response", record_response)
        response = page.goto(GRID_URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(8000)
        page.screenshot(path=screenshot_dir / "all-brands-grid.jpg", type="jpeg", quality=70, full_page=True)

        controls = _card_candidates(page)
        for index in range(controls.count()):
            control = controls.nth(index)
            try:
                label = control.get_attribute("aria-label") or ""
                card = control.locator("xpath=ancestor::*[self::article or @data-testid][1]")
                if not card.count():
                    card = control.locator("xpath=ancestor::div[.//a or .//button][1]")
                card_text = card.inner_text(timeout=5000) if card.count() else label
                product_link = card.locator("a[href*='/smartphones/']").first if card.count() else None
                product_url = product_link.get_attribute("href") if product_link and product_link.count() else None
                if product_url:
                    product_url = urljoin(GRID_URL, product_url)

                detail_url = None
                before = set(frame.url for frame in page.frames)
                control.click(timeout=5000)
                page.wait_for_timeout(1500)
                for frame in page.frames:
                    if DETAIL_PATH in frame.url and frame.url not in before:
                        detail_url = urljoin(GRID_URL, frame.url)
                        break
                if not detail_url:
                    iframe = page.locator(f"iframe[src*='{DETAIL_PATH}']").last
                    if iframe.count():
                        detail_url = urljoin(GRID_URL, iframe.get_attribute("src"))

                offer = parse_card(card_text or label, product_url, detail_url)
                if offer:
                    if detail_url:
                        detail_frame = next((frame for frame in page.frames if DETAIL_PATH in frame.url), None)
                        detail_text = clean_text(detail_frame.locator("body").inner_text(timeout=5000)) if detail_frame else ""
                        if detail_text and "unable to process your request" not in detail_text.lower():
                            offer.detail_text = detail_text[:12000]
                            offer.evidence_level = "details_confirmed"
                        else:
                            offer.detail_error = detail_text[:500] or "Details iframe returned no readable terms"
                    offers.append(offer)
                page.keyboard.press("Escape")
                page.wait_for_timeout(250)
            except Exception as exc:
                errors.append(f"card {index}: {exc}")
                page.keyboard.press("Escape")

        payload = {
            "generatedAt": utc_now(),
            "sourceUrl": GRID_URL,
            "statusCode": response.status if response else None,
            "brands": list(SUPPORTED_BRANDS),
            "coverage": {
                brand: {
                    "cardConfirmed": sum(item.brand == brand for item in offers),
                    "detailsConfirmed": sum(item.brand == brand and item.evidence_level == "details_confirmed" for item in offers),
                }
                for brand in SUPPORTED_BRANDS
            },
            "networkObservations": network_observations,
            "offers": [asdict(item) for item in offers],
            "errors": errors,
        }
        browser.close()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload
