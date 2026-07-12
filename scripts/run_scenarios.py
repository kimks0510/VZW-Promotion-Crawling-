from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from vzw_promo_tracker.scenario_runner import run
from vzw_promo_tracker.db import connect
import json

output = ROOT / "public/data/scenario-results.json"
run(ROOT / "config/purchase_scenarios.json", output, ROOT / "public/scenario-evidence")
payload = json.loads(output.read_text(encoding="utf-8"))
with connect(ROOT / "data/promotions.sqlite") as conn:
    latest = conn.execute("SELECT id FROM crawl_runs ORDER BY id DESC LIMIT 1").fetchone()
    crawl_run_id = latest["id"] if latest else None
    for item in payload["results"]:
        conn.execute(
            """INSERT OR REPLACE INTO scenario_runs
            (scenario_id,crawl_run_id,source_url,requested_state,observed_state,status,
             final_price_usd,terms_text,started_at,completed_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (item["scenarioId"],crawl_run_id,item["sourceUrl"],json.dumps(item["requestedState"]),
             json.dumps(item["observedState"]),item["status"],item["finalPrice"],item["terms"],
             item["startedAt"],item["completedAt"]),
        )
        conn.execute("DELETE FROM scenario_steps WHERE scenario_id = ?", (item["scenarioId"],))
        for order, step in enumerate(item["steps"], 1):
            conn.execute(
                """INSERT INTO scenario_steps
                (scenario_id,step_order,step_name,requested_value,observed_value,verified,screenshot_path,error)
                VALUES (?,?,?,?,?,?,?,?)""",
                (item["scenarioId"],order,step["name"],step["requested"],step["observed"],
                 int(step["verified"]),step["screenshot"],step["error"]),
            )
