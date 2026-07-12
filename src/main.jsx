import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight, CalendarDays, Check, ChevronDown, CircleDollarSign,
  Database, ExternalLink, Filter, RefreshCw, Search, ShieldCheck,
  Smartphone, TableProperties, Wifi
} from "lucide-react";
import "./styles.css";

const brands = ["All", "Samsung", "Apple", "Google", "Multi-brand"];

function money(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("promotions");
  const [brand, setBrand] = useState("All");
  const [query, setQuery] = useState("");
  const [noTrade, setNoTrade] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("./data/snapshot.json").then((response) => response.json()).then(setData);
  }, []);

  const offers = useMemo(() => {
    if (!data) return [];
    const term = query.trim().toLowerCase();
    return data.promotions.filter((offer) => {
      const matchesBrand = brand === "All" || offer.brand === brand;
      const matchesTrade = !noTrade || offer.tradeIn === false;
      const haystack = `${offer.brand} ${offer.model} ${offer.headline} ${offer.plan}`.toLowerCase();
      return matchesBrand && matchesTrade && (!term || haystack.includes(term));
    });
  }, [data, brand, query, noTrade]);

  if (!data) return <div className="loading"><RefreshCw className="spin" /> Loading market snapshot</div>;

  const maxCredit = Math.max(...data.promotions.map((item) => item.credit || 0));
  const zeroOffers = data.promotions.filter((item) => item.monthly === 0).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">V</span><span>Promotion Radar</span></div>
        <div className="snapshot"><span className="live-dot" /> Snapshot {data.meta.snapshotDate}</div>
      </header>

      <main>
        <section className="masthead">
          <div>
            <p className="eyebrow">VERIZON · US CONSUMER MARKET</p>
            <h1>Smartphone promotion intelligence</h1>
            <p className="lede">A decision-ready view of device credits, eligibility gates, plans and source evidence.</p>
          </div>
          <a className="source-button" href="https://www.verizon.com/deals/" target="_blank" rel="noreferrer">
            Open Verizon <ArrowUpRight size={17} />
          </a>
        </section>

        <section className="metrics" aria-label="Snapshot summary">
          <Metric icon={Smartphone} label="Tracked offers" value={data.promotions.length} detail="Samsung · Apple · Google" />
          <Metric icon={CircleDollarSign} label="Largest credit" value={money(maxCredit)} detail="Headline device value" />
          <Metric icon={Check} label="$0 device offers" value={zeroOffers} detail="Subject to eligibility" />
          <Metric icon={ShieldCheck} label="Official-source rows" value={`${data.promotions.filter(x => x.confidence === "High").length}/${data.promotions.length}`} detail="Verizon public pages" />
        </section>

        <nav className="tabs" aria-label="Dashboard views">
          <Tab active={tab === "promotions"} onClick={() => setTab("promotions")} icon={TableProperties}>Promotions</Tab>
          <Tab active={tab === "plans"} onClick={() => setTab("plans")} icon={Wifi}>Plans</Tab>
          <Tab active={tab === "sources"} onClick={() => setTab("sources")} icon={Database}>Source map</Tab>
        </nav>

        {tab === "promotions" && <>
          <section className="controls">
            <div className="brand-filter">
              {brands.map((item) => <button key={item} className={brand === item ? "active" : ""} onClick={() => setBrand(item)}>{item}</button>)}
            </div>
            <label className="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search device, plan or condition" /></label>
            <label className="toggle"><input type="checkbox" checked={noTrade} onChange={(e) => setNoTrade(e.target.checked)} /><span /> No trade-in</label>
          </section>

          <section className="table-wrap">
            <div className="table-heading"><div><h2>Current offer matrix</h2><p>{offers.length} matching offers</p></div><Filter size={18} /></div>
            <div className="desktop-table">
              <table>
                <thead><tr><th>Brand / device</th><th>Offer</th><th>Max credit</th><th>Plan gate</th><th>Line action</th><th>Trade-in</th><th>Evidence</th><th></th></tr></thead>
                <tbody>{offers.map((offer) => <tr key={offer.id} onClick={() => setSelected(offer)}>
                  <td><BrandTag brand={offer.brand} /><strong>{offer.model}</strong></td>
                  <td><strong>{offer.headline}</strong><small>{offer.term} mo. bill credits</small></td>
                  <td className="credit">{money(offer.credit)}</td>
                  <td>{offer.plan}</td><td>{offer.lineAction}</td>
                  <td>{offer.tradeIn ? "Required" : "No"}</td>
                  <td><span className="evidence"><span /> {offer.confidence}</span></td>
                  <td><ChevronDown size={17} /></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="mobile-list">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} onClick={() => setSelected(offer)} />)}</div>
          </section>
        </>}

        {tab === "plans" && <section className="plan-grid">{data.plans.map((plan) => <article className="plan" key={plan.name}>
          <div className="plan-top"><div><p>{plan.audience}</p><h2>{plan.name}</h2></div><span className={`confidence ${plan.confidence.toLowerCase()}`}>{plan.confidence}</span></div>
          <strong className="plan-price">{plan.price}</strong>
          <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
          <p className="conditions">{plan.conditions}</p>
          <a href={plan.source} target="_blank" rel="noreferrer">Verify plan <ExternalLink size={14} /></a>
        </article>)}</section>}

        {tab === "sources" && <section className="sources-panel">
          <div className="section-intro"><div><p className="eyebrow">CRAWL ARCHITECTURE</p><h2>Where the weekly run should look</h2></div><p>Start broad, then open each offer detail and product page. Preserve raw evidence before normalization.</p></div>
          {data.targets.map((target) => <article className="source-row" key={target.url}><span className={`priority ${target.priority.toLowerCase()}`}>{target.priority}</span><div><strong>{target.label}</strong><p>{target.capture}</p></div><a href={target.url} target="_blank" rel="noreferrer">{new URL(target.url).pathname}<ExternalLink size={15} /></a></article>)}
        </section>}

        <footer><CalendarDays size={15} /> Observed {data.meta.snapshotDate} · {data.meta.disclaimer}</footer>
      </main>

      {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><aside className="detail" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
        <BrandTag brand={selected.brand} /><h2>{selected.model}</h2><p className="detail-headline">{selected.headline}</p>
        <dl><div><dt>Maximum credit</dt><dd>{money(selected.credit)}</dd></div><div><dt>Plan</dt><dd>{selected.plan}</dd></div><div><dt>Line action</dt><dd>{selected.lineAction}</dd></div><div><dt>Trade-in</dt><dd>{selected.tradeIn ? "Required" : "Not required"}</dd></div><div><dt>Term</dt><dd>{selected.term} months</dd></div><div><dt>Observed</dt><dd>{selected.observed}</dd></div></dl>
        <div className="analyst-note"><strong>Analyst note</strong><p>{selected.note}</p></div>
        <a className="source-button full" href={selected.source} target="_blank" rel="noreferrer">Verify on {selected.sourceLabel}<ExternalLink size={16} /></a>
      </aside></div>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }) { return <article className="metric"><div className="metric-icon"><Icon size={19} /></div><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>; }
function Tab({ active, onClick, icon: Icon, children }) { return <button className={active ? "active" : ""} onClick={onClick}><Icon size={17} />{children}</button>; }
function BrandTag({ brand }) { return <span className={`brand-tag ${brand.toLowerCase().replace("-", "")}`}>{brand}</span>; }
function OfferCard({ offer, onClick }) { return <button className="offer-card" onClick={onClick}><div><BrandTag brand={offer.brand} /><span className="evidence"><span /> {offer.confidence}</span></div><h3>{offer.model}</h3><strong>{offer.headline}</strong><dl><div><dt>Credit</dt><dd>{money(offer.credit)}</dd></div><div><dt>Plan</dt><dd>{offer.plan}</dd></div></dl></button>; }

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
