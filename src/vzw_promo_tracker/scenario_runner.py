import hashlib
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path


def now(): return datetime.now(timezone.utc).isoformat(timespec="seconds")
def slug(value): return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


@dataclass
class StepResult:
    name: str
    requested: str
    observed: str = ""
    verified: bool = False
    screenshot: str | None = None
    error: str | None = None


@dataclass
class ScenarioResult:
    scenarioId: str
    brand: str
    model: str
    sourceUrl: str
    requestedState: dict
    observedState: dict = field(default_factory=dict)
    status: str = "running"
    finalPrice: float | None = None
    terms: str = ""
    startedAt: str = field(default_factory=now)
    completedAt: str | None = None
    steps: list[StepResult] = field(default_factory=list)


def scenario_id(product, state):
    key = json.dumps({"url": product["url"], **state}, sort_keys=True)
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def selected(locator):
    """Accept explicit accessibility state or Verizon selected-state styling."""
    return locator.get_attribute("aria-checked") == "true" or locator.get_attribute("aria-selected") == "true" or "selected" in (locator.get_attribute("class") or "").lower()


def click_and_verify(page, label, name, capture_dir, scenario):
    step = StepResult(name=name, requested=label)
    try:
        locator = page.get_by_text(label, exact=True)
        if not locator.count():
            raise RuntimeError(f"control not found: {label}")
        control = locator.first
        control.click(timeout=5000)
        page.wait_for_timeout(1200)
        step.observed = control.inner_text().strip()
        step.verified = selected(control)
        if not step.verified:
            raise RuntimeError("selection changed but could not be verified")
    except Exception as exc:
        step.error = str(exc)
    path = capture_dir / f"{len(scenario.steps)+1:02d}-{slug(name)}.jpg"
    page.screenshot(path=path, type="jpeg", quality=65, full_page=True)
    step.screenshot = f"./scenario-evidence/{scenario.scenarioId}/{path.name}"
    scenario.steps.append(step)
    return step.verified


def extract_final(page):
    text = page.locator("body").inner_text()
    prices = re.findall(r"\$(\d+(?:\.\d{1,2})?)/mo", text, re.I)
    terms_match = re.search(r"(Terms(?: and Conditions)?[\s\S]{0,4000})", text, re.I)
    return (float(prices[-1]) if prices else None, terms_match.group(1) if terms_match else "")


def run(config_path: Path, output_path: Path, evidence_root: Path):
    from playwright.sync_api import sync_playwright
    config = json.loads(config_path.read_text(encoding="utf-8"))
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(locale="en-US", viewport={"width":1440,"height":1000})
        page = context.new_page()
        for product in config["products"]:
            for plan in config["planTiers"]:
                state = {**config["defaults"], "plan":plan, "mechanic":"EIP"}
                result = ScenarioResult(scenario_id(product, state), product["brand"], product["model"], product["url"], state)
                capture_dir = evidence_root / result.scenarioId
                capture_dir.mkdir(parents=True, exist_ok=True)
                try:
                    page.goto(product["url"], wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(4000)
                    checks = [
                        click_and_verify(page, state["storage"], "storage", capture_dir, result),
                        click_and_verify(page, state["customerType"], "customer", capture_dir, result),
                        click_and_verify(page, "Next steps", "next-steps", capture_dir, result),
                        click_and_verify(page, state["transaction"], "transaction", capture_dir, result),
                        click_and_verify(page, plan, "plan", capture_dir, result),
                    ]
                    result.finalPrice, result.terms = extract_final(page)
                    result.status = "verified" if all(checks) and result.finalPrice is not None else "incomplete"
                except Exception as exc:
                    result.status = "failed"
                    result.steps.append(StepResult("page", product["url"], error=str(exc)))
                result.observedState = {s.name:s.observed for s in result.steps if s.verified}
                result.completedAt = now()
                results.append(asdict(result))
        browser.close()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"generatedAt":now(),"results":results}, indent=2), encoding="utf-8")
