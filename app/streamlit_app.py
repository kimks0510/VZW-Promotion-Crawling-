from pathlib import Path
import sqlite3

import pandas as pd
import streamlit as st


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "promotions.sqlite"
EXPORT_PATH = ROOT / "exports" / "current_verizon_promotions_2026-06-21.csv"


st.set_page_config(page_title="VZW Promotion Tracker", layout="wide")
st.title("VZW Promotion Tracker")

curated_tab, crawler_tab, history_tab = st.tabs(
    ["Current Verizon Snapshot", "Crawler Candidates", "Run History"]
)


with curated_tab:
    if EXPORT_PATH.exists():
        curated = pd.read_csv(EXPORT_PATH)
        st.caption(
            "Manual-current snapshot compiled from public web sources. Use source_confidence to separate direct/indirect verification."
        )
        st.dataframe(curated, use_container_width=True, hide_index=True)

        summary = (
            curated.groupby("manufacturer", dropna=False)
            .agg(
                rows=("promo_headline", "count"),
                max_credit_usd=("max_credit_usd", "max"),
            )
            .reset_index()
            .sort_values("max_credit_usd", ascending=False, na_position="last")
        )
        st.subheader("Manufacturer Summary")
        st.dataframe(summary, use_container_width=True, hide_index=True)
    else:
        st.info("No curated export snapshot found yet.")

with crawler_tab:
    if not DB_PATH.exists():
        st.info("No crawler database yet. Run `scripts/crawl.py` first.")
        st.stop()

    with sqlite3.connect(DB_PATH) as conn:
        runs = pd.read_sql_query(
            "SELECT id, started_at, source_count, candidate_count FROM crawl_runs ORDER BY id DESC",
            conn,
        )
        candidates = pd.read_sql_query(
            """
            SELECT
                pc.id, pc.run_id, cr.started_at, pc.carrier, pc.category, pc.brand,
                pc.model, pc.offer_type, pc.max_credit_usd, pc.term_months,
                pc.requires_trade_in, pc.requires_new_line, pc.requires_unlimited_plan,
                pc.source_url, pc.source_text
            FROM promotion_candidates pc
            JOIN crawl_runs cr ON cr.id = pc.run_id
            ORDER BY pc.run_id DESC, pc.brand, pc.model
            """,
            conn,
        )

    if runs.empty:
        st.info("Crawler database exists, but it has no runs yet.")
        st.stop()

    latest_run_id = int(runs.iloc[0]["id"])
    latest = candidates[candidates["run_id"] == latest_run_id].copy()

    left, right = st.columns([1, 3])
    with left:
        st.metric("Latest Run", latest_run_id)
        st.metric("Sources", int(runs.iloc[0]["source_count"]))
        st.metric("Candidates", int(runs.iloc[0]["candidate_count"]))

        brands = sorted([brand for brand in latest["brand"].dropna().unique()])
        selected_brands = st.multiselect("Brand", brands, default=brands)

        categories = sorted(latest["category"].dropna().unique())
        selected_categories = st.multiselect("Category", categories, default=categories)

    with right:
        view = latest.copy()
        if selected_brands:
            view = view[view["brand"].isin(selected_brands) | view["brand"].isna()]
        if selected_categories:
            view = view[view["category"].isin(selected_categories)]

        st.subheader("Latest Promotion Candidates")
        st.dataframe(
            view[
                [
                    "brand",
                    "model",
                    "offer_type",
                    "max_credit_usd",
                    "term_months",
                    "requires_trade_in",
                    "requires_new_line",
                    "requires_unlimited_plan",
                    "category",
                    "source_text",
                    "source_url",
                ]
            ],
            use_container_width=True,
            hide_index=True,
        )

with history_tab:
    if not DB_PATH.exists():
        st.info("No crawler database yet. Run `scripts/crawl.py` first.")
    else:
        with sqlite3.connect(DB_PATH) as conn:
            runs = pd.read_sql_query(
                "SELECT id, started_at, source_count, candidate_count FROM crawl_runs ORDER BY id DESC",
                conn,
            )
        st.dataframe(runs, use_container_width=True, hide_index=True)
