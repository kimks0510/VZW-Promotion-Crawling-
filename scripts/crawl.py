from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from vzw_promo_tracker.crawler import run_crawl


if __name__ == "__main__":
    db_path = ROOT / "data" / "promotions.sqlite"
    targets_path = ROOT / "config" / "targets.json"
    run_crawl(targets_path=targets_path, db_path=db_path)

