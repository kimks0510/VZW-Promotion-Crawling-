"""One-time backfill: walk every historical git commit that touched
grid-offers.json / att-snapshot.json and turn each day's real collector
output into a dated history entry, instead of only ever having "today".
T-Mobile has no prior history (its collector was only added today), so it
is not backfilled here; its trend will build up day by day from now on.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from update_history import compute_from_grid_offers, compute_from_promotions, upsert  # noqa: E402


def dated_commits(path: str) -> list[tuple[str, str]]:
    output = subprocess.run(
        ["git", "log", "--follow", "--format=%h %ad", "--date=short", "--", path],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    by_date: dict[str, str] = {}
    for line in output.splitlines():
        commit, date = line.split(" ", 1)
        by_date.setdefault(date, commit)  # git log is newest-first; first hit per date wins
    return sorted(by_date.items())


def show(commit: str, path: str) -> str | None:
    result = subprocess.run(
        ["git", "show", f"{commit}:{path}"], cwd=ROOT, capture_output=True, text=True,
    )
    return result.stdout if result.returncode == 0 else None


def backfill_grid() -> int:
    path = "public/data/grid-offers.json"
    count = 0
    for date, commit in dated_commits(path):
        raw = show(commit, path)
        if not raw:
            continue
        try:
            grid = json.loads(raw)
        except json.JSONDecodeError:
            continue
        offers = grid.get("offers") or []
        if not offers:
            continue
        metrics = compute_from_grid_offers(offers)
        upsert(ROOT / "public/data/history.json", date, metrics, path, "Direct automated Verizon Grid collection")
        count += 1
    return count


def backfill_att() -> int:
    path = "public/data/att-snapshot.json"
    count = 0
    for date, commit in dated_commits(path):
        raw = show(commit, path)
        if not raw:
            continue
        try:
            snapshot = json.loads(raw)
        except json.JSONDecodeError:
            continue
        promotions = snapshot.get("promotions") or []
        if not promotions:
            continue
        snapshot_date = snapshot.get("meta", {}).get("snapshotDate", date)
        metrics = compute_from_promotions(promotions)
        upsert(ROOT / "public/data/att-history.json", snapshot_date, metrics, path, "Direct automated AT&T collection")
        count += 1
    return count


if __name__ == "__main__":
    grid_count = backfill_grid()
    att_count = backfill_att()
    print(f"Backfilled {grid_count} Verizon Grid days, {att_count} AT&T days from git history.")
