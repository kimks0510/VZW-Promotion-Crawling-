from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from vzw_promo_tracker.att_collector import collect_att


if __name__ == "__main__":
    result = collect_att(ROOT / "public" / "data" / "att-snapshot.json", ROOT / "public" / "att-evidence")
    details = sum(bool(item.get("detailScreenshot")) for item in result["promotions"])
    print(f"AT&T collection complete: {len(result['promotions'])} offers, {details} detail snapshots")
