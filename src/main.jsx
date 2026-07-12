import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowUpRight, Check, ChevronRight, CircleDollarSign, Clock3,
  Database, ExternalLink, FileText, Filter, Globe2, Home, Info, RefreshCw,
  Search, ShieldCheck, Smartphone, Table2, Wifi
} from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./styles.css";

const brands = ["All", "Samsung", "Apple", "Google", "Multi-brand"];
const brandOrder = { Samsung: 0, Apple: 1, Google: 2, "Multi-brand": 3 };
const planTiers = [
  {key:"low", short:"L", name:"Unlimited Welcome", network:"5G", benefits:"Value tier · basic 5G · optional perks"},
  {key:"mid", short:"M", name:"Unlimited Plus", network:"5G Ultra Wideband", benefits:"Premium data · 30 GB hotspot · 1 connected-device discount"},
  {key:"high", short:"H", name:"Unlimited Ultimate", network:"5G Ultra Wideband", benefits:"Premium data · unlimited hotspot · international · 2 device discounts"},
];

function modelRank(model) {
  const value = model.toLowerCase();
  if (value.includes("ultra") || value.includes("pro max") || value.includes("pro xl")) return 0;
  if (value.includes("plus") || value.includes("pro fold") || value.includes("fold")) return 1;
  if (value.includes(" pro")) return 2;
  if (/s26$|iphone 17$|pixel 10$/.test(value)) return 3;
  if (value.includes("air") || value.includes("flip")) return 4;
  if (value.includes("fe") || value.includes("17e") || value.includes("10a")) return 5;
  if (value.includes("bundle") || value.includes("watch")) return 8;
  return 6;
}

function money(value, digits = 0) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: digits
  }).format(value);
}

function isOnUs(value) { return value === 0; }

function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [brand, setBrand] = useState("All");
  const [mechanic, setMechanic] = useState("All");
  const [query, setQuery] = useState("");
  const [noTrade, setNoTrade] = useState(false);
  const [selected, setSelected] = useState(null);
  const [collection, setCollection] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    fetch("./data/snapshot.json").then((response) => response.json()).then((payload) => {
      setData(payload);
      setSelected(payload.promotions[0]);
    });
    fetch("./data/collection-status.json").then((response) => response.ok ? response.json() : null).then(setCollection).catch(() => setCollection(null));
    fetch("./data/history.json").then((response) => response.json()).then(setHistory);
  }, []);

  const resetHome = () => {
    setTab("overview");
    setBrand("All");
    setMechanic("All");
    setQuery("");
    setNoTrade(false);
    if (data) setSelected(data.promotions[0]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const offers = useMemo(() => {
    if (!data) return [];
    const term = query.trim().toLowerCase();
    return data.promotions.filter((offer) => {
      const haystack = `${offer.brand} ${offer.model} ${offer.headline} ${offer.plan} ${offer.verizonDisplay || ""}`.toLowerCase();
      return (brand === "All" || offer.brand === brand)
        && (mechanic === "All" || offer.mechanic === mechanic)
        && (!noTrade || offer.tradeIn === false)
        && (!term || haystack.includes(term));
    }).sort((a, b) =>
      (brandOrder[a.brand] ?? 9) - (brandOrder[b.brand] ?? 9)
      || modelRank(a.model) - modelRank(b.model)
      || a.model.localeCompare(b.model)
      || a.mechanic.localeCompare(b.mechanic)
    );
  }, [data, brand, mechanic, query, noTrade]);

  useEffect(() => {
    if (offers.length && !offers.some((offer) => offer.id === selected?.id)) {
      setSelected(offers[0]);
    }
  }, [offers, selected?.id]);

  if (!data) return <div className="loading"><RefreshCw className="spin" /> Loading Verizon snapshot</div>;

  const maxCredit = Math.max(...data.promotions.map((item) => item.credit || 0));
  const zeroOffers = data.promotions.filter((item) => item.monthly === 0).length;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand-lockup" onClick={resetHome} aria-label="Promotion Radar home">
        <span className="brand-mark">V</span><span>Promotion Radar</span>
      </button>
      <nav className="primary-nav">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><Home size={15} /> Overview</button>
        <button className={tab === "matrix" ? "active" : ""} onClick={() => setTab("matrix")}><Table2 size={15} /> Matrix</button>
        <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}><Wifi size={15} /> Plans</button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}><Database size={15} /> Sources</button>
      </nav>
      <div className="header-actions">
        <label className="global-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search offers" /></label>
        <span className="snapshot-chip"><span /> {data.meta.snapshotDate}</span>
      </div>
    </header>

    <main>
      <section className="page-title">
        <div><p>VERIZON · US CONSUMER</p><h1>Promotion intelligence</h1></div>
        <div className="page-actions">
          <span><Clock3 size={14} /> Observed {data.meta.snapshotDate}</span>
          <button onClick={() => setTab("sources")}>View crawl sources <ChevronRight size={16} /></button>
        </div>
      </section>

      {tab === "overview" && <section className="market-strip">
        <MarketStat icon={Smartphone} label="Tracked offers" value={data.promotions.length} note="3 priority brands" />
        <MarketStat icon={CircleDollarSign} label="Largest credit" value={money(maxCredit)} note="Galaxy S26 Ultra" accent />
        <MarketStat icon={Check} label="On Us outcomes" value={zeroOffers} note="$0 device payment after credits" />
        <MarketStat icon={ShieldCheck} label="Official evidence" value={`${data.promotions.filter((x) => x.confidence === "High").length}/${data.promotions.length}`} note="Verizon domains" />
        <div className="market-callout"><Activity size={18} /><div><strong>Market signal</strong><p>Samsung holds the highest observed device credit; Apple and Google lead selected $0 acquisition offers.</p></div></div>
      </section>}

      {tab === "overview" && <TrendOverview history={history} collection={collection} onOpenMatrix={() => setTab("matrix")} />}
      {tab === "matrix" && <PromotionView data={data} offers={offers} brand={brand} setBrand={setBrand} mechanic={mechanic} setMechanic={setMechanic} noTrade={noTrade} setNoTrade={setNoTrade} selected={selected} setSelected={setSelected} collection={collection} />}
      {tab === "plans" && <PlansView plans={data.plans} />}
      {tab === "sources" && <SourcesView targets={data.targets} promotions={data.promotions} collection={collection} />}
    </main>
  </div>;
}

function TrendOverview({ history, collection, onOpenMatrix }) {
  if (!history) return <div className="overview-loading">Loading biweekly history...</div>;
  const trend = history.snapshots.map((snapshot) => ({
    ...snapshot,
    eip: snapshot.mechanics.EIP,
    tradeIn: snapshot.mechanics["Trade-in"],
    byod: snapshot.mechanics["BYOD+"],
    Samsung: snapshot.brands.Samsung,
    Apple: snapshot.brands.Apple,
    Google: snapshot.brands.Google,
    SamsungOffers: snapshot.brandMetrics.Samsung.offers,
    AppleOffers: snapshot.brandMetrics.Apple.offers,
    GoogleOffers: snapshot.brandMetrics.Google.offers,
    SamsungFree: snapshot.brandMetrics.Samsung.free,
    AppleFree: snapshot.brandMetrics.Apple.free,
    GoogleFree: snapshot.brandMetrics.Google.free,
  }));
  const latest = history.snapshots[history.snapshots.length - 1];
  const previous = history.snapshots[history.snapshots.length - 2];
  const delta = latest.maxCredit - previous.maxCredit;

  return <section className="overview-grid">
    <div className="overview-main">
      <section className="chart-panel">
        <div className="panel-title"><div><p>BIWEEKLY TREND</p><h2>Headline credit & free-offer depth</h2></div><span className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? "+" : ""}{money(delta)} vs prior</span></div>
        <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{top: 12,right: 18,left: 0,bottom: 0}}>
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis dataKey="date" tick={{fontSize:11,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <YAxis yAxisId="credit" tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
          <YAxis yAxisId="count" orientation="right" tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{border:"1px solid #e5e8eb",borderRadius:8,fontSize:12}} />
          <Legend wrapperStyle={{fontSize:11}} />
          <Line yAxisId="credit" type="monotone" dataKey="maxCredit" name="Max credit ($)" stroke="#e60000" strokeWidth={2.5} dot={{r:4}} />
          <Line yAxisId="count" type="monotone" dataKey="freeOffers" name="$0 / free offers" stroke="#3182f6" strokeWidth={2.5} dot={{r:4}} />
        </LineChart></ResponsiveContainer></div>
        <div className="quality-row">{history.snapshots.map((snapshot) => <div key={snapshot.date}><span>{snapshot.date}</span><strong>{snapshot.quality}</strong></div>)}</div>
      </section>

      <section className="chart-panel brand-trend">
        <div className="panel-title"><div><p>OEM PROMOTION TREND</p><h2>Best observed promo credit by manufacturer <InfoTip text="For each snapshot, this plots the highest verified device credit found for each manufacturer. It does not represent average portfolio discount." /></h2></div><button onClick={onOpenMatrix}>Open offer matrix <ChevronRight size={15} /></button></div>
        <div className="chart-area short"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{top:8,right:18,left:0,bottom:0}}>
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis dataKey="date" tick={{fontSize:11,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <YAxis tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
          <Tooltip contentStyle={{border:"1px solid #e5e8eb",borderRadius:8,fontSize:12}} />
          <Legend wrapperStyle={{fontSize:11}} />
          <Line type="monotone" dataKey="Samsung" stroke="#1428a0" strokeWidth={2.5} dot={{r:4}} />
          <Line type="monotone" dataKey="Apple" stroke="#191f28" strokeWidth={2.5} dot={{r:4}} />
          <Line type="monotone" dataKey="Google" stroke="#34a853" strokeWidth={2.5} dot={{r:4}} />
        </LineChart></ResponsiveContainer></div>
      </section>

      <section className="chart-panel brand-trend">
        <div className="panel-title"><div><p>OEM PORTFOLIO BREADTH</p><h2>Tracked promotion count by manufacturer <InfoTip text="Number of normalized promotion rows captured for each OEM at each snapshot. Duplicate devices can appear when EIP and Trade-in are separate mechanics." /></h2></div></div>
        <div className="chart-area short"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{top:8,right:18,left:0,bottom:0}}>
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis dataKey="date" tick={{fontSize:11,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{border:"1px solid #e5e8eb",borderRadius:8,fontSize:12}} />
          <Legend wrapperStyle={{fontSize:11}} />
          <Line type="monotone" dataKey="SamsungOffers" name="Samsung" stroke="#1428a0" strokeWidth={2.5} dot={{r:4}} />
          <Line type="monotone" dataKey="AppleOffers" name="Apple" stroke="#191f28" strokeWidth={2.5} dot={{r:4}} />
          <Line type="monotone" dataKey="GoogleOffers" name="Google" stroke="#34a853" strokeWidth={2.5} dot={{r:4}} />
        </LineChart></ResponsiveContainer></div>
      </section>

      <section className="movement-panel"><div className="panel-title"><div><p>WHAT CHANGED</p><h2>Biweekly movement log</h2></div></div>
        <div className="movement-table"><div className="movement-head"><span>Metric</span><span>6/21</span><span>7/12</span><span>Δ</span><span>Interpretation</span></div>{history.movements.map((row) => <article key={row.metric}><strong>{row.metric}</strong><span>{money(row.from)}</span><span>{money(row.to)}</span><b className={row.to-row.from >= 0 ? "up" : "down"}>{money(row.to-row.from)}</b><p>{row.interpretation}</p></article>)}</div>
      </section>
    </div>

    <aside className="overview-side">
      <section className="snapshot-summary"><p>LATEST SNAPSHOT</p><h2>{latest.date}</h2><div className="summary-number"><strong>{latest.trackedOffers}</strong><span>tracked offers</span></div><dl><div><dt>EIP</dt><dd>{latest.mechanics.EIP}</dd></div><div><dt>Trade-in</dt><dd>{latest.mechanics["Trade-in"]}</dd></div><div><dt>BYOD+</dt><dd>{latest.mechanics["BYOD+"]}</dd></div><div><dt>US crawl</dt><dd>{collection ? `${collection.sourceCount} sources complete` : "Pending"}</dd></div></dl></section>
      <section className="lexicon-panel"><p>COMMERCIAL LEXICON</p><h3>How to read the matrix</h3><Lexicon term="On Us" text="Net device installment is $0 after BIC. Service-plan charges, taxes and conditions still apply." /><Lexicon term="N/C" text="Not Captured. The source confirms an offer but does not expose that tier-specific value in the collected state." /><Lexicon term="BIC" text="Bill Incentive Credit. Promotional credits applied to the Verizon bill over the stated term, usually 36 months." /><Lexicon term="EIP" text="Equipment Installment Plan promotion without a required trade-in." /><Lexicon term="Trade-in" text="Device credit requiring an eligible traded device." /><Lexicon term="AC" text="Any Condition trade-in accepted, subject to eligible model rules." /><Lexicon term="TIV" text="Trade-in Value or value band attached to the traded model." /><Lexicon term="N-5+" text="Older eligible generation bucket after N through N-4." /><Lexicon term="free/free/free" text="Low / Mid / High tiers all show $0 device payment; plan value and qualifying conditions may differ." /></section>
      <section className="cadence-panel"><Clock3 size={17} /><div><strong>{history.cadence} snapshot cadence</strong><p>Next direct snapshot should preserve the same customer state, ZIP and offer path.</p></div></section>
    </aside>
  </section>;
}

function Lexicon({ term, text }) { return <div className="lexicon-row"><b>{term}</b><span>{text}</span></div>; }
function InfoTip({ text }) { return <span className="info-tip" tabIndex="0" aria-label={text} title={text}><Info size={13} /><span role="tooltip">{text}</span></span>; }
function HeaderLabel({ children, help }) { return <span className="header-label">{children}<InfoTip text={help} /></span>; }
function ScreenGlossary({ title = "Terms on this screen", terms }) { return <section className="screen-glossary"><p>SCREEN GUIDE</p><h3>{title}</h3>{terms.map((item) => <Lexicon key={item.term} {...item} />)}</section>; }

function PromotionView({ data, offers, brand, setBrand, mechanic, setMechanic, noTrade, setNoTrade, selected, setSelected, collection }) {
  return <>
    <div className="workspace-tabs">
      <button className="active"><Table2 size={15} /> Promotion matrix</button>
      <span>{offers.length} of {data.promotions.length} offers</span>
    </div>
    <section className="workspace">
      <div className="data-pane">
        <div className="filters">
          <div className="segmented">{brands.map((item) => <button key={item} className={brand === item ? "active" : ""} onClick={() => setBrand(item)}>{item}</button>)}</div>
          <div className="segmented mechanic-filter">{["All", "EIP", "Trade-in", "BYOD+"].map((item) => <button key={item} className={mechanic === item ? "active" : ""} onClick={() => setMechanic(item)}>{item}</button>)}</div>
          <label className="check-filter"><input type="checkbox" checked={noTrade} onChange={(e) => setNoTrade(e.target.checked)} /> No trade-in only</label>
          <Filter size={15} />
        </div>
        <div className="table-scroll"><table>
          <thead><tr><th>Brand / device</th><th><HeaderLabel help="Promotion type: EIP, Trade-in or BYOD+. EIP does not require a traded device; Trade-in does.">Mechanic</HeaderLabel></th><th><HeaderLabel help="Net monthly device payment observed for Low, Mid and High plan tiers. N/C means the tier value was not captured.">Monthly by plan tier</HeaderLabel></th><th><HeaderLabel help="Analyst shorthand that converts the tier ladder into a compact sales-team reading, such as free/free/free.">Internal read</HeaderLabel></th><th><HeaderLabel help="AC means Any Condition. TIV means Trade-in Value. A missing value is shown as Not Captured, never guessed.">AC / TIV</HeaderLabel></th><th>Action</th><th><HeaderLabel help="Official means the evidence comes from a Verizon-owned domain. Open the row to inspect capture time, hash and fallback verification links.">Evidence</HeaderLabel></th></tr></thead>
          <tbody>{offers.map((offer) => <tr key={offer.id} className={selected?.id === offer.id ? "selected" : ""} onClick={() => setSelected(offer)}>
            <td><div className={`device-avatar ${slug(offer.brand)}`}>{offer.brand.charAt(0)}</div><div><BrandTag brand={offer.brand} /><strong>{offer.model}</strong></div></td>
            <td><span className={`mechanic-badge ${slug(offer.mechanic || "EIP")}`}>{offer.mechanic || "EIP"}</span><small>{offer.term} mo. BIC <InfoTip text="BIC = Bill Incentive Credit, applied as recurring bill credits over the promotion term." /></small></td>
            <td><TierLadder ladder={offer.tierLadder} /></td>
            <td><strong className="internal-read">{offer.internalShorthand || "Not classified"}</strong><small>{offer.plan}</small></td>
            <td>{offer.anyCondition ? <b className="ac-badge">AC</b> : <span className="muted">-</span>}<small>{offer.tiv || "TIV not captured"}</small></td>
            <td>{offer.lineAction}</td>
            <td><span className="source-state"><span /> Official</span></td>
          </tr>)}</tbody>
        </table></div>
        {!offers.length && <div className="empty">No offers match the current filters.</div>}
      </div>
      <EvidencePanel offer={selected} collection={collection} />
    </section>
    <footer><Info size={14} /> Promotional eligibility and availability may vary by ZIP code, customer status, inventory and checkout path. Original display text is retained separately from analyst interpretation.</footer>
  </>;
}

function TierLadder({ ladder = {} }) { return <div className="tier-ladder"><TierCell label="L" value={ladder.low} /><TierCell label="M" value={ladder.mid} /><TierCell label="H" value={ladder.high} /></div>; }
function TierCell({ label, value }) { const text = isOnUs(value) ? "ON US" : value == null ? "N/C" : `$${value}`; const help = value == null ? `${label} tier value was not captured; this does not prove ineligibility.` : isOnUs(value) ? `${label} tier net device payment is $0 after promotional bill credits. Service-plan charges, taxes and eligibility conditions still apply.` : `${label} tier net device payment is $${value} per month after promotional credits.`; return <span title={help} className={isOnUs(value) ? "free" : value == null ? "unknown" : "paid"}><b>{label}</b>{text}</span>; }

function TierConditionMatrix({ offer }) {
  return <section className="tier-condition-panel"><div className="tier-condition-title"><strong>Why the same device price can have different value</strong><InfoTip text="Device payment is only one part of the decision. Each plan tier can differ in network access, hotspot, international service and promotion eligibility." /></div><div className="tier-condition-grid">{planTiers.map((tier) => {
    const value = offer.tierLadder?.[tier.key];
    const outcome = value == null ? "N/C" : isOnUs(value) ? "On Us" : `$${value}/mo`;
    const promoCondition = value == null ? "Eligibility not captured" : offer.tradeIn ? offer.anyCondition ? "TI required · AC" : "TI required" : "No TI captured";
    return <article key={tier.key} className={value == null ? "uncaptured" : isOnUs(value) ? "on-us" : "paid"}><span>{tier.short} · {tier.name}</span><strong>{outcome}</strong><b>{promoCondition}</b><p>{tier.network}</p><small>{tier.benefits}</small></article>;
  })}</div><p className="on-us-definition"><strong>On Us</strong> means the net device installment is $0 after BIC. The wireless service plan, taxes and eligibility obligations are still payable.</p></section>;
}

function EvidencePanel({ offer, collection }) {
  if (!offer) return <aside className="evidence-pane empty-evidence">Select an offer to inspect evidence.</aside>;
  const sourcePath = new URL(offer.source).pathname;
  const capture = collection?.sources?.find((item) => new URL(item.url).pathname === sourcePath);
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(`site:verizon.com "${offer.model}" "${offer.verizonDisplay.split("·")[0].trim()}"`)}`;
  return <aside className="evidence-pane">
    <div className="evidence-header"><div><p>SELECTED OFFER</p><h2>{offer.model}</h2></div><a href={offer.source} target="_blank" rel="noreferrer" aria-label="Open exact Verizon source"><ExternalLink size={17} /></a></div>
    <div className="headline-block"><div className="headline-labels"><BrandTag brand={offer.brand} />{Object.values(offer.tierLadder || {}).some(isOnUs) && <span className="on-us-badge">ON US</span>}</div><strong>{offer.headline}</strong><p>{offer.verizonDisplay}</p></div>
    <div className="detail-ladder"><div><span>Mechanic</span><strong>{offer.mechanic || "EIP"}</strong></div><TierLadder ladder={offer.tierLadder} /><code>{offer.internalShorthand}</code></div>
    <TierConditionMatrix offer={offer} />
    <dl className="evidence-facts">
      <div><dt>Retail price</dt><dd>{money(offer.retail, 2)}</dd></div>
      <div><dt>Observed monthly</dt><dd>{money(offer.monthly, 2)}/mo</dd></div>
      <div><dt>Advertised saving</dt><dd className="red">{money(offer.credit, 2)}</dd></div>
      <div><dt>Plan gate</dt><dd>{offer.plan}</dd></div>
      <div><dt>Line action</dt><dd>{offer.lineAction}</dd></div>
      <div><dt>Trade-in</dt><dd>{offer.tradeIn ? "Required" : "Not required"}</dd></div>
      <div><dt>Any Condition</dt><dd>{offer.anyCondition ? "Yes · AC" : "No / not applicable"}</dd></div>
      <div><dt>TIV</dt><dd>{offer.tiv || "Not captured"}</dd></div>
    </dl>
    {offer.tradeIn && <section className="generation-panel"><strong>Eligible trade-in generations</strong><div>{offer.eligibleGenerations?.map((generation) => <span key={generation}>{generation}</span>) || <span>Not captured</span>}</div><p>* Generation buckets describe the analyst normalization. Exact eligible models still require Verizon trade-in detail evidence.</p></section>}
    <section className="raw-evidence"><div><FileText size={15} /><strong>Verizon source text</strong></div><blockquote>{offer.rawText || offer.note}</blockquote></section>
    <section className="source-card"><div className="source-domain"><Globe2 size={15} /><div><strong>{offer.sourceLabel}</strong><span>www.verizon.com</span></div></div><code>{offer.source}</code>{capture ? <div className="capture-proof"><span>US runner · HTTP {capture.status_code}</span><span>{capture.fetched_at}</span><code>SHA-256 {capture.content_hash}</code></div> : <div className="capture-proof pending"><span>Exact PDP awaiting next scheduled capture</span></div>}<div className="verification-actions"><a href={offer.source} target="_blank" rel="noreferrer">Live Verizon page <ArrowUpRight size={14} /></a><a href={searchUrl} target="_blank" rel="noreferrer">Search verification <Search size={13} /></a></div><p className="geo-note">If Verizon blocks your region or browser, use the captured text and hash above, then confirm the same phrase through Search verification.</p></section>
    <section className="analyst-note"><strong>Analyst interpretation</strong><p>{offer.note}</p></section>
    <ScreenGlossary terms={[
      {term:"N/C", text:"Not Captured. The tier-specific value was not exposed in the collected page state."},
      {term:"BIC", text:"Bill Incentive Credit applied over the stated billing term."},
      {term:"On Us", text:"Net device installment is $0 after BIC; service-plan charges and eligibility obligations remain."},
      {term:"Free/Free/Free", text:"Low, Mid and High tiers all show $0 device payment, but plan benefits and qualifying conditions can differ."},
      {term:"Internal read", text:"Compact analyst shorthand for Low / Mid / High plan outcomes."},
      {term:"AC", text:"Any Condition trade-in language is explicit in Verizon evidence."},
      {term:"TIV", text:"Trade-in Value or qualifying value floor for the traded device."}
    ]} />
  </aside>;
}

function PlansView({ plans }) {
  const byod = [
    {tier:"High", plan:"Unlimited Ultimate", promo:75, standard:95, account:10, device:10},
    {tier:"Mid", plan:"Unlimited Plus", promo:60, standard:80, account:10, device:10},
    {tier:"Low", plan:"Unlimited Welcome", promo:50, standard:65, account:10, device:5},
  ];
  return <div className="screen-layout"><section className="plans-view"><div className="section-heading"><div><p>BYOD+ / PLAN ELIGIBILITY</p><h2>Rate plan & BYOD+ ladder</h2></div><a href="https://www.verizon.com/bring-your-own-device/" target="_blank" rel="noreferrer">Official BYOD page <ExternalLink size={14} /></a></div>
    <div className="byod-matrix"><div className="byod-intro"><span className="mechanic-badge byod">BYOD+</span><h3>Bring your own phone</h3><p>Current public pricing combines account-level and BYOD line discounts for 36 months.</p></div>{byod.map((row) => <article key={row.plan}><span>{row.tier} tier</span><strong>{row.plan}</strong><b>${row.promo}<small>/line</small></b><div><span>Standard ${row.standard}</span><em>-${row.account} account · -${row.device} BYOD</em></div></article>)}</div>
    <div className="byod-evidence"><ShieldCheck size={16} /><span>Official terms captured: $10/mo account promo plus $10/mo BYOD discount on Ultimate/Plus; Welcome receives $10 + $5. Credits expire after 36 months; limit one offer per account.</span></div>
    <section className="tier-value-section"><div><p>WHY UPGRADE THE PLAN?</p><h3>If the phone is On Us on every tier, the service is still different</h3><span>Free/Free/Free describes device payment, not identical network or service value.</span></div><div className="tier-value-grid">{planTiers.map((tier) => <article key={tier.key}><b>{tier.short}</b><div><strong>{tier.name}</strong><span>{tier.network}</span><p>{tier.benefits}</p></div></article>)}</div></section>
    <div className="section-heading secondary"><div><p>BASE PLAN REFERENCE</p><h2>Plan features</h2></div><span>Customer state and checkout can change displayed pricing</span></div><div className="plan-table">
    <div className="plan-head"><span>Plan</span><span>Displayed price</span><span>Best fit</span><span>Included signals</span><span>Evidence</span></div>
    {plans.map((plan) => <article key={plan.name}><div><strong>{plan.name}</strong><small>{plan.conditions}</small></div><b>{plan.price}</b><span>{plan.audience}</span><ul>{plan.features.slice(0,3).map((feature) => <li key={feature}><Check size={13} />{feature}</li>)}</ul><a href={plan.source} target="_blank" rel="noreferrer">Official page <ExternalLink size={13} /></a></article>)}
  </div></section><aside><ScreenGlossary title="Plan terms" terms={[
    {term:"BYOD+", text:"Bring Your Own Device promotion combining account and line-level discounts."},
    {term:"On Us", text:"The device installment is $0 after credits; it does not make the service plan free."},
    {term:"Low / Mid / High", text:"Welcome / Plus / Ultimate plan-tier normalization used in this dashboard."},
    {term:"Standard", text:"Displayed base plan price before the captured BYOD+ promotional discounts."},
    {term:"36 months", text:"Discount duration; eligibility loss can end future credits."}
  ]} /></aside></div>;
}

function SourcesView({ targets, promotions, collection }) {
  const counts = promotions.reduce((acc, offer) => ({ ...acc, [offer.source]: (acc[offer.source] || 0) + 1 }), {});
  const statuses = Object.fromEntries((collection?.sources || []).map((source) => [source.url, source]));
  return <div className="screen-layout"><section className="sources-view"><div className="section-heading"><div><p>CRAWL EVIDENCE MAP</p><h2>Exact monitored URLs</h2></div><span>Open the exact page used for each record</span></div>
    {collection && <div className="run-banner"><Activity size={17} /><strong>US collection run #{collection.runId}</strong><span>{collection.sourceCount} sources · {collection.candidateCount} candidates · {collection.startedAt}</span><b>SUCCESS</b></div>}
    <section className="scenario-coverage"><div><p>INTERACTIVE PDP COVERAGE</p><h3>What changes the Terms & Conditions</h3><span>The browser collector can enumerate these option states. A canonical scenario set is needed to control the number of combinations.</span></div><div className="scenario-grid"><Scenario label="Customer" values="New · Existing" status="Next" /><Scenario label="Transaction" values="New line · Add · Upgrade · Port-in" status="Next" /><Scenario label="Plan" values="Low · Mid · High" status="Next" /><Scenario label="Trade-in" values="N to N-5+ · AC · TIV" status="Needs guide" /><Scenario label="Location" values="Fixed US ZIP" status="Needs guide" /></div></section>
    <div className="source-list">{targets.map((target) => { const status = statuses[target.url]; return <article key={target.url}><span className={`priority ${target.priority.toLowerCase()}`}>{target.priority}</span><div><strong>{target.label}</strong><p>{target.capture}</p><code>{target.url}</code></div><div className="source-metrics"><span>{status ? `HTTP ${status.status_code} · ${Math.round(status.html_bytes / 1024)} KB` : `${counts[target.url] || 0} linked offers`}</span><span>{status ? `Hash ${status.content_hash.slice(0, 10)}…` : "Awaiting runner evidence"}</span></div><a href={target.url} target="_blank" rel="noreferrer" aria-label={`Open ${target.label}`}><ExternalLink size={16} /></a></article>; })}</div>
    <div className="method-note"><ShieldCheck size={18} /><div><strong>Evidence policy</strong><p>Every normalized row should retain source URL, observed timestamp, raw visible text, response status and content hash. Search-index evidence must be labeled separately from a successful direct fetch.</p></div></div>
  </section><aside><ScreenGlossary title="Evidence terms" terms={[
    {term:"HTTP 200", text:"The US runner successfully received the page at collection time."},
    {term:"SHA-256", text:"Content fingerprint used to prove whether a page changed between snapshots."},
    {term:"P0", text:"Primary source collected every scheduled run."},
    {term:"P1", text:"Supporting source used for rules or secondary validation."},
    {term:"Indexed", text:"Official Verizon text verified through a search index when direct rendering differs by region."}
  ]} /></aside></div>;
}

function Scenario({ label, values, status }) { return <article><strong>{label}</strong><span>{values}</span><b className={status === "Next" ? "next" : "guide"}>{status}</b></article>; }

function MarketStat({ icon: Icon, label, value, note, accent }) { return <article className={`market-stat ${accent ? "accent" : ""}`}><Icon size={17} /><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }
function BrandTag({ brand }) { return <span className={`brand-tag ${slug(brand)}`}>{brand}</span>; }
function slug(value) { return value.toLowerCase().replace(/[^a-z]/g, ""); }

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
