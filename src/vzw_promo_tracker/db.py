import sqlite3
from pathlib import Path


SCHEMA = """
CREATE TABLE IF NOT EXISTS crawl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    source_count INTEGER NOT NULL DEFAULT 0,
    candidate_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS source_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    carrier TEXT NOT NULL,
    market TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    status_code INTEGER,
    content_hash TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    raw_html TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES crawl_runs(id)
);

CREATE TABLE IF NOT EXISTS promotion_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    snapshot_id INTEGER NOT NULL,
    carrier TEXT NOT NULL,
    market TEXT NOT NULL,
    category TEXT NOT NULL,
    source_url TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    offer_type TEXT,
    max_credit_usd REAL,
    term_months INTEGER,
    requires_trade_in INTEGER,
    requires_new_line INTEGER,
    requires_unlimited_plan INTEGER,
    source_text TEXT NOT NULL,
    extracted_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES crawl_runs(id),
    FOREIGN KEY (snapshot_id) REFERENCES source_snapshots(id)
);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn

