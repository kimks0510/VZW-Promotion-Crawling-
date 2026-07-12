# VZW Promotion Crawling Project

Verizon US public website promotions tracker for weekly smartphone market monitoring.

## React Dashboard

The public dashboard is a Vite + React static site. It reads the latest normalized
snapshot from `public/data/snapshot.json`, so the crawler can update data without
rewriting the user interface.

```powershell
pnpm install
pnpm dev
```

Production check:

```powershell
pnpm build
pnpm preview
```

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` builds and publishes the site
whenever `main` is updated.

1. Push the repository to GitHub.
2. Open **Settings > Pages** in the repository.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Open the **Actions** tab and confirm that `Deploy React dashboard to Pages` passes.
5. The expected URL is `https://kimks0510.github.io/VZW-Promotion-Crawling-/`.

## Production Data Flow

```text
US-region scheduled runner
  -> Playwright captures raw pages and offer-detail states
  -> parser normalizes promotion and plan conditions
  -> validation flags conflicting or incomplete records
  -> snapshot.json plus dated raw evidence are committed
  -> GitHub Pages deploys the refreshed React dashboard
```

Run collection daily during launch windows and at least weekly otherwise. A GitHub
hosted runner may work, but Verizon can serve different content or block data-center
traffic. For stable production collection, use an approved US-region VM or runner,
keep a fixed test ZIP/customer state, rate-limit requests, and preserve raw evidence.
Do not automate login, account-only offers, checkout, CAPTCHA bypass, or personal data.

## Goal

Track Verizon smartphone promotions for Samsung, Apple, and Google devices using only public web information. The system should preserve weekly snapshots, normalize offer terms, and make changes easy to review in a lightweight dashboard.

## Recommended Workflow

1. Crawl public Verizon pages
   - Brand/category pages: Samsung, Apple, Google, all smartphones, free phones, trade-in pages.
   - Store raw HTML/text snapshots every run so disappeared offers can still be audited later.

2. Extract promotion candidates
   - Detect offer text such as `free`, `up to $1,000 off`, `trade-in`, `new line`, `Unlimited Ultimate`, `36 months`, and similar eligibility language.
   - Keep both parsed fields and the original source text.

3. Normalize terms
   - Brand, model, offer type, max credit, monthly term, plan requirement, line requirement, trade-in requirement, source URL, run date.
   - Treat unknowns as blanks rather than guessing.

4. Store in SQLite first
   - Good enough for a weekly internal tracker.
   - Easy migration path to PostgreSQL later.

5. Review in Streamlit
   - Current offers by brand/model.
   - Week-over-week changes.
   - Raw source text drill-down for audit.

6. Productionize
   - Schedule weekly runs with Windows Task Scheduler or a server cron.
   - Add Slack/Teams/email alert when offer text changes.
   - Add competitor carriers later using the same schema.

## Quick Start

Use the bundled Codex Python runtime if system Python is not installed:

```powershell
$PY="C:\Users\손승회\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $PY scripts\crawl.py
```

This creates `data\promotions.sqlite` and stores a crawl run, source snapshots, and extracted promotion candidates.

Optional dashboard after installing dependencies:

```powershell
$PY="C:\Users\손승회\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $PY -m pip install -r requirements.txt
& $PY -m streamlit run app\streamlit_app.py
```

## Current Scope

Initial target pages are in `config/targets.json`. They are intentionally broad and public. Product-detail and checkout-like flows should be added carefully because promotion terms can vary by ZIP, account status, inventory, plan, and customer segment.
