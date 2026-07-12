import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "promotions.sqlite"
OUTPUT_PATH = ROOT / "public" / "data" / "collection-status.json"


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit("Crawler database does not exist. Run scripts/crawl.py first.")

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        run = conn.execute(
            "SELECT * FROM crawl_runs ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if run is None:
            raise SystemExit("Crawler database has no runs.")

        sources = conn.execute(
            """
            SELECT category, url, fetched_at, status_code, content_hash,
                   LENGTH(raw_html) AS html_bytes,
                   LENGTH(raw_text) AS text_chars
            FROM source_snapshots
            WHERE run_id = ?
            ORDER BY category
            """,
            (run["id"],),
        ).fetchall()

    payload = {
        "runId": run["id"],
        "startedAt": run["started_at"],
        "sourceCount": run["source_count"],
        "candidateCount": run["candidate_count"],
        "runnerRegion": "US GitHub-hosted runner",
        "sources": [
            {**dict(source), "screenshot": f"./screenshots/{source['category']}.jpg"}
            for source in sources
        ],
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
