from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from vzw_promo_tracker.tmobile_collector import collect_tmobile


if __name__ == "__main__":
    result = collect_tmobile(ROOT / "public" / "data" / "tmobile-snapshot.json", ROOT / "public" / "tmobile-evidence")
    details = sum(bool(item.get("detailScreenshot")) for item in result["promotions"])
    print(f"T-Mobile collection complete: {len(result['promotions'])} offers, {details} detail snapshots")
