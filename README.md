# North America Promotion Radar

Verizon, AT&T and T-Mobile US public website promotion tracker for weekly smartphone market monitoring.

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

Use the `Verizon / AT&T / T-Mobile` switch below the dashboard title to change
carriers. AT&T and T-Mobile each normalize direct promotional cards for Apple,
Samsung and Google (AT&T also covers Motorola). Rows with a successfully opened
offer-detail modal (`See offer details` on AT&T, `Get full terms` on T-Mobile)
retain a modal screenshot; other rows retain the corresponding official brand-grid
longshot and remain explicitly marked as card-level evidence.

Refresh AT&T or T-Mobile data locally with:

```powershell
python scripts/collect_att.py
python scripts/collect_tmobile.py
```

`collect_att.py` writes `public/data/att-snapshot.json` and evidence under
`public/att-evidence/`. `collect_tmobile.py` writes `public/data/tmobile-snapshot.json`
and evidence under `public/tmobile-evidence/`. The scheduled GitHub workflow refreshes
all three carriers.

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

The primary offer inventory now starts from Verizon's all-smartphones Grid rather
than isolated manufacturer pages. `scripts/collect_grid_offers.py` records Apple,
Samsung, Google and Motorola cards, observes Verizon-owned product-list responses,
clicks each available `Details` control and retains the resulting `promoId`,
`deviceId`, `skuId`, flow and loan term. Evidence is explicitly staged as
`card_confirmed`, `details_confirmed`, then `scenario_matched`; a card headline is
never represented as complete plan or trade-in eligibility.

Run collection daily during launch windows and at least weekly otherwise. A GitHub
hosted runner may work, but Verizon can serve different content or block data-center
traffic. For stable production collection, use an approved US-region VM or runner,
keep a fixed test ZIP/customer state, rate-limit requests, and preserve raw evidence.
Do not automate login, account-only offers, checkout, CAPTCHA bypass, or personal data.

The scheduled workflow at `.github/workflows/collect-verizon.yml` now provides the
first US-region collection layer. It runs daily at 13:15 UTC and can also be started
manually. Raw SQLite evidence is retained as a 30-day workflow artifact; only status,
response and hash metadata are published to the website repository. Curated offer
rows remain separate until extraction validation is strong enough for auto-publish.

## Commercial Promotion Taxonomy

The dashboard normalizes offers using the North America device-sales review model:

- `EIP`: device payment promotion without a required trade-in.
- `Trade-in`: bill incentive credit tied to an eligible traded device.
- `BYOD+`: bring-your-own-device line discount, tracked separately from device EIP.
- `High / Mid / Low`: Ultimate / Plus / Welcome plan-tier ladder, displayed as the net monthly device payment.
- `AC`: Any Condition trade-in language is explicitly present in Verizon evidence.
- `TIV`: captured trade-in value or value floor. Missing detail remains `Not captured`.
- `N` through `N-4`, then `N-5+`: normalized generation buckets for eligible trade-ins.

The shorthand `free/free/free` means the observed net monthly device payment is $0
on High, Mid and Low plan tiers. It is never inferred merely from a single headline;
each tier must have evidence or it remains `N/C` (not captured).

Promotional bill credits are recurring credits applied to the Verizon bill over the
stated term. Every matrix row offers live, search and downloadable verification paths:
the live Verizon PDP, captured source text with US-runner timestamp and SHA-256 hash,
and a search-index query for users whose network cannot render Verizon directly.

## Current Automation Boundary

Each collected Verizon URL also produces a compressed first-viewport screenshot on
the US GitHub runner. In the Matrix, select `Official` to open the screen captured at
the recorded collection time. The image is visual evidence of the rendered source;
interactive plan, trade-in and Terms states still require the scenario collector.

PDP captures are source evidence until their storage, customer type, line action,
plan and trade-in selections are recorded and matched to the normalized offer row.

The crawler now classifies EIP, Trade-in, BYOD+, AC and explicitly stated TIV across
a bounded multi-sentence evidence window. Exact eligible-device lists, generation
bands and some tier-specific monthly amounts may live behind interactive offer-detail
or trade-in valuation states. Those values require a scenario-driven browser collector
that records ZIP, customer type, line action, plan tier and trade-in device. Until that
collector is implemented, the dashboard shows `Not captured` instead of guessing.

The next collector stage is an interactive PDP scenario runner. It will enumerate
customer type, transaction type, plan tier, trade-in device generation/condition and
ZIP, then preserve the Terms & Conditions after each state change. This is technically
automatable with Playwright; product guidance is needed to define the canonical ZIP,
Low/Mid/High mapping and priority trade-in probe models so the scenario count remains
commercially useful.

`On Us` is normalized as a $0 net device installment after promotional bill credits. It does not mean the
wireless service plan is free. When Low/Mid/High are all On Us, the dashboard compares
their different promotion conditions and service value such as 5G versus 5G Ultra
Wideband, hotspot, international features and connected-device discounts.

The canonical scenario is stored in `config/scenarios.json`: Manhattan ZIP `10001`,
High / Mid / Low display order, Ultimate / Plus / Welcome mapping, Apple and Samsung
N-to-N-5+ generation probes, and Good / Damaged condition probes. Matrix rows default
to retail price descending and can also be sorted by manufacturer, On Us strength,
promotional credit, or low-to-high retail price.

Condition-based AC validation uses two signals together: the Damaged scenario must
retain the qualifying promotion and Verizon evidence must explicitly contain Any
Condition language. Battery swelling, activation lock, and lost/stolen status remain
separate exception checks and are never assumed eligible without captured terms.

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
