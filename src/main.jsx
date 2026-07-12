import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowUpRight, Check, ChevronRight, CircleDollarSign, Clock3,
  Database, ExternalLink, FileText, Filter, Globe2, Home, Info, RefreshCw,
  Search, ShieldCheck, Smartphone, Table2, Wifi, X
} from "lucide-react";
import "./styles.css";

const brands = ["All", "Samsung", "Apple", "Google", "Multi-brand"];

function money(value, digits = 0) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: digits
  }).format(value);
}

function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("promotions");
  const [brand, setBrand] = useState("All");
  const [query, setQuery] = useState("");
  const [noTrade, setNoTrade] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("./data/snapshot.json").then((response) => response.json()).then((payload) => {
      setData(payload);
      setSelected(payload.promotions[0]);
    });
  }, []);

  const resetHome = () => {
    setTab("promotions");
    setBrand("All");
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
        && (!noTrade || offer.tradeIn === false)
        && (!term || haystack.includes(term));
    });
  }, [data, brand, query, noTrade]);

  if (!data) return <div className="loading"><RefreshCw className="spin" /> Loading Verizon snapshot</div>;

  const maxCredit = Math.max(...data.promotions.map((item) => item.credit || 0));
  const zeroOffers = data.promotions.filter((item) => item.monthly === 0).length;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand-lockup" onClick={resetHome} aria-label="Promotion Radar home">
        <span className="brand-mark">V</span><span>Promotion Radar</span>
      </button>
      <nav className="primary-nav">
        <button className={tab === "promotions" ? "active" : ""} onClick={() => setTab("promotions")}><Home size={15} /> Overview</button>
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

      <section className="market-strip">
        <MarketStat icon={Smartphone} label="Tracked offers" value={data.promotions.length} note="3 priority brands" />
        <MarketStat icon={CircleDollarSign} label="Largest credit" value={money(maxCredit)} note="Galaxy S26 Ultra" accent />
        <MarketStat icon={Check} label="$0 monthly" value={zeroOffers} note="Eligibility required" />
        <MarketStat icon={ShieldCheck} label="Official evidence" value={`${data.promotions.filter((x) => x.confidence === "High").length}/${data.promotions.length}`} note="Verizon domains" />
        <div className="market-callout"><Activity size={18} /><div><strong>Market signal</strong><p>Samsung holds the highest observed device credit; Apple and Google lead selected $0 acquisition offers.</p></div></div>
      </section>

      {tab === "promotions" && <PromotionView data={data} offers={offers} brand={brand} setBrand={setBrand} noTrade={noTrade} setNoTrade={setNoTrade} selected={selected} setSelected={setSelected} />}
      {tab === "plans" && <PlansView plans={data.plans} />}
      {tab === "sources" && <SourcesView targets={data.targets} promotions={data.promotions} />}
    </main>
  </div>;
}

function PromotionView({ data, offers, brand, setBrand, noTrade, setNoTrade, selected, setSelected }) {
  return <>
    <div className="workspace-tabs">
      <button className="active"><Table2 size={15} /> Promotion matrix</button>
      <span>{offers.length} of {data.promotions.length} offers</span>
    </div>
    <section className="workspace">
      <div className="data-pane">
        <div className="filters">
          <div className="segmented">{brands.map((item) => <button key={item} className={brand === item ? "active" : ""} onClick={() => setBrand(item)}>{item}</button>)}</div>
          <label className="check-filter"><input type="checkbox" checked={noTrade} onChange={(e) => setNoTrade(e.target.checked)} /> No trade-in only</label>
          <Filter size={15} />
        </div>
        <div className="table-scroll"><table>
          <thead><tr><th>Brand / device</th><th>Verizon display</th><th>Save</th><th>Plan requirement</th><th>Action</th><th>Trade-in</th><th>Source</th></tr></thead>
          <tbody>{offers.map((offer) => <tr key={offer.id} className={selected?.id === offer.id ? "selected" : ""} onClick={() => setSelected(offer)}>
            <td><div className={`device-avatar ${slug(offer.brand)}`}>{offer.brand.charAt(0)}</div><div><BrandTag brand={offer.brand} /><strong>{offer.model}</strong></div></td>
            <td><strong className="verizon-value">{offer.verizonDisplay || offer.headline}</strong><small>{offer.term} months · 0% APR</small></td>
            <td><strong className="save-value">{money(offer.credit)}</strong><small>bill credit</small></td>
            <td>{offer.plan}</td><td>{offer.lineAction}</td><td>{offer.tradeIn ? "Required" : "No"}</td>
            <td><span className="source-state"><span /> Official</span></td>
          </tr>)}</tbody>
        </table></div>
        {!offers.length && <div className="empty">No offers match the current filters.</div>}
      </div>
      <EvidencePanel offer={selected} />
    </section>
    <footer><Info size={14} /> Promotional eligibility and availability may vary by ZIP code, customer status, inventory and checkout path. Original display text is retained separately from analyst interpretation.</footer>
  </>;
}

function EvidencePanel({ offer }) {
  if (!offer) return <aside className="evidence-pane empty-evidence">Select an offer to inspect evidence.</aside>;
  return <aside className="evidence-pane">
    <div className="evidence-header"><div><p>SELECTED OFFER</p><h2>{offer.model}</h2></div><a href={offer.source} target="_blank" rel="noreferrer" aria-label="Open exact Verizon source"><ExternalLink size={17} /></a></div>
    <div className="headline-block"><BrandTag brand={offer.brand} /><strong>{offer.headline}</strong><p>{offer.verizonDisplay}</p></div>
    <dl className="evidence-facts">
      <div><dt>Retail price</dt><dd>{money(offer.retail, 2)}</dd></div>
      <div><dt>Observed monthly</dt><dd>{money(offer.monthly, 2)}/mo</dd></div>
      <div><dt>Advertised saving</dt><dd className="red">{money(offer.credit, 2)}</dd></div>
      <div><dt>Plan gate</dt><dd>{offer.plan}</dd></div>
      <div><dt>Line action</dt><dd>{offer.lineAction}</dd></div>
      <div><dt>Trade-in</dt><dd>{offer.tradeIn ? "Required" : "Not required"}</dd></div>
    </dl>
    <section className="raw-evidence"><div><FileText size={15} /><strong>Verizon source text</strong></div><blockquote>{offer.rawText || offer.note}</blockquote></section>
    <section className="source-card"><div className="source-domain"><Globe2 size={15} /><div><strong>{offer.sourceLabel}</strong><span>www.verizon.com</span></div></div><code>{offer.source}</code><a href={offer.source} target="_blank" rel="noreferrer">Open exact crawled page <ArrowUpRight size={14} /></a></section>
    <section className="analyst-note"><strong>Analyst interpretation</strong><p>{offer.note}</p></section>
  </aside>;
}

function PlansView({ plans }) {
  return <section className="plans-view"><div className="section-heading"><div><p>PLAN ELIGIBILITY</p><h2>Rate plan reference</h2></div><span>Pricing requires checkout revalidation</span></div><div className="plan-table">
    <div className="plan-head"><span>Plan</span><span>Displayed price</span><span>Best fit</span><span>Included signals</span><span>Evidence</span></div>
    {plans.map((plan) => <article key={plan.name}><div><strong>{plan.name}</strong><small>{plan.conditions}</small></div><b>{plan.price}</b><span>{plan.audience}</span><ul>{plan.features.slice(0,3).map((feature) => <li key={feature}><Check size={13} />{feature}</li>)}</ul><a href={plan.source} target="_blank" rel="noreferrer">Official page <ExternalLink size={13} /></a></article>)}
  </div></section>;
}

function SourcesView({ targets, promotions }) {
  const counts = promotions.reduce((acc, offer) => ({ ...acc, [offer.source]: (acc[offer.source] || 0) + 1 }), {});
  return <section className="sources-view"><div className="section-heading"><div><p>CRAWL EVIDENCE MAP</p><h2>Exact monitored URLs</h2></div><span>Open the exact page used for each record</span></div>
    <div className="source-list">{targets.map((target) => <article key={target.url}><span className={`priority ${target.priority.toLowerCase()}`}>{target.priority}</span><div><strong>{target.label}</strong><p>{target.capture}</p><code>{target.url}</code></div><div className="source-metrics"><span>{counts[target.url] || 0} linked offers</span><span>Public · no login</span></div><a href={target.url} target="_blank" rel="noreferrer" aria-label={`Open ${target.label}`}><ExternalLink size={16} /></a></article>)}</div>
    <div className="method-note"><ShieldCheck size={18} /><div><strong>Evidence policy</strong><p>Every normalized row should retain source URL, observed timestamp, raw visible text, response status and content hash. Search-index evidence must be labeled separately from a successful direct fetch.</p></div></div>
  </section>;
}

function MarketStat({ icon: Icon, label, value, note, accent }) { return <article className={`market-stat ${accent ? "accent" : ""}`}><Icon size={17} /><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }
function BrandTag({ brand }) { return <span className={`brand-tag ${slug(brand)}`}>{brand}</span>; }
function slug(value) { return value.toLowerCase().replace(/[^a-z]/g, ""); }

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
