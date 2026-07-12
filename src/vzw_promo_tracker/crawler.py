import hashlib
import html
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .db import connect
from .extract import extract_candidates


class VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._hidden_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg"}:
            self._hidden_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg"} and self._hidden_depth:
            self._hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._hidden_depth:
            text = data.strip()
            if text:
                self.parts.append(text)

    def text(self) -> str:
        return re.sub(r"\s+", " ", html.unescape(" ".join(self.parts))).strip()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def fetch_url_static(url: str) -> tuple[int | None, str, str]:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read()
            charset = response.headers.get_content_charset() or "utf-8"
            raw_html = body.decode(charset, errors="replace")
            return response.status, raw_html, ""
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, body, str(exc)
    except URLError as exc:
        return None, "", str(exc)


def fetch_url_browser(url: str) -> tuple[int | None, str, str]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        return None, "", f"Playwright is not installed: {exc}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                locale="en-US",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/126.0 Safari/537.36"
                ),
            )
            response = page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)
            raw_html = page.content()
            status = response.status if response else None
            browser.close()
            return status, raw_html, ""
    except Exception as exc:
        return None, "", f"Browser fetch failed: {exc}"


def fetch_url(url: str) -> tuple[int | None, str, str]:
    status_code, raw_html, error = fetch_url_static(url)
    if status_code and status_code < 400 and raw_html:
        return status_code, raw_html, error

    browser_status, browser_html, browser_error = fetch_url_browser(url)
    if browser_html:
        return browser_status, browser_html, browser_error

    return status_code, raw_html, error or browser_error


def html_to_text(raw_html: str) -> str:
    parser = VisibleTextParser()
    parser.feed(raw_html)
    return parser.text()


def load_targets(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def run_crawl(targets_path: Path, db_path: Path) -> None:
    targets = load_targets(targets_path)
    started_at = utc_now()

    with connect(db_path) as conn:
        cursor = conn.execute("INSERT INTO crawl_runs (started_at) VALUES (?)", (started_at,))
        run_id = cursor.lastrowid
        source_count = 0
        candidate_count = 0

        for target in targets:
            status_code, raw_html, error = fetch_url(target["url"])
            raw_text = html_to_text(raw_html) if raw_html else error
            content_hash = hashlib.sha256(raw_html.encode("utf-8")).hexdigest()
            fetched_at = utc_now()

            snapshot_cursor = conn.execute(
                """
                INSERT INTO source_snapshots (
                    run_id, carrier, market, category, url, fetched_at,
                    status_code, content_hash, raw_text, raw_html
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    target["carrier"],
                    target["market"],
                    target["category"],
                    target["url"],
                    fetched_at,
                    status_code,
                    content_hash,
                    raw_text,
                    raw_html,
                ),
            )
            snapshot_id = snapshot_cursor.lastrowid
            source_count += 1

            for candidate in extract_candidates(raw_text):
                conn.execute(
                    """
                    INSERT INTO promotion_candidates (
                        run_id, snapshot_id, carrier, market, category, source_url,
                        brand, model, offer_type, max_credit_usd, term_months,
                        requires_trade_in, requires_new_line, requires_unlimited_plan,
                        source_text, extracted_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        snapshot_id,
                        target["carrier"],
                        target["market"],
                        target["category"],
                        target["url"],
                        candidate.brand,
                        candidate.model,
                        candidate.offer_type,
                        candidate.max_credit_usd,
                        candidate.term_months,
                        int(candidate.requires_trade_in),
                        int(candidate.requires_new_line),
                        int(candidate.requires_unlimited_plan),
                        candidate.source_text,
                        utc_now(),
                    ),
                )
                candidate_count += 1

        conn.execute(
            "UPDATE crawl_runs SET source_count = ?, candidate_count = ? WHERE id = ?",
            (source_count, candidate_count, run_id),
        )

    print(f"Crawl run {run_id} complete: {source_count} sources, {candidate_count} candidates")
