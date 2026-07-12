from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from vzw_promo_tracker.grid_collector import collect_grid


if __name__ == "__main__":
    result = collect_grid(
        ROOT / "public" / "data" / "grid-offers.json",
        ROOT / "public" / "grid-evidence",
    )
    print(
        f"Grid collection complete: {len(result['offers'])} cards; "
        f"{sum(x['detailsConfirmed'] for x in result['coverage'].values())} details confirmed"
    )
