# North America Promotion Radar - Claude Handoff

Last updated: 2026-08-02 (Asia/Seoul)

## 1. Mission

Build a weekly, evidence-first promotion intelligence service for North American
smartphone sales. The service must collect public consumer offers from carriers,
normalize them into a common commercial taxonomy, retain the exact source text and
screenshots, and let an analyst compare the captured source with the normalized offer.

The immediate scope is:

- AT&T US
- Verizon US through the public Spanish-language site (`espanol.verizon.com`)
- T-Mobile US

The longer-term scope includes Best Buy and Canadian carriers/retailers, so carrier-
specific logic must sit behind a shared data contract rather than being embedded in
the React UI.

## 2. Canonical Repository

- Local path: `C:\Workspace\VZW-Promotion-Crawler`
- Git remote: `https://github.com/kimks0510/VZW-Promotion-Crawling-.git`
- Branch: `main`
- Baseline commit at handoff: `af9c1ca`
- Public site: `https://kimks0510.github.io/VZW-Promotion-Crawling-/`

Before changing code:

```powershell
cd C:\Workspace\VZW-Promotion-Crawler
git status --short
git pull --ff-only
```

Never discard an unknown local change. Do not use `git reset --hard` or overwrite
generated evidence without first checking whether it is referenced by a snapshot.

## 3. Current Repository Reality

This section is deliberately explicit. Do not infer implementation from earlier chat
history; inspect the repository on disk.

Implemented now:

- Vite + React static dashboard in `src/main.jsx` and `src/styles.css`.
- Dashboard reads `public/data/snapshot.json`, `history.json`, and
  `collection-status.json`.
- Generic crawler in `src/vzw_promo_tracker/crawler.py`.
- Static HTTP first, Playwright fallback, SQLite storage, SHA-256 content hashes.
- Full-page JPEG capture for configured targets.
- Extraction rules for EIP, Trade-in, BYOD+, AC, TIV, term, new line, and unlimited
  plan language in `src/vzw_promo_tracker/extract.py`.
- Verizon target list in `config/targets.json` and canonical scenario assumptions in
  `config/scenarios.json`.
- GitHub Pages deployment workflow.
- Scheduled collection workflow and internal ZIP package builder.

Not implemented in this checkout:

- No production AT&T collector module.
- No T-Mobile collector module.
- No Verizon Español translation pipeline.
- No carrier-neutral normalized snapshot consumed by the UI.
- No reliable scenario runner that traverses storage, customer, transaction, plan,
  trade-in device, condition, and final terms for every model.
- Current collection workflow is daily, not weekly.
- Some UI labels still use `N/C` / `Not captured`; the desired display language is
  `Not verified` (`미확인`) unless the source explicitly says `Not eligible`.

Treat these as gaps to implement, not as completed behavior.

## 4. Product Taxonomy

Preserve the analyst vocabulary across carriers:

- `EIP`: device installment promotion that does not require a trade-in.
- `Trade-in`: promotion requiring an eligible traded device.
- `BYOD+`: bring-your-own-device incentive, tracked separately from device EIP.
- `On Us`: net device installment is `$0` after promotional bill credits. The service
  plan, taxes, fees, and eligibility conditions remain payable.
- `AC`: Any Condition language is explicit in the source. Do not infer AC from a broad
  headline.
- `TIV`: minimum trade-in value or value band required for a credit tier.
- `N`, `N-1`, `N-2`, `N-3`, `N-4`, `N-5+`: normalized trade-in generations.
- `High / Mid / Low`: internal plan ladder. Store the carrier plan name separately and
  maintain effective-dated mapping in configuration.
- `Not verified` / `미확인`: exact value was not proven by captured evidence.
- `Not eligible` / `비대상`: use only when official terms explicitly exclude the plan,
  device, transaction, or condition.

Do not render blank cells for unknown values, because a blank looks like a data defect.
Do not use `N/C` in user-facing UI.

## 5. Official Discovery Seeds

The crawler must discover current PDPs and offer identifiers at runtime. The following
URLs are seeds, not the complete set of pages to hardcode.

### AT&T

- Device catalog: `https://www.att.com/buy/phones/`
- Apple: `https://www.att.com/buy/phones/browse/apple/`
- Samsung: `https://www.att.com/buy/phones/browse/samsung/`
- Google: `https://www.att.com/buy/phones/browse/google/`
- Motorola: `https://www.att.com/buy/phones/browse/motorola/`
- Plans: `https://www.att.com/plans/unlimited-data-plans/`

Observed interaction chain:

```text
catalog/brand Grid
  -> product card
  -> See offer details
  -> Legal details modal
  -> See additional terms/details
  -> expanded legal text and eligible-device list
  -> PDP if scenario-specific price still needs validation
```

The card-level headline and expanded legal terms are separate evidence states. Capture
both. An `eligible unlimited` phrase does not prove that only one plan qualifies.

### Verizon Español

- Device catalog: `https://espanol.verizon.com/smartphones/`
- Example PDP pattern:
  `https://espanol.verizon.com/smartphones/samsung-galaxy-s26-ultra/`
- Deals link discovered from the Spanish navigation:
  `https://espanol.verizon.com/deals/smartphones/`
- Trade-in entry: `https://espanol.verizon.com/trade-in/`

Observed interaction chain:

```text
Spanish smartphone Grid
  -> model card and any adjacent Detalles promotion
  -> model PDP
  -> storage
  -> customer type
  -> transaction / line action
  -> plan
  -> promotion mechanic
  -> trade-in model and condition when applicable
  -> final monthly price and expanded terms
```

The Spanish site is an official Verizon source and may render more reliably outside
the US than the English site. The screenshot and raw source must remain Spanish. English
and Korean are derived translations, never replacements for the source evidence.

### T-Mobile

- Home/discovery: `https://www.t-mobile.com/`
- Device catalog:
  `https://www.t-mobile.com/cell-phones?INTNAV=tNav%3ADevices`
- All offers: `https://www.t-mobile.com/offers`
- Apple offers: `https://www.t-mobile.com/offers/apple-iphone-deals`
- Samsung offers: `https://www.t-mobile.com/offers/samsung-phone-deals`
- Google offers: `https://www.t-mobile.com/offers/google-phone-deals`
- Motorola offers: `https://www.t-mobile.com/offers/motorola-phone-deals`
- Plans: `https://www.t-mobile.com/cell-phone-plans`
- BYOD: `https://www.t-mobile.com/resources/bring-your-own-phone`
- PDP pattern: `https://www.t-mobile.com/cell-phone/{device-slug}`

Observed interaction chain:

```text
home / offers / device Grid
  -> product card
  -> See N promotions
  -> select each promotion, not only the first headline
  -> Get full terms
  -> PDP
  -> color/storage
  -> new/existing customer and line action when exposed
  -> rate plan
  -> trade-in device/condition
  -> financing result and complete terms
```

T-Mobile currently exposes plan-specific language such as Experience Beyond,
Experience More, Better Value, and legacy/existing-member Go5G conditions. Do not
hardcode one permanent High/Mid/Low mapping. Store the literal plan name and map it in
an effective-dated carrier configuration after PM confirmation.

## 6. Required Crawl Architecture

Create a shared orchestrator and one adapter per carrier:

```text
scripts/collect_all.py
  -> collectors/att.py
  -> collectors/verizon_es.py
  -> collectors/tmobile.py
  -> normalization/schema.py
  -> validation/matcher.py
  -> evidence/writer.py
  -> public/data/carriers/{carrier}/latest.json
  -> public/data/history/{date}.json
```

Recommended adapter interface:

```python
class CarrierCollector(Protocol):
    def discover_devices(self, context) -> list[DeviceSeed]: ...
    def discover_offers(self, page, device) -> list[OfferSeed]: ...
    def run_scenario(self, page, offer, scenario) -> ScenarioResult: ...
    def extract_terms(self, page, state) -> SourceEvidence: ...
```

Use structured locators first:

1. role and accessible name;
2. carrier-owned stable data attributes;
3. exact visible text with language-aware alternatives;
4. CSS fallback scoped to a card/modal;
5. never use a page-wide positional selector unless the expected model/offer text is
   validated before clicking.

Each action must record selector used, expected state, observed state, elapsed time,
and failure reason. A selector failure must not silently reuse a prior offer value.

## 7. Scenario State Machine

The minimum scenario dimensions are:

```text
carrier
device model
storage
customer type: new / existing
transaction: new line / add line / upgrade / port-in
plan literal name and normalized tier
mechanic: EIP / Trade-in / BYOD+
trade-in model and normalized generation
trade-in condition: good / damaged
ZIP: 10001 unless carrier behavior requires another approved canonical ZIP
```

Recommended traversal:

```text
DISCOVERED
 -> GRID_OFFER_OPENED
 -> PDP_LOADED
 -> STORAGE_SELECTED
 -> CUSTOMER_SELECTED
 -> TRANSACTION_SELECTED
 -> PLAN_SELECTED
 -> MECHANIC_SELECTED
 -> TRADE_IN_SELECTED (conditional)
 -> CONDITION_SELECTED (conditional)
 -> TERMS_EXPANDED
 -> PRICE_CAPTURED
 -> VERIFIED | INCOMPLETE | FAILED
```

Do not create the full Cartesian product immediately. Use a priority probe set:

1. Samsung and Apple flagships, then Google and Motorola flagships.
2. New line before upgrade; add/port-in only where the source distinguishes them.
3. High/Mid/Low plan probes.
4. EIP first, then Trade-in.
5. For Trade-in, use N, N-2, and N-5+ Good probes first; add Damaged probes to confirm
   AC and boundary models when a credit tier changes.

Expand coverage only after selectors and matching are stable.

## 8. Evidence Contract

Every normalized row must be reproducible from a specific captured state. Store:

- source URL and final URL after redirects;
- carrier, market, locale, ZIP, and collection timestamp in UTC;
- model, storage, customer, transaction, plan, mechanic, trade-in device, condition;
- visible source text in the original language;
- HTML or structured response used by the extractor;
- HTTP status and SHA-256 hash;
- screenshot path and dimensions;
- promotion/offer identifier when available;
- selector/action log;
- parsed values and validation status;
- translation metadata where applicable.

Suggested screenshot sequence per scenario:

```text
01-grid.jpg
02-offer-list.jpg
03-offer-terms.jpg
04-pdp-default.jpg
05-storage.jpg
06-customer.jpg
07-transaction.jpg
08-plan.jpg
09-mechanic.jpg
10-trade-in-device.jpg
11-condition.jpg
12-terms-expanded.jpg
13-final-longshot.jpg
```

Requirements:

- Capture the actual modal/section after each state change, not thirteen duplicate
  full-page images.
- The final longshot must include the selected state, monthly price, credit, and terms.
- If the modal is taller than the viewport, use element screenshot; fall back to
  viewport slices and stitch metadata, not an unreadably scaled image.
- The dashboard Evidence view must show source on the left and normalized summary on
  the right without opening a second overlay.
- Preserve both the pre-expansion offer modal and expanded terms image.
- Raw evidence should be a private workflow artifact; only the necessary review images,
  hashes, and normalized public fields should be committed to a public repository.

## 9. Spanish Source and EN/KO Output

For Verizon Español use this data policy:

```json
{
  "sourceLanguage": "es-US",
  "sourceTextOriginal": "...",
  "sourceTextEn": "...",
  "sourceTextKo": "...",
  "translationMethod": "deterministic glossary + reviewed translation",
  "sourceHash": "sha256..."
}
```

Rules:

- Hash and retain the Spanish source before translation.
- Never translate brand/model names, plan names, promo IDs, `On Us`, `EIP`, `Trade-in`,
  `BYOD+`, `AC`, or `TIV`.
- Never recalculate or alter numbers during translation.
- Keep source text and analyst paraphrase in separate fields.
- UI language toggle controls English/Korean analyst text; Evidence always offers the
  original Spanish text and screenshot.
- If translation fails, publish the original evidence with status `translation_pending`;
  do not block source collection.

## 10. Normalized Offer Schema

The carrier-neutral record should contain at least:

```json
{
  "offerId": "stable carrier + model + promo + scenario hash",
  "carrier": "AT&T | Verizon | T-Mobile",
  "market": "US",
  "brand": "Samsung",
  "model": "Galaxy ...",
  "storage": "256GB",
  "mechanic": "EIP | Trade-in | BYOD+",
  "retailUsd": 0,
  "termMonths": 24,
  "advertisedCreditUsd": 0,
  "observedMonthlyUsd": 0,
  "onUs": false,
  "planLiteral": "carrier source plan name",
  "planTier": "high | mid | low | unmapped",
  "tierMonthly": {"high": null, "mid": null, "low": null},
  "customerType": "new | existing | both | unknown",
  "lineAction": "new_line | add_line | upgrade | port_in | unknown",
  "tradeInRequired": false,
  "anyCondition": false,
  "tivUsd": null,
  "eligibleTradeIns": [],
  "sourceLanguage": "en-US",
  "sourceTextOriginal": "",
  "sourceTextEn": "",
  "sourceTextKo": "",
  "sourceUrl": "",
  "capturedAt": "UTC ISO-8601",
  "evidence": [],
  "validationStatus": "verified | incomplete | failed",
  "notVerifiedFields": []
}
```

Important carrier difference: T-Mobile commonly uses 24 monthly bill credits while
AT&T and Verizon commonly expose 36-month financing in current public pages. Never
default the term globally.

## 11. Matching and Credibility Rules

Mark `verified` only when screenshot/text and normalized record match on all fields
needed for the claim:

- carrier and exact model;
- storage;
- customer/transaction state;
- literal plan and normalized tier;
- mechanic and trade-in state;
- monthly price, term, and credit within a strict currency tolerance;
- captured terms from the same scenario ID.

Use `incomplete` when an official offer exists but one or more fields cannot be proven.
List those fields in `notVerifiedFields`. Use `failed` when navigation or extraction did
not reach the required state. Never copy values from a prior week into a new verified
record. The UI may continue showing the last verified snapshot but must display its age
and the latest run failure separately.

## 12. Weekly Background Automation

The current workflow runs daily. Change it to once per week after the multi-carrier
collector is ready:

```yaml
on:
  schedule:
    - cron: "15 13 * * 1"  # Monday 13:15 UTC / Monday 22:15 KST
  workflow_dispatch:
```

Recommended workflow design:

```text
test
 -> collect carrier adapters sequentially with rate limits
 -> validate schema and scenario matches
 -> build dated snapshot and change set
 -> upload raw DB/HTML/logs/screenshots as private artifact (90 days)
 -> commit only validated normalized data and approved review images
 -> deploy Pages
 -> emit summary: discovered / verified / incomplete / failed / changed
```

Operational rules:

- Keep `workflow_dispatch` for manual launch-window collections.
- Use `concurrency` with `cancel-in-progress: false` for collection.
- Do not trigger a new collection from the bot's own data-only commit; prevent loops
  with path filters or commit-message conditions.
- Use per-carrier timeout and retry budgets. One carrier failure must not erase another
  carrier's successful snapshot.
- GitHub-hosted runners do not guarantee a stable consumer US IP. For deterministic
  geo-sensitive collection, use an approved US-region self-hosted runner/VM with no
  personal account data.
- Do not bypass CAPTCHA, login, bot protection, or carrier terms. Mark the run failed
  and retain diagnostic evidence.

## 13. Dashboard Changes Required

Refactor the current Verizon-hardcoded UI into:

- `Market`: cross-carrier overview.
- carrier filter: Verizon / AT&T / T-Mobile / All.
- carrier-specific Overview with consistent cards and trend lines.
- shared Matrix with carrier-specific plan names and terms.
- Plans view using effective-dated carrier tier mapping.
- Evidence comparison: left source capture, right normalized summary.
- Sources view with exact monitored URLs, status, timestamp, locale, and hash.

Default sorting remains retail price high-to-low, with alternatives for manufacturer,
On Us strength, promotional credit, and retail low-to-high. Within a manufacturer,
flagship variants should sort Ultra/Pro Max/Pro XL before Plus/Pro, then base/value.

## 14. Suggested Implementation Order

1. Introduce carrier-neutral schema and adapter interface without changing UI behavior.
2. Move existing Verizon crawler behind a `verizon` adapter and keep tests green.
3. Add Verizon Español discovery, original-language evidence, and translation fields.
4. Add AT&T Grid → offer details → additional terms collector.
5. Add T-Mobile Grid → promotions → full terms collector.
6. Implement scenario IDs and exact evidence matcher.
7. Export per-carrier and combined snapshots/history.
8. Refactor React to consume combined data.
9. Change schedule from daily to weekly.
10. Run one manual collection, inspect screenshots and unmatched fields, then enable the
   scheduled workflow.

## 15. Acceptance Criteria

A multi-carrier release is acceptable only when:

- all three seed catalogs are reached in the scheduled runner;
- Samsung, Apple, Google, and Motorola are discovered where sold;
- every published offer retains exact source URL, timestamp, original text, and hash;
- AT&T expanded terms and T-Mobile full terms are captured when present;
- Verizon Español evidence remains in Spanish and has separate EN/KO fields;
- user-facing UI contains no `N/C`;
- `Not eligible` is used only with explicit source exclusion;
- final screenshot and normalized value share the same scenario ID;
- production build and Python tests pass;
- a failed carrier run cannot overwrite the last verified snapshot;
- the weekly workflow can also be run manually.

## 16. Verification Commands

```powershell
cd C:\Workspace\VZW-Promotion-Crawler

$env:PYTHONPATH = "src"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v

pnpm install --frozen-lockfile
pnpm build

# Manual collection after the new orchestrator is implemented
.\.venv\Scripts\python.exe scripts\collect_all.py --carriers att verizon_es tmobile
```

After a manual run, inspect at least one flagship scenario per carrier in the React
Evidence view and compare the source image/text against the normalized price, plan,
term, trade-in requirement, AC, and TIV.

## 17. Official References Checked for This Handoff

- AT&T device catalog: `https://www.att.com/buy/phones/`
- AT&T unlimited plans: `https://www.att.com/plans/unlimited-data-plans/`
- Verizon Español smartphone catalog: `https://espanol.verizon.com/smartphones/`
- Verizon Español example PDP:
  `https://espanol.verizon.com/smartphones/samsung-galaxy-s26-ultra/`
- T-Mobile device catalog: `https://www.t-mobile.com/cell-phones?INTNAV=tNav%3ADevices`
- T-Mobile offers: `https://www.t-mobile.com/offers`
- T-Mobile plans: `https://www.t-mobile.com/cell-phone-plans`

These pages are dynamic and may change. The crawler must discover offer/PDP links and
record selector failures rather than assuming the page structure is permanent.
