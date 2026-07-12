import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  Activity, ArrowLeft, ArrowUpRight, Check, ChevronRight, CircleDollarSign, Clock3,
  Database, Download, ExternalLink, FileText, Filter, Globe2, Home, Info, RefreshCw,
  Languages, Moon, Radar, Search, ShieldCheck, Smartphone, Sun, Table2, Wifi
} from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./styles.css";

const brands = ["All", "Samsung", "Apple", "Google", "Motorola", "Multi-brand"];
const brandOrder = { Samsung: 0, Apple: 1, Google: 2, Motorola: 3, "Multi-brand": 4 };
const localeCopy = {
  en: {
    overview:"Overview", matrix:"Matrix", plans:"Plans", sources:"Sources", search:"Search offers",
    title:"Promotion intelligence", observed:"Observed", crawlSources:"View crawl sources",
    tracked:"Tracked offers", brands:"3 priority brands", largest:"Largest credit", onUs:"On Us outcomes",
    onUsNote:"$0 device payment after credits", evidence:"Official evidence", domains:"Verizon domains",
    marketSignal:"Market signal", marketNote:"Samsung holds the highest observed device credit; Apple and Google lead selected $0 acquisition offers.",
    matrixTitle:"Promotion matrix", sorted:"Sorted by", brandDevice:"Brand / device", mechanic:"Mechanic",
    monthlyTier:"Monthly by plan tier", internalRead:"Internal read", acTiv:"AC / TIV", action:"Action",
    evidenceCol:"Evidence", noTrade:"No trade-in only", selectedOffer:"SELECTED OFFER", terms:"Terms on this screen",
    retail:"Retail price", monthly:"Observed monthly", saving:"Advertised saving", planGate:"Plan gate",
    lineAction:"Line action", tradeIn:"Trade-in", anyCondition:"Any Condition", notCaptured:"Not captured",
  },
  ko: {
    overview:"개요", matrix:"프로모션", plans:"요금제", sources:"출처", search:"프로모션 검색",
    title:"프로모션 인텔리전스", observed:"수집 기준", crawlSources:"크롤링 출처 보기",
    tracked:"추적 프로모션", brands:"핵심 3개 제조사", largest:"최대 지원금", onUs:"On Us 프로모션",
    onUsNote:"크레딧 적용 후 기기값 $0", evidence:"공식 근거", domains:"Verizon 공식 도메인",
    marketSignal:"시장 시그널", marketNote:"Samsung의 최대 지원금이 가장 높고 Apple과 Google은 일부 $0 신규가입 프로모션을 운영 중입니다.",
    matrixTitle:"프로모션 매트릭스", sorted:"정렬", brandDevice:"제조사 / 모델", mechanic:"프로모션 유형",
    monthlyTier:"요금제별 월 기기값", internalRead:"내부 표현", acTiv:"AC / TIV", action:"가입 조건",
    evidenceCol:"근거", noTrade:"Trade-in 불필요", selectedOffer:"선택 프로모션", terms:"화면 용어 설명",
    retail:"출고가", monthly:"확인된 월 기기값", saving:"프로모션 지원금", planGate:"필수 요금제",
    lineAction:"회선 조건", tradeIn:"Trade-in", anyCondition:"Any Condition", notCaptured:"미수집",
  }
};
function localize(lang, ko, en) { return lang === "ko" ? ko : en; }
const planTiers = [
  {key:"high", short:"H", name:"Unlimited Ultimate", network:"5G Ultra Wideband", benefits:"Premium data · unlimited hotspot · international · 2 device discounts"},
  {key:"mid", short:"M", name:"Unlimited Plus", network:"5G Ultra Wideband", benefits:"Premium data · 30 GB hotspot · 1 connected-device discount"},
  {key:"low", short:"L", name:"Unlimited Welcome", network:"5G", benefits:"Value tier · basic 5G · optional perks"},
];

function modelRank(model) {
  const value = model.toLowerCase();
  if (value.includes("ultra") || value.includes("pro max") || value.includes("pro xl")) return 0;
  if (value.includes("plus") || value.endsWith("+") || value.includes("pro fold") || value.includes("fold")) return 1;
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
function onUsBreadth(offer) { return Object.values(offer.tierLadder || {}).filter(isOnUs).length; }
function lowestOnUsScore(offer) { if (isOnUs(offer.tierLadder?.low)) return 3; if (isOnUs(offer.tierLadder?.mid)) return 2; if (isOnUs(offer.tierLadder?.high)) return 1; return 0; }
function onUsSummary(offer, lang) { const count = onUsBreadth(offer); if (!count) return localize(lang,"확인된 On Us 요금제 없음","No confirmed On Us tier"); const lowest = isOnUs(offer.tierLadder?.low) ? "Welcome" : isOnUs(offer.tierLadder?.mid) ? "Plus" : "Ultimate"; return localize(lang,`${count}개 요금제 On Us · ${lowest}까지`,`${count}-tier On Us · down to ${lowest}`); }
function sortOffers(a, b, mode) {
  const retailA = a.retail ?? (mode === "retail_asc" ? Number.POSITIVE_INFINITY : -1);
  const retailB = b.retail ?? (mode === "retail_asc" ? Number.POSITIVE_INFINITY : -1);
  const modelFallback = modelRank(a.model) - modelRank(b.model) || a.model.localeCompare(b.model);
  if (mode === "retail_asc") return retailA - retailB || modelFallback;
  if (mode === "manufacturer") return (brandOrder[a.brand] ?? 9) - (brandOrder[b.brand] ?? 9) || modelFallback || retailB - retailA;
  if (mode === "on_us") return onUsBreadth(b) - onUsBreadth(a) || lowestOnUsScore(b) - lowestOnUsScore(a) || (b.credit || 0) - (a.credit || 0) || modelFallback;
  if (mode === "credit") return (b.credit || 0) - (a.credit || 0) || retailB - retailA || modelFallback;
  return retailB - retailA || modelFallback;
}

function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("vzw-radar-language") || "en");
  const [theme, setTheme] = useState(() => localStorage.getItem("vzw-radar-theme") || "light");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [brand, setBrand] = useState("All");
  const [mechanic, setMechanic] = useState("All");
  const [query, setQuery] = useState("");
  const [noTrade, setNoTrade] = useState(false);
  const [selected, setSelected] = useState(null);
  const [collection, setCollection] = useState(null);
  const [history, setHistory] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [gridOffers, setGridOffers] = useState(null);
  const [sortMode, setSortMode] = useState("retail_desc");
  const ui = localeCopy[lang];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    localStorage.setItem("vzw-radar-theme", theme);
    localStorage.setItem("vzw-radar-language", lang);
  }, [theme, lang]);

  useEffect(() => {
    fetch("./data/snapshot.json").then((response) => response.json()).then((payload) => {
      setData(payload);
      setSelected(payload.promotions[0]);
    });
    fetch("./data/collection-status.json").then((response) => response.ok ? response.json() : null).then(setCollection).catch(() => setCollection(null));
    fetch("./data/history.json").then((response) => response.json()).then(setHistory);
    fetch("./data/scenario-results.json").then((response) => response.ok ? response.json() : null).then(setScenarios).catch(() => setScenarios(null));
    fetch("./data/grid-offers.json").then((response) => response.ok ? response.json() : null).then(setGridOffers).catch(() => setGridOffers(null));
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
    }).sort((a, b) => sortOffers(a, b, sortMode));
  }, [data, brand, mechanic, query, noTrade, sortMode]);

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
        <span className="brand-mark"><Radar size={17} strokeWidth={2.4} /></span><span>Promotion Radar</span>
      </button>
      <nav className="primary-nav">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><Home size={15} /> {ui.overview}</button>
        <button className={tab === "matrix" ? "active" : ""} onClick={() => setTab("matrix")}><Table2 size={15} /> {ui.matrix}</button>
        <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}><Wifi size={15} /> {ui.plans}</button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}><Database size={15} /> {ui.sources}</button>
      </nav>
      <div className="header-actions">
        <label className="global-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ui.search} /></label>
        <div className="view-toggles"><button onClick={() => setLang(lang === "en" ? "ko" : "en")} title={lang === "en" ? "한국어로 보기" : "View in English"}><Languages size={15} /><span>{lang === "en" ? "KO" : "EN"}</span></button><button onClick={() => setTheme(theme === "light" ? "dark" : "light")} title={theme === "light" ? "Dark mode" : "Light mode"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button></div>
        <span className="snapshot-chip"><span /> {data.meta.snapshotDate}</span>
      </div>
    </header>

    <main>
      <section className="page-title">
        <div><p>VERIZON · US CONSUMER</p><h1>{ui.title}</h1></div>
        <div className="page-actions">
          <span><Clock3 size={14} /> {ui.observed} {data.meta.snapshotDate}</span>
          <button onClick={() => setTab("sources")}>{ui.crawlSources} <ChevronRight size={16} /></button>
        </div>
      </section>

      {tab === "overview" && <section className="market-strip">
        <MarketStat icon={Smartphone} label={ui.tracked} value={data.promotions.length} note={ui.brands} />
        <MarketStat icon={CircleDollarSign} label={ui.largest} value={money(maxCredit)} note="Galaxy S26 Ultra" accent />
        <MarketStat icon={Check} label={ui.onUs} value={zeroOffers} note={ui.onUsNote} />
        <MarketStat icon={ShieldCheck} label={ui.evidence} value={`${data.promotions.filter((x) => x.confidence === "High").length}/${data.promotions.length}`} note={ui.domains} />
        <div className="market-callout"><Activity size={18} /><div><strong>{ui.marketSignal}</strong><p>{ui.marketNote}</p></div></div>
      </section>}

      {tab === "overview" && <TrendOverview history={history} collection={collection} onOpenMatrix={() => setTab("matrix")} lang={lang} />}
      {tab === "matrix" && <PromotionView data={data} offers={offers} scenarios={scenarios} brand={brand} setBrand={setBrand} mechanic={mechanic} setMechanic={setMechanic} noTrade={noTrade} setNoTrade={setNoTrade} selected={selected} setSelected={setSelected} collection={collection} lang={lang} sortMode={sortMode} setSortMode={setSortMode} />}
      {tab === "plans" && <PlansView plans={data.plans} lang={lang} />}
      {tab === "sources" && <SourcesView targets={data.targets} promotions={data.promotions} collection={collection} gridOffers={gridOffers} lang={lang} />}
    </main>
  </div>;
}

function TrendOverview({ history, collection, onOpenMatrix, lang }) {
  if (!history) return <div className="overview-loading">Loading biweekly history...</div>;
  const trend = history.snapshots.map((snapshot) => ({
    ...snapshot,
    eip: snapshot.mechanics.EIP,
    tradeIn: snapshot.mechanics["Trade-in"],
    byod: snapshot.mechanics["BYOD+"],
    Samsung: snapshot.brands.Samsung,
    Apple: snapshot.brands.Apple,
    Google: snapshot.brands.Google,
    SamsungFree: snapshot.brandMetrics.Samsung.free,
    AppleFree: snapshot.brandMetrics.Apple.free,
    GoogleFree: snapshot.brandMetrics.Google.free,
  }));
  const latest = history.snapshots[history.snapshots.length - 1];

  return <section className="overview-grid">
    <div className="overview-main">
      <section className="chart-panel brand-trend">
        <div className="panel-title"><div><p>{localize(lang,"제조사 프로모션 트렌드","OEM PROMOTION TREND")}</p><h2>{localize(lang,"제조사별 최대 확인 지원금","Best observed promo credit by manufacturer")} <InfoTip text={localize(lang,"각 스냅샷에서 제조사별로 확인된 최대 기기 지원금이며 포트폴리오 평균 할인율은 아닙니다.","For each snapshot, this plots the highest verified device credit found for each manufacturer. It does not represent average portfolio discount.")} /></h2></div><button onClick={onOpenMatrix}>{localize(lang,"매트릭스 열기","Open offer matrix")} <ChevronRight size={15} /></button></div>
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
        <div className="panel-title"><div><p>{localize(lang,"제조사 On Us 트렌드","OEM ON US TREND")}</p><h2>{localize(lang,"제조사별 On Us 프로모션 수","On Us promotion count by manufacturer")} <InfoTip text={localize(lang,"각 스냅샷에서 요금제 크레딧 적용 후 월 기기값이 $0으로 확인된 프로모션 행 수입니다.","Number of promotion rows with a verified $0 monthly device payment after plan credits in each snapshot.")} /></h2></div></div>
        <div className="chart-area short"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{top:8,right:18,left:0,bottom:0}}>
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis dataKey="date" tick={{fontSize:11,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{border:"1px solid #e5e8eb",borderRadius:8,fontSize:12}} />
          <Legend wrapperStyle={{fontSize:11}} />
          <Line type="monotone" dataKey="SamsungFree" name="Samsung" stroke="#1428a0" strokeWidth={2.5} dot={{r:4}} />
          <Line type="monotone" dataKey="AppleFree" name="Apple" stroke="#191f28" strokeWidth={2.5} dot={{r:4}} />
          <Line type="monotone" dataKey="GoogleFree" name="Google" stroke="#34a853" strokeWidth={2.5} dot={{r:4}} />
        </LineChart></ResponsiveContainer></div>
      </section>

      <section className="movement-panel"><div className="panel-title"><div><p>{localize(lang,"주요 변화","WHAT CHANGED")}</p><h2>{localize(lang,"격주 변동 내역","Biweekly movement log")}</h2></div></div>
        <div className="movement-table"><div className="movement-head"><span>Metric</span><span>6/21</span><span>7/12</span><span>Δ</span><span>Interpretation</span></div>{history.movements.map((row) => <article key={row.metric}><strong>{row.metric}</strong><span>{money(row.from)}</span><span>{money(row.to)}</span><b className={row.to-row.from >= 0 ? "up" : "down"}>{money(row.to-row.from)}</b><p>{row.interpretation}</p></article>)}</div>
      </section>
    </div>

    <aside className="overview-side">
      <section className="snapshot-summary"><p>{localize(lang,"최신 스냅샷","LATEST SNAPSHOT")}</p><h2>{latest.date}</h2><div className="summary-number"><strong>{latest.trackedOffers}</strong><span>{localize(lang,"추적 프로모션","tracked offers")}</span></div><dl><div><dt>EIP</dt><dd>{latest.mechanics.EIP}</dd></div><div><dt>Trade-in</dt><dd>{latest.mechanics["Trade-in"]}</dd></div><div><dt>BYOD+</dt><dd>{latest.mechanics["BYOD+"]}</dd></div><div><dt>{localize(lang,"미국 크롤링","US crawl")}</dt><dd>{collection ? `${collection.sourceCount} ${localize(lang,"개 출처 완료","sources complete")}` : localize(lang,"대기 중","Pending")}</dd></div></dl></section>
      <section className="lexicon-panel"><p>{localize(lang,"영업 용어","COMMERCIAL LEXICON")}</p><h3>{localize(lang,"매트릭스 읽는 법","How to read the matrix")}</h3><Lexicon term="On Us" text={localize(lang,"프로모션 bill credits 적용 후 기기 할부금이 $0입니다. 요금제, 세금과 자격조건은 별도입니다.","Net device installment is $0 after promotional bill credits. Service-plan charges, taxes and conditions still apply.")} /><Lexicon term="N/C" text={localize(lang,"Not Captured. 해당 요금제 값을 아직 수집하지 못했으며 비대상이라는 의미는 아닙니다.","Not Captured. The source confirms an offer but does not expose that tier-specific value in the collected state.")} /><Lexicon term="EIP" text={localize(lang,"Trade-in 없이 적용되는 기기 할부 프로모션입니다.","Equipment Installment Plan promotion without a required trade-in.")} /><Lexicon term="Trade-in" text={localize(lang,"기존 기기 반납이 필요한 프로모션입니다.","Device credit requiring an eligible traded device.")} /><Lexicon term="AC" text={localize(lang,"조건을 충족하는 기기를 상태와 관계없이 인정하는 Any Condition입니다.","Any Condition trade-in accepted, subject to eligible model rules.")} /><Lexicon term="TIV" text={localize(lang,"반납 기기의 Trade-in Value 또는 인정 금액 구간입니다.","Trade-in Value or value band attached to the traded model.")} /><Lexicon term="free/free/free" text={localize(lang,"High / Mid / Low 모두 기기값 $0이지만 요금제 혜택과 조건은 다를 수 있습니다.","High / Mid / Low tiers all show $0 device payment; plan value and qualifying conditions can differ.")} /></section>
      <section className="cadence-panel"><Clock3 size={17} /><div><strong>{history.cadence} snapshot cadence</strong><p>Next direct snapshot should preserve the same customer state, ZIP and offer path.</p></div></section>
    </aside>
  </section>;
}

function Lexicon({ term, text }) { return <div className="lexicon-row"><b>{term}</b><span>{text}</span></div>; }
function InfoTip({ text }) {
  const trigger = useRef(null);
  const [position, setPosition] = useState(null);
  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(128, Math.min(window.innerWidth - 128, rect.left + rect.width / 2)), top: rect.bottom + 8 });
  };
  return <><span ref={trigger} className="info-tip" tabIndex="0" aria-label={text} onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)}><Info size={13} /></span>{position && createPortal(<span className="tooltip-portal" role="tooltip" style={position}>{text}</span>, document.body)}</>;
}
function HeaderLabel({ children, help }) { return <span className="header-label">{children}<InfoTip text={help} /></span>; }
function ScreenGlossary({ title = "Terms on this screen", terms }) { return <section className="screen-glossary"><p>SCREEN GUIDE</p><h3>{title}</h3>{terms.map((item) => <Lexicon key={item.term} {...item} />)}</section>; }

function PromotionView({ data, offers, scenarios, brand, setBrand, mechanic, setMechanic, noTrade, setNoTrade, selected, setSelected, collection, lang, sortMode, setSortMode }) {
  const ui = localeCopy[lang];
  const [matrixWidth, setMatrixWidth] = useState(68);
  const [screenshotOffer, setScreenshotOffer] = useState(null);
  const sortLabels = {
    retail_desc: localize(lang,"출고가 높은 순","Retail: high to low"),
    retail_asc: localize(lang,"출고가 낮은 순","Retail: low to high"),
    manufacturer: localize(lang,"제조사·상위 모델 순","Manufacturer & flagship"),
    on_us: localize(lang,"On Us 강도 순","On Us strength"),
    credit: localize(lang,"지원금 높은 순","Credit: high to low"),
  };
  return <>
    <div className="workspace-tabs">
      <button className="active"><Table2 size={15} /> {ui.matrixTitle}</button>
      <div className="workspace-meta"><span className="screenshot-hint"><ShieldCheck size={13} /> {localize(lang,"Official을 누르면 수집 당시 Verizon 화면을 확인할 수 있습니다.","Select Official to view the captured Verizon screen.")}</span><span>{ui.sorted}: {sortLabels[sortMode]} · {offers.length} / {data.promotions.length}</span></div>
    </div>
    <section className={`workspace ${screenshotOffer ? "evidence-compare" : ""}`} style={{"--matrix-width": `${matrixWidth}%`}}>
      {screenshotOffer ? <CapturedEvidencePane item={screenshotOffer} onClose={() => setScreenshotOffer(null)} lang={lang} /> : <div className="data-pane">
        <div className="filters">
          <div className="segmented">{brands.map((item) => <button key={item} className={brand === item ? "active" : ""} onClick={() => setBrand(item)}>{item}</button>)}</div>
          <div className="segmented mechanic-filter">{["All", "EIP", "Trade-in", "BYOD+"].map((item) => <button key={item} className={mechanic === item ? "active" : ""} onClick={() => setMechanic(item)}>{item}</button>)}</div>
          <label className="check-filter"><input type="checkbox" checked={noTrade} onChange={(e) => setNoTrade(e.target.checked)} /> {ui.noTrade}</label>
          <label className="sort-control"><Filter size={14} /><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label={ui.sorted}>{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="table-scroll"><table>
          <thead><tr><th>{ui.brandDevice}</th><th><HeaderLabel help={localize(lang,"프로모션 유형: EIP, Trade-in, BYOD+입니다.","Promotion type: EIP, Trade-in or BYOD+.")}>{ui.mechanic}</HeaderLabel></th><th><HeaderLabel help={localize(lang,"High / Mid / Low 순서의 월 기기값이며 N/C는 미수집입니다.","Net monthly device payment in High / Mid / Low order. N/C means not captured.")}>{ui.monthlyTier}</HeaderLabel></th><th><HeaderLabel help={localize(lang,"High / Mid / Low 순서의 내부 축약 표현입니다.","Analyst shorthand in High / Mid / Low order.")}>{ui.internalRead}</HeaderLabel></th><th><HeaderLabel help={localize(lang,"AC는 Any Condition, TIV는 Trade-in Value입니다.","AC means Any Condition. TIV means Trade-in Value.")}>{ui.acTiv}</HeaderLabel></th><th>{ui.action}</th><th><HeaderLabel help={localize(lang,"Verizon 공식 도메인의 수집 근거입니다.","Evidence captured from a Verizon-owned domain.")}>{ui.evidenceCol}</HeaderLabel></th></tr></thead>
          <tbody>{offers.map((offer) => { const capturedSource = findCapturedSource(collection, evidenceUrl(offer)); const matchedScenario = findMatchedScenario(scenarios, offer); return <tr key={offer.id} className={selected?.id === offer.id ? "selected" : ""} onClick={() => setSelected(offer)}>
            <td><div className={`device-avatar ${slug(offer.brand)}`}>{offer.brand.charAt(0)}</div><div><BrandTag brand={offer.brand} /><strong>{offer.model}</strong></div></td>
            <td><span className={`mechanic-badge ${slug(offer.mechanic || "EIP")}`}>{offer.mechanic || "EIP"}</span><small>{localize(lang,`${offer.term}개월 bill credits`,`${offer.term}-month bill credits`)}</small></td>
            <td><TierLadder ladder={offer.tierLadder} /></td>
            <td><strong className="internal-read">{offer.internalShorthand || "Not classified"}</strong><small>{offer.plan}</small><span className="on-us-summary">{onUsSummary(offer, lang)}</span></td>
            <td>{offer.anyCondition ? <b className="ac-badge">AC</b> : <span className="muted">-</span>}<small>{offer.tiv || "TIV not captured"}</small></td>
            <td>{offer.lineAction}</td>
            <td><button className={`source-state ${matchedScenario ? "matched" : "pending"}`} disabled={!matchedScenario} onClick={(event) => { event.stopPropagation(); setSelected(offer); setScreenshotOffer({offer, capture: capturedSource, scenario: matchedScenario}); }} title={matchedScenario ? localize(lang,"동일 조건 시나리오 재생","Replay matched purchase scenario") : localize(lang,"동일 조건 검증 대기 중","Exact scenario match pending")}><span /> {matchedScenario ? "Matched" : "Pending"} <FileText size={12} /></button></td>
          </tr>})}</tbody>
        </table></div>
        {!offers.length && <div className="empty">No offers match the current filters.</div>}
      </div>}
      {!screenshotOffer && <SplitHandle value={matrixWidth} onChange={setMatrixWidth} lang={lang} />}
      <EvidencePanel offer={selected} collection={collection} lang={lang} />
    </section>
    <footer><Info size={14} /> Promotional eligibility and availability may vary by ZIP code, customer status, inventory and checkout path. Original display text is retained separately from analyst interpretation.</footer>
  </>;
}

function findCapturedSource(collection, url) {
  if (!collection?.sources) return null;
  const target = new URL(url);
  return collection.sources.find((item) => { const source = new URL(item.url); return source.pathname === target.pathname && (!target.search || source.search === target.search); })
    || collection.sources.find((item) => new URL(item.url).pathname === target.pathname);
}
function evidenceUrl(offer) {
  const slugs = {
    "Galaxy S26 Ultra":"samsung-galaxy-s26-ultra", "Galaxy S26+":"samsung-galaxy-s26-plus",
    "Galaxy S26":"samsung-galaxy-s26", "Pixel 10":"google-pixel-10", "iPhone 17e":"apple-iphone-17e",
  };
  return slugs[offer.model] ? `https://www.verizon.com/smartphones/${slugs[offer.model]}/` : offer.source;
}
function findMatchedScenario(payload, offer) {
  return payload?.results?.find((item) => item.status === "verified" && item.model === offer.model
    && item.requestedState?.plan === offer.plan && item.finalPrice != null
    && Math.abs(item.finalPrice - offer.monthly) < 0.02) || null;
}

function CapturedEvidencePane({ item, onClose, lang }) {
  const steps = item.scenario?.steps?.filter((step) => step.screenshot) || [];
  const [activeStep, setActiveStep] = useState(Math.max(0, steps.length - 1));
  const image = steps[activeStep]?.screenshot || item.capture?.screenshot;
  return <section className="captured-evidence-pane"><header><div><p>MATCHED SCENARIO REPLAY</p><h2>{item.offer.model}</h2><span>{item.scenario.scenarioId} · {item.scenario.status}</span></div><button className="back-matrix" onClick={onClose}><ArrowLeft size={14} />{localize(lang,"매트릭스로 돌아가기","Back to matrix")}</button></header>{steps.length > 0 && <nav className="scenario-steps">{steps.map((step, index) => <button key={`${step.name}-${index}`} className={activeStep === index ? "active" : ""} onClick={() => setActiveStep(index)}><span>{index + 1}</span>{step.name}<b>{step.verified ? "Verified" : "Failed"}</b></button>)}</nav>}<div className="longshot-scroll">{image ? <img src={image} alt={`${item.offer.model} Verizon scenario capture`} /> : <p>No captured screen</p>}</div><footer>{localize(lang,"왼쪽 단계별 상태와 오른쪽 동일 scenarioId 결과를 비교합니다.","Compare each captured state with the same scenarioId result on the right.")}</footer></section>;
}

function SplitHandle({ value, onChange, lang }) {
  const startResize = (event) => {
    event.preventDefault();
    const workspace = event.currentTarget.parentElement;
    const move = (pointerEvent) => {
      const rect = workspace.getBoundingClientRect();
      onChange(Math.max(48, Math.min(78, ((pointerEvent.clientX - rect.left) / rect.width) * 100)));
    };
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); document.body.classList.remove("resizing"); };
    document.body.classList.add("resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  return <div className="split-handle" role="separator" aria-orientation="vertical" aria-valuemin="48" aria-valuemax="78" aria-valuenow={Math.round(value)} aria-label={localize(lang,"매트릭스와 상세 패널 너비 조절","Resize matrix and offer detail panels")} tabIndex="0" onPointerDown={startResize} onKeyDown={(event) => { if (event.key === "ArrowLeft") onChange(Math.max(48, value - 2)); if (event.key === "ArrowRight") onChange(Math.min(78, value + 2)); }}><span /></div>;
}

function TierLadder({ ladder = {} }) { return <div className="tier-ladder"><TierCell label="H" value={ladder.high} /><TierCell label="M" value={ladder.mid} /><TierCell label="L" value={ladder.low} /></div>; }
function TierCell({ label, value }) { const text = isOnUs(value) ? "ON US" : value == null ? "N/C" : `$${value}`; const help = value == null ? `${label} tier value was not captured; this does not prove ineligibility.` : isOnUs(value) ? `${label} tier net device payment is $0 after promotional bill credits. Service-plan charges, taxes and eligibility conditions still apply.` : `${label} tier net device payment is $${value} per month after promotional credits.`; return <span title={help} className={isOnUs(value) ? "free" : value == null ? "unknown" : "paid"}><b>{label}</b>{text}</span>; }

function TierConditionMatrix({ offer, lang }) {
  return <section className="tier-condition-panel"><div className="tier-condition-title"><strong>{localize(lang,"같은 기기값이어도 요금제 가치가 다른 이유","Why the same device price can have different value")}</strong><InfoTip text={localize(lang,"기기값 외에도 네트워크, hotspot, international 혜택과 프로모션 자격이 다를 수 있습니다.","Each plan tier can differ in network access, hotspot, international service and promotion eligibility.")} /></div><div className="tier-condition-grid">{planTiers.map((tier) => {
    const value = offer.tierLadder?.[tier.key];
    const outcome = value == null ? "N/C" : isOnUs(value) ? "On Us" : `$${value}/mo`;
    const promoCondition = value == null ? localize(lang,"자격조건 미수집","Eligibility not captured") : offer.tradeIn ? offer.anyCondition ? "TI required · AC" : "TI required" : localize(lang,"TI 불필요 확인","No TI captured");
    return <article key={tier.key} className={value == null ? "uncaptured" : isOnUs(value) ? "on-us" : "paid"}><span>{tier.short} · {tier.name}</span><strong>{outcome}</strong><b>{promoCondition}</b><p>{tier.network}</p><small>{tier.benefits}</small></article>;
  })}</div><p className="on-us-definition"><strong>On Us</strong> {localize(lang,"는 프로모션 bill credits 적용 후 기기 할부금이 $0이라는 뜻입니다. 무선 요금제, 세금과 자격조건은 별도입니다.","means the net device installment is $0 after promotional bill credits. The wireless service plan, taxes and eligibility obligations are still payable.")}</p></section>;
}

function ConditionEvidence({ offer, lang }) {
  const evidence = offer.conditionEvidence || {};
  return <section className="condition-panel"><div className="tier-condition-title"><strong>{localize(lang,"Trade-in 기기 상태 확인","Trade-in condition check")}</strong><InfoTip text={localize(lang,"Damaged 조건 결과와 Verizon의 Any condition 원문이 일치할 때 AC로 확인합니다. 배터리 팽창, 잠금, 분실/도난은 별도 예외입니다.","AC is confirmed only when damaged-condition treatment and explicit Verizon Any condition language align.")} /></div><div className="condition-grid"><article><span>GOOD</span><strong>{evidence.good || localize(lang,"시나리오 미수집","Scenario not captured")}</strong></article><article className={offer.anyCondition ? "confirmed" : "pending"}><span>DAMAGED</span><strong>{evidence.damaged || localize(lang,"시나리오 미수집","Scenario not captured")}</strong></article></div><dl><div><dt>AC text</dt><dd>{offer.anyCondition ? localize(lang,"원문에서 명시적으로 확인","Explicit in source text") : localize(lang,"미확인","Not found")}</dd></div><div><dt>Battery swelling</dt><dd>{evidence.batterySwelling || "N/C"}</dd></div><div><dt>Activation lock</dt><dd>{evidence.activationLock || "N/C"}</dd></div><div><dt>Lost / stolen</dt><dd>{evidence.lostOrStolen || "N/C"}</dd></div></dl></section>;
}

function EvidencePanel({ offer, collection, lang }) {
  if (!offer) return <aside className="evidence-pane empty-evidence">Select an offer to inspect evidence.</aside>;
  const officialUrl = evidenceUrl(offer);
  const sourcePath = new URL(officialUrl).pathname;
  const capture = collection?.sources?.find((item) => new URL(item.url).pathname === sourcePath);
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(`site:verizon.com "${offer.model}" "${offer.verizonDisplay.split("·")[0].trim()}"`)}`;
  return <aside className="evidence-pane">
    <div className="evidence-header"><div><p>{localeCopy[lang].selectedOffer}</p><h2>{offer.model}</h2></div><a href={officialUrl} target="_blank" rel="noreferrer" aria-label="Open exact Verizon source"><ExternalLink size={17} /></a></div>
    <div className="headline-block"><div className="headline-labels"><BrandTag brand={offer.brand} />{Object.values(offer.tierLadder || {}).some(isOnUs) && <span className="on-us-badge">ON US</span>}</div><strong>{offer.headline}</strong><p>{offer.verizonDisplay}</p></div>
    <div className="detail-ladder"><div><span>Mechanic</span><strong>{offer.mechanic || "EIP"}</strong></div><TierLadder ladder={offer.tierLadder} /><code>{offer.internalShorthand}</code></div>
    <TierConditionMatrix offer={offer} lang={lang} />
    <dl className="evidence-facts">
      <div><dt>{localeCopy[lang].retail}</dt><dd>{money(offer.retail, 2)}</dd></div>
      <div><dt>{localeCopy[lang].monthly}</dt><dd>{money(offer.monthly, 2)}/mo</dd></div>
      <div><dt>{localeCopy[lang].saving}</dt><dd className="red">{money(offer.credit, 2)}</dd></div>
      <div><dt>{localeCopy[lang].planGate}</dt><dd>{offer.plan}</dd></div>
      <div><dt>{localeCopy[lang].lineAction}</dt><dd>{offer.lineAction}</dd></div>
      <div><dt>{localeCopy[lang].tradeIn}</dt><dd>{offer.tradeIn ? localize(lang,"필수","Required") : localize(lang,"불필요","Not required")}</dd></div>
      <div><dt>{localeCopy[lang].anyCondition}</dt><dd>{offer.anyCondition ? "Yes · AC" : localize(lang,"해당 없음","Not applicable")}</dd></div>
      <div><dt>TIV</dt><dd>{offer.tiv || "Not captured"}</dd></div>
    </dl>
    {offer.tradeIn && <section className="generation-panel"><strong>Eligible trade-in generations</strong><div>{offer.eligibleGenerations?.map((generation) => <span key={generation}>{generation}</span>) || <span>Not captured</span>}</div><p>* Generation buckets describe the analyst normalization. Exact eligible models still require Verizon trade-in detail evidence.</p></section>}
    {offer.tradeIn && <ConditionEvidence offer={offer} lang={lang} />}
    <section className="raw-evidence"><div><FileText size={15} /><strong>Verizon source text</strong></div><blockquote>{offer.rawText || offer.note}</blockquote></section>
    <section className="source-card"><div className="source-domain"><Globe2 size={15} /><div><strong>{offer.sourceLabel}</strong><span>www.verizon.com</span></div></div><code>{offer.source}</code>{capture ? <div className="capture-proof"><span>US runner · HTTP {capture.status_code}</span><span>{capture.fetched_at}</span><code>SHA-256 {capture.content_hash}</code></div> : <div className="capture-proof pending"><span>Exact PDP awaiting next scheduled capture</span></div>}<div className="verification-actions"><a href={offer.source} target="_blank" rel="noreferrer">Live Verizon page <ArrowUpRight size={14} /></a><a href={searchUrl} target="_blank" rel="noreferrer">Search verification <Search size={13} /></a><a href="./downloads/vzw-evidence-pack-latest.zip" download>Evidence pack <Download size={13} /></a></div><p className="geo-note">{localize(lang,"한국에서 Verizon이 차단되면 회사 승인 미국 VPN/VDI로 Live page를 확인하세요. 출처 JSON, CSV, 수집시각, SHA-256은 Evidence pack에서 오프라인 검증할 수 있습니다.","If Verizon blocks your region, use a company-approved US VPN/VDI for the live page. The Evidence pack provides source JSON, CSV, collection timestamps and SHA-256 hashes for offline review.")}</p></section>
    <section className="analyst-note"><strong>Analyst interpretation</strong><p>{offer.note}</p></section>
    <ScreenGlossary terms={[
      {term:"N/C", text:"Not Captured. The tier-specific value was not exposed in the collected page state."},
      {term:"On Us", text:"Net device installment is $0 after promotional bill credits; service-plan charges and eligibility obligations remain."},
      {term:"Free/Free/Free", text:"High, Mid and Low tiers all show $0 device payment, but plan benefits and qualifying conditions can differ."},
      {term:"Internal read", text:"Compact analyst shorthand in High / Mid / Low order."},
      {term:"AC", text:"Any Condition trade-in language is explicit in Verizon evidence."},
      {term:"TIV", text:"Trade-in Value or qualifying value floor for the traded device."}
    ]} />
  </aside>;
}

function PlansView({ plans, lang }) {
  const byod = [
    {tier:"High", plan:"Unlimited Ultimate", promo:75, standard:95, account:10, device:10},
    {tier:"Mid", plan:"Unlimited Plus", promo:60, standard:80, account:10, device:10},
    {tier:"Low", plan:"Unlimited Welcome", promo:50, standard:65, account:10, device:5},
  ];
  return <div className="screen-layout"><section className="plans-view"><div className="section-heading"><div><p>BYOD+ / PLAN ELIGIBILITY</p><h2>{localize(lang,"요금제 및 BYOD+ 구조","Rate plan & BYOD+ ladder")}</h2></div><a href="https://www.verizon.com/bring-your-own-device/" target="_blank" rel="noreferrer">{localize(lang,"BYOD 공식 페이지","Official BYOD page")} <ExternalLink size={14} /></a></div>
    <div className="byod-matrix"><div className="byod-intro"><span className="mechanic-badge byod">BYOD+</span><h3>Bring your own phone</h3><p>Current public pricing combines account-level and BYOD line discounts for 36 months.</p></div>{byod.map((row) => <article key={row.plan}><span>{row.tier} tier</span><strong>{row.plan}</strong><b>${row.promo}<small>/line</small></b><div><span>Standard ${row.standard}</span><em>-${row.account} account · -${row.device} BYOD</em></div></article>)}</div>
    <div className="byod-evidence"><ShieldCheck size={16} /><span>Official terms captured: $10/mo account promo plus $10/mo BYOD discount on Ultimate/Plus; Welcome receives $10 + $5. Credits expire after 36 months; limit one offer per account.</span></div>
    <section className="tier-value-section"><div><p>{localize(lang,"왜 상위 요금제를 선택하는가?","WHY UPGRADE THE PLAN?")}</p><h3>{localize(lang,"모든 요금제에서 On Us여도 서비스는 다릅니다","If the phone is On Us on every tier, the service is still different")}</h3><span>{localize(lang,"Free/Free/Free는 기기값을 의미하며 네트워크와 서비스 가치가 동일하다는 뜻이 아닙니다.","Free/Free/Free describes device payment, not identical network or service value.")}</span></div><div className="tier-value-grid">{planTiers.map((tier) => <article key={tier.key}><b>{tier.short}</b><div><strong>{tier.name}</strong><span>{tier.network}</span><p>{tier.benefits}</p></div></article>)}</div></section>
    <div className="section-heading secondary"><div><p>BASE PLAN REFERENCE</p><h2>Plan features</h2></div><span>Customer state and checkout can change displayed pricing</span></div><div className="plan-table">
    <div className="plan-head"><span>Plan</span><span>Displayed price</span><span>Best fit</span><span>Included signals</span><span>Evidence</span></div>
    {plans.map((plan) => <article key={plan.name}><div><strong>{plan.name}</strong><small>{plan.conditions}</small></div><b>{plan.price}</b><span>{plan.audience}</span><ul>{plan.features.slice(0,3).map((feature) => <li key={feature}><Check size={13} />{feature}</li>)}</ul><a href={plan.source} target="_blank" rel="noreferrer">Official page <ExternalLink size={13} /></a></article>)}
  </div></section><aside><ScreenGlossary title="Plan terms" terms={[
    {term:"BYOD+", text:"Bring Your Own Device promotion combining account and line-level discounts."},
    {term:"On Us", text:"The device installment is $0 after credits; it does not make the service plan free."},
    {term:"High / Mid / Low", text:"Ultimate / Plus / Welcome order used throughout this dashboard."},
    {term:"Standard", text:"Displayed base plan price before the captured BYOD+ promotional discounts."},
    {term:"36 months", text:"Discount duration; eligibility loss can end future credits."}
  ]} /></aside></div>;
}

function SourcesView({ targets, promotions, collection, gridOffers, lang }) {
  const counts = promotions.reduce((acc, offer) => ({ ...acc, [offer.source]: (acc[offer.source] || 0) + 1 }), {});
  const statuses = Object.fromEntries((collection?.sources || []).map((source) => [source.url, source]));
  return <div className="screen-layout"><section className="sources-view"><div className="section-heading"><div><p>CRAWL EVIDENCE MAP</p><h2>{localize(lang,"정확한 수집 URL","Exact monitored URLs")}</h2></div><span>{localize(lang,"각 레코드에 사용된 정확한 페이지를 확인하세요","Open the exact page used for each record")}</span></div>
    <GridCoverage grid={gridOffers} lang={lang} />
    {collection && <div className="run-banner"><Activity size={17} /><strong>US collection run #{collection.runId}</strong><span>{collection.sourceCount} sources · {collection.candidateCount} candidates · {collection.startedAt}</span><b>SUCCESS</b></div>}
    <section className="scenario-coverage"><div><p>INTERACTIVE PDP COVERAGE</p><h3>{localize(lang,"Terms & Conditions을 바꾸는 선택값","What changes the Terms & Conditions")}</h3><span>{localize(lang,"표준 시나리오 구성이 완료됐으며 다음 수집기는 각 옵션 상태와 변경된 약관을 저장합니다.","The scenario standard is configured. The next collector will retain each option state and resulting terms.")}</span></div><div className="scenario-grid"><Scenario label="Customer" values="New · Existing" status="Next" /><Scenario label="Transaction" values="New line · Add · Upgrade · Port-in" status="Next" /><Scenario label="Plan" values="Ultimate · Plus · Welcome" status="Configured" /><Scenario label="Trade-in" values="N to N-5+ · AC · TIV" status="Configured" /><Scenario label="Condition" values="Good · Damaged" status="Configured" /><Scenario label="Location" values="ZIP 10001 · Manhattan" status="Configured" /></div></section>
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

function GridCoverage({ grid, lang }) {
  if (!grid) return <section className="grid-coverage pending"><div><p>ALL-BRAND GRID</p><h3>{localize(lang,"다음 수집 대기 중","Awaiting next collection")}</h3></div></section>;
  return <section className="grid-coverage"><header><div><p>ALL-BRAND GRID · DETAILS PIPELINE</p><h3>{localize(lang,"제조사별 공식 Grid 수집 범위","Official Grid coverage by manufacturer")}</h3></div><span>{grid.generatedAt}</span></header><div className="coverage-cards">{Object.entries(grid.coverage || {}).map(([brand, stats]) => <article key={brand}><strong>{brand}</strong><div><span>{localize(lang,"카드 확인","Card confirmed")}</span><b>{stats.cardConfirmed}</b></div><div><span>{localize(lang,"조건 확인","Details confirmed")}</span><b>{stats.detailsConfirmed}</b></div><small>{stats.detailsConfirmed > 0 ? localize(lang,"조건 본문 확보","Terms captured") : localize(lang,"Details 본문 대기","Details pending")}</small></article>)}</div><footer><ShieldCheck size={15} /><span>{localize(lang,"Card confirmed는 가격·Retail·Saving의 공식 노출을 뜻하며, Details confirmed만 요금제 및 자격조건까지 확인된 상태입니다.","Card confirmed covers advertised price, retail and saving. Only Details confirmed includes plan and eligibility terms.")}</span></footer></section>;
}

function Scenario({ label, values, status }) { return <article><strong>{label}</strong><span>{values}</span><b className={status.toLowerCase()}>{status}</b></article>; }

function MarketStat({ icon: Icon, label, value, note, accent }) { return <article className={`market-stat ${accent ? "accent" : ""}`}><Icon size={17} /><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }
function BrandTag({ brand }) { return <span className={`brand-tag ${slug(brand)}`}>{brand}</span>; }
function slug(value) { return value.toLowerCase().replace(/[^a-z]/g, ""); }

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
