"""Build the Verizon Matrix snapshot directly from grid-offers.json, the real
automated Grid API capture, instead of a manually curated file. Verizon's PDP
purchase flow (storage/customer/plan selection) is gated behind a "not
authorized to make purchases" check that appears to require a US-based
session, so per-tier (High/Mid/Low) pricing cannot be automated yet; this
script uses the rough overview data that IS publicly visible (advertised
monthly price, retail, saving, term) for every model in the current catalog,
which is enough to keep the model list itself current (new launches like the
Z Fold8 line appear automatically) without fabricating unverified fields.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"

BRAND_PREFIX = re.compile(r"^(Samsung|Apple|Google|Motorola)\s+", re.I)


def strip_brand(brand: str, model: str) -> str:
    stripped = BRAND_PREFIX.sub("", model)
    return stripped if stripped != model else model


def build_promotion(brand: str, model: str, offers: list[dict]) -> dict:
    best = max(offers, key=lambda o: o.get("saving") or 0)
    text = (best.get("card_text") or "").strip()
    trade_in = bool(re.search(r"trade[- ]?in", text, re.I))
    any_condition = bool(re.search(r"any condition", text, re.I))
    mechanic = "Trade-in" if trade_in else "EIP"
    monthly = best.get("advertised_monthly")
    retail = best.get("retail_price")
    credit = best.get("saving")
    term = best.get("term_months") or 36
    offer_id = hashlib.sha256(f"Verizon|{brand}|{model}|{best.get('offer_id')}".encode()).hexdigest()[:16]
    headline = text or (f"Save ${credit:,.0f}" if credit else "See current offer")
    display = f"Starts at ${monthly:g}/mo" if monthly is not None else "Price not verified"
    if retail is not None:
        display += f" · Retail ${retail:,.2f}"
    if credit is not None:
        display += f" · Save ${credit:,.0f}"
    return {
        "id": f"verizon-{offer_id}", "offerId": offer_id, "brand": brand,
        "model": strip_brand(brand, model), "mechanic": mechanic,
        "internalShorthand": (f"${monthly:g} / Not verified / Not verified" if monthly is not None else "Not verified"),
        "anyCondition": any_condition, "tiv": None, "eligibleGenerations": None,
        "tierLadder": {"low": None, "mid": None, "high": monthly},
        "headline": headline[:160], "verizonDisplay": display,
        "rawText": text[:2400], "credit": credit, "monthly": monthly, "retail": retail,
        "plan": "Eligible unlimited plan", "lineAction": "Offer-dependent",
        "tradeIn": trade_in, "portIn": None, "term": term, "confidence": "High",
        "status": "Live direct", "source": best.get("product_url") or "https://www.verizon.com/smartphones/",
        "sourceLabel": f"Verizon {brand} Grid API",
        "observed": datetime.now(timezone.utc).date().isoformat(),
        "note": (
            "Direct Verizon Grid API capture. Per-tier (High/Mid/Low) plan pricing "
            "requires an authorized US purchase session and is not yet automated; "
            "only the best observed advertised price is shown."
        ),
    }


def main() -> None:
    grid_path = DATA / "grid-offers.json"
    if not grid_path.exists():
        raise SystemExit("grid-offers.json does not exist. Run scripts/collect_grid_offers.py first.")
    grid = json.loads(grid_path.read_text(encoding="utf-8"))
    offers = grid.get("offers") or []
    if not offers:
        raise SystemExit("grid-offers.json has no offers (last collection run failed); refusing to overwrite snapshot.json.")

    grouped: dict[tuple[str, str], list[dict]] = {}
    for offer in offers:
        if not offer.get("brand") or not offer.get("model"):
            continue
        grouped.setdefault((offer["brand"], offer["model"]), []).append(offer)

    promotions = [build_promotion(brand, model, group) for (brand, model), group in grouped.items()]
    promotions.sort(key=lambda p: (p["brand"], p["model"]))

    existing_path = DATA / "snapshot.json"
    existing = json.loads(existing_path.read_text(encoding="utf-8")) if existing_path.exists() else {}
    payload = {
        "meta": {
            "carrier": "Verizon", "market": "US Consumer",
            "snapshotDate": datetime.now(timezone.utc).date().isoformat(),
            "timezone": "UTC",
            "verification": "Direct Verizon Grid API capture (public catalog listing)",
            "disclaimer": (
                "Offers vary by customer type, ZIP code, inventory, line action, plan, "
                "port-in and trade-in eligibility. Per-tier plan pricing is not yet "
                "automated because Verizon's PDP purchase flow requires an authorized "
                "US session; confirm exact tier pricing before internal reporting."
            ),
        },
        "promotions": promotions,
        "plans": existing.get("plans", []),
        "targets": existing.get("targets", []),
    }
    existing_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {existing_path} ({len(promotions)} vendor models from grid-offers.json)")


if __name__ == "__main__":
    main()
