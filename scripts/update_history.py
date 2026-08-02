"""Append/update today's real collection metrics into each carrier's weekly
history file, so the dashboard Overview trend reflects actual crawl runs
instead of a manually curated snapshot. Existing hand-curated Verizon
entries (2026-06-21, 2026-07-12) are preserved; from today forward, Verizon's
points are computed from the real grid-offers.json collector output, matching
how AT&T and T-Mobile already compute theirs from their own collectors.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"


def today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def compute_from_promotions(promotions: list[dict]) -> dict:
    brands = sorted({p["brand"] for p in promotions if p.get("brand")})
    brand_credit = {b: max((p.get("credit") or 0) for p in promotions if p["brand"] == b) for b in brands}
    brand_metrics = {
        b: {
            "offers": sum(1 for p in promotions if p["brand"] == b),
            "free": sum(1 for p in promotions if p["brand"] == b and p.get("monthly") == 0),
        }
        for b in brands
    }
    mechanics = {"EIP": 0, "Trade-in": 0, "BYOD+": 0}
    for p in promotions:
        mechanic = p.get("mechanic") or "EIP"
        mechanics[mechanic] = mechanics.get(mechanic, 0) + 1
    return {
        "trackedOffers": len(promotions),
        "maxCredit": max(brand_credit.values(), default=0),
        "freeOffers": sum(1 for p in promotions if p.get("monthly") == 0),
        "mechanics": mechanics,
        "brands": brand_credit,
        "brandMetrics": brand_metrics,
    }


def compute_from_grid_offers(offers: list[dict]) -> dict:
    brands = sorted({o["brand"] for o in offers if o.get("brand")})
    brand_saving = {b: max((o.get("saving") or 0) for o in offers if o["brand"] == b) for b in brands}
    brand_metrics = {
        b: {
            "offers": sum(1 for o in offers if o["brand"] == b),
            "free": sum(1 for o in offers if o["brand"] == b and o.get("advertised_monthly") == 0),
        }
        for b in brands
    }
    return {
        "trackedOffers": len(offers),
        "maxCredit": max(brand_saving.values(), default=0),
        "freeOffers": sum(1 for o in offers if o.get("advertised_monthly") == 0),
        "mechanics": None,  # Verizon's Grid collector does not classify trade-in vs EIP per card.
        "brands": brand_saving,
        "brandMetrics": brand_metrics,
    }


def upsert(history_path: Path, date: str, metrics: dict, source: str, quality: str) -> None:
    if history_path.exists():
        history = json.loads(history_path.read_text(encoding="utf-8"))
    else:
        history = {"cadence": "Weekly", "snapshots": [], "movements": []}

    snapshots = [s for s in history["snapshots"] if s["date"] != date]
    snapshots.append({"date": date, "source": source, "quality": quality, **metrics})
    snapshots.sort(key=lambda s: s["date"])
    history["snapshots"] = snapshots

    if len(snapshots) >= 2:
        prev, curr = snapshots[-2], snapshots[-1]
        movements = []
        for brand in curr["brands"]:
            prev_val, curr_val = prev["brands"].get(brand), curr["brands"].get(brand)
            if prev_val is None or curr_val is None:
                continue
            movements.append({
                "metric": f"{brand} max credit", "from": prev_val, "to": curr_val, "unit": "USD",
                "interpretation": (
                    f"Max observed credit moved from ${prev_val:,.0f} to ${curr_val:,.0f} "
                    f"between {prev['date']} ({prev['source']}) and {curr['date']} ({curr['source']})."
                ),
            })
        movements.append({
            "metric": "Tracked offers", "from": prev["trackedOffers"], "to": curr["trackedOffers"], "unit": "count",
            "interpretation": f"Tracked offer count moved from {prev['trackedOffers']} to {curr['trackedOffers']}.",
        })
        history["movements"] = movements

    history_path.parent.mkdir(parents=True, exist_ok=True)
    history_path.write_text(json.dumps(history, indent=2), encoding="utf-8")


def main() -> None:
    date = today()
    updated = []

    grid_path = DATA / "grid-offers.json"
    if grid_path.exists():
        grid = json.loads(grid_path.read_text(encoding="utf-8"))
        if grid.get("offers"):
            metrics = compute_from_grid_offers(grid["offers"])
            upsert(DATA / "history.json", date, metrics, "public/data/grid-offers.json", "Direct automated Verizon Grid collection")
            updated.append("Verizon")

    carrier_files = [
        ("AT&T", "att-snapshot.json", "att-history.json"),
        ("T-Mobile", "tmobile-snapshot.json", "tmobile-history.json"),
    ]
    for carrier, snapshot_name, history_name in carrier_files:
        snapshot_path = DATA / snapshot_name
        if not snapshot_path.exists():
            continue
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
        if not snapshot.get("promotions"):
            continue
        metrics = compute_from_promotions(snapshot["promotions"])
        snapshot_date = snapshot["meta"].get("snapshotDate", date)
        upsert(
            DATA / history_name, snapshot_date, metrics,
            f"public/data/{snapshot_name}", f"Direct automated {carrier} collection",
        )
        updated.append(carrier)

    print(f"History updated for: {', '.join(updated) if updated else 'nothing (no collector output found)'}")


if __name__ == "__main__":
    main()
