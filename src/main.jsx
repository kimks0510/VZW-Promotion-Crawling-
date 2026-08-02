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
    market:"Market", overview:"Overview", matrix:"Matrix", plans:"Plans", sources:"Sources", search:"Search offers",
    title:"Promotion intelligence", observed:"Observed", crawlSources:"View crawl sources",
    tracked:"Tracked offers", brands:"3 priority brands", largest:"Largest credit", onUs:"On Us outcomes",
    onUsNote:"$0 device payment after credits", evidence:"Official evidence", domains:"Verizon domains",
    marketSignal:"Market signal", marketNote:"Samsung holds the highest observed device credit; Apple and Google lead selected $0 acquisition offers.",
    matrixTitle:"Promotion matrix", sorted:"Sorted by", brandDevice:"Brand / device", mechanic:"Mechanic",
    monthlyTier:"Monthly by plan tier", internalRead:"Internal read", acTiv:"AC / TIV", action:"Action",
    evidenceCol:"Evidence", noTrade:"No trade-in only", selectedOffer:"SELECTED OFFER", terms:"Terms on this screen",
    retail:"Retail price", monthly:"Observed monthly", saving:"Advertised saving", planGate:"Plan gate",
    lineAction:"Line action", tradeIn:"Trade-in", anyCondition:"Any Condition", notCaptured:"Not verified",
  },
  ko: {
    market:"시장", overview:"개요", matrix:"프로모션", plans:"요금제", sources:"출처", search:"프로모션 검색",
    title:"프로모션 인텔리전스", observed:"수집 기준", crawlSources:"크롤링 출처 보기",
    tracked:"추적 프로모션", brands:"핵심 3개 제조사", largest:"최대 지원금", onUs:"On Us 프로모션",
    onUsNote:"크레딧 적용 후 기기값 $0", evidence:"공식 근거", domains:"Verizon 공식 도메인",
    marketSignal:"시장 시그널", marketNote:"Samsung의 최대 지원금이 가장 높고 Apple과 Google은 일부 $0 신규가입 프로모션을 운영 중입니다.",
    matrixTitle:"프로모션 매트릭스", sorted:"정렬", brandDevice:"제조사 / 모델", mechanic:"프로모션 유형",
    monthlyTier:"요금제별 월 기기값", internalRead:"내부 표현", acTiv:"AC / TIV", action:"가입 조건",
    evidenceCol:"근거", noTrade:"Trade-in 불필요", selectedOffer:"선택 프로모션", terms:"화면 용어 설명",
    retail:"출고가", monthly:"확인된 월 기기값", saving:"프로모션 지원금", planGate:"필수 요금제",
    lineAction:"회선 조건", tradeIn:"Trade-in", anyCondition:"Any Condition", notCaptured:"미확인",
  }
};
function localize(lang, ko, en) { return lang === "ko" ? ko : en; }
const verizonPlanTiers = [
  {key:"high", short:"H", name:"Unlimited Ultimate", network:"5G Ultra Wideband", benefits:"Premium data · unlimited hotspot · international · 2 device discounts"},
  {key:"mid", short:"M", name:"Unlimited Plus", network:"5G Ultra Wideband", benefits:"Premium data · 30 GB hotspot · 1 connected-device discount"},
  {key:"low", short:"L", name:"Unlimited Welcome", network:"5G", benefits:"Value tier · basic 5G · optional perks"},
];
const attPlanTiers = [
  {key:"high", short:"H", name:"Elite 2.0 / Premium 2.0", network:"AT&T 5G", benefits:"Top current tiers; offer eligibility and maximum credit still depend on the captured terms."},
  {key:"mid", short:"M", name:"Extra 2.0", network:"AT&T 5G", benefits:"Mid tier used when the offer explicitly states Extra 2.0 or higher."},
  {key:"low", short:"L", name:"Value 2.0", network:"AT&T 5G", benefits:"Value tier; some offers state a lower maximum credit than Extra 2.0 or higher."},
];
const tmobilePlanTiers = [
  {key:"high", short:"H", name:"Experience Beyond", network:"T-Mobile 5G", benefits:"Top current tier; captured offers reaching the highest credit typically require this plan or an equivalent Go5G Next grandfathered plan."},
  {key:"mid", short:"M", name:"Experience More", network:"T-Mobile 5G", benefits:"Mid tier; most captured offer minimums (for example $85+/mo plans) map to this tier or higher."},
  {key:"low", short:"L", name:"Essentials / Go5G", network:"T-Mobile 5G", benefits:"Value tier; some offers state a lower maximum credit than Experience More or higher."},
];
function planTiersFor(carrier) { return carrier === "AT&T" ? attPlanTiers : carrier === "T-Mobile" ? tmobilePlanTiers : verizonPlanTiers; }
function verifiedLabel(lang) { return localize(lang,"미확인","Not verified"); }
function displayShorthand(value, lang) { return (value || "").replaceAll("N/C", verifiedLabel(lang)); }
function normalizedShorthand(offer, lang) {
  if (!offer?.tierLadder) return displayShorthand(offer?.internalShorthand, lang);
  return ["high", "mid", "low"].map((key) => {
    const value = offer.tierLadder[key];
    return value == null ? verifiedLabel(lang) : isOnUs(value) ? "free" : `$${value}`;
  }).join(" / ");
}

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
function onUsSummary(offer, lang, carrier="Verizon") { const count = onUsBreadth(offer); if (!count) return localize(lang,"확인된 On Us 요금제 없음","No confirmed On Us tier"); const names = carrier === "AT&T" ? {low:"Value 2.0",mid:"Extra 2.0",high:"Elite/Premium 2.0"} : carrier === "T-Mobile" ? {low:"Essentials/Go5G",mid:"Experience More",high:"Experience Beyond"} : {low:"Welcome",mid:"Plus",high:"Ultimate"}; const lowest = isOnUs(offer.tierLadder?.low) ? names.low : isOnUs(offer.tierLadder?.mid) ? names.mid : names.high; return localize(lang,`${count}개 요금제 On Us · ${lowest}까지`,`${count}-tier On Us · down to ${lowest}`); }
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
  const [carrier, setCarrier] = useState("Verizon");
  const [lang, setLang] = useState(() => localStorage.getItem("vzw-radar-language") || "en");
  const [theme, setTheme] = useState(() => localStorage.getItem("vzw-radar-theme") || "light");
  const [data, setData] = useState(null);
  const [verizonData, setVerizonData] = useState(null);
  const [attData, setAttData] = useState(null);
  const [attEvidence, setAttEvidence] = useState(null);
  const [tmobileData, setTmobileData] = useState(null);
  const [tmobileEvidence, setTmobileEvidence] = useState(null);
  const [attHistory, setAttHistory] = useState(null);
  const [tmobileHistory, setTmobileHistory] = useState(null);
  const [tab, setTab] = useState("market");
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
      setVerizonData(payload);
      setData(payload);
      setSelected(payload.promotions[0]);
    });
    fetch("./data/collection-status.json").then((response) => response.ok ? response.json() : null).then(setCollection).catch(() => setCollection(null));
    fetch("./data/history.json").then((response) => response.json()).then(setHistory);
    fetch("./data/scenario-results.json").then((response) => response.ok ? response.json() : null).then(setScenarios).catch(() => setScenarios(null));
    fetch("./data/grid-offers.json").then((response) => response.ok ? response.json() : null).then(setGridOffers).catch(() => setGridOffers(null));
    fetch("./data/att-snapshot.json").then((response) => response.ok ? response.json() : null).then((payload) => {
      setAttData(payload);
      if (payload) setAttEvidence({offers:payload.promotions.map((item)=>({...item,detail_screenshot:item.detailScreenshot,detail_initial_screenshot:item.detailInitialScreenshot,additional_terms_expanded:item.additionalTermsExpanded,grid_screenshot:`./att-evidence/${item.brand.toLowerCase()}-grid.jpg`,detail_text:item.detailText,detail_params:{promoId:item.offerId},term_months:item.term}))});
    }).catch(() => setAttData(null));
    fetch("./data/tmobile-snapshot.json").then((response) => response.ok ? response.json() : null).then((payload) => {
      setTmobileData(payload);
      if (payload) setTmobileEvidence({offers:payload.promotions.map((item)=>({...item,detail_screenshot:item.detailScreenshot,grid_screenshot:`./tmobile-evidence/${item.brand.toLowerCase()}-grid.jpg`,detail_text:item.detailText,detail_params:{promoId:item.offerId},term_months:item.term}))});
    }).catch(() => setTmobileData(null));
    fetch("./data/att-history.json").then((response) => response.ok ? response.json() : null).then(setAttHistory).catch(() => setAttHistory(null));
    fetch("./data/tmobile-history.json").then((response) => response.ok ? response.json() : null).then(setTmobileHistory).catch(() => setTmobileHistory(null));
  }, []);

  const changeCarrier = (nextCarrier) => {
    const nextData = nextCarrier === "AT&T" ? attData : nextCarrier === "T-Mobile" ? tmobileData : verizonData;
    if (!nextData) return;
    setCarrier(nextCarrier); setData(nextData); setSelected(nextData.promotions[0]);
    setBrand("All"); setMechanic("All"); setQuery(""); setNoTrade(false); setTab("overview");
  };

  const resetHome = () => {
    setTab("market");
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

  if (!data) return <div className="loading"><RefreshCw className="spin" /> Loading promotion snapshot</div>;

  const maxCredit = Math.max(...data.promotions.map((item) => item.credit || 0));
  const maxCreditOffer = data.promotions.find((item) => (item.credit || 0) === maxCredit);
  const zeroOffers = data.promotions.filter((item) => item.monthly === 0).length;
  const brandCount = new Set(data.promotions.map((item) => item.brand)).size;
  const marketNote = carrier !== "Verizon"
    ? `${data.promotions.length} direct promotional rows across ${brandCount} manufacturers; ${data.promotions.filter((item) => item.detailScreenshot).length} offer-detail captures.`
    : ui.marketNote;
  const currentEvidence = carrier === "AT&T" ? attEvidence : carrier === "T-Mobile" ? tmobileEvidence : gridOffers;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand-lockup" onClick={resetHome} aria-label="Promotion Radar home">
        <span className="brand-mark"><Radar size={17} strokeWidth={2.4} /></span><span>Promotion Radar</span>
      </button>
      <nav className="primary-nav">
        <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}><Globe2 size={15} /> {ui.market}</button>
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
        <div><p>{tab === "market" ? "NORTH AMERICA · MULTI-CARRIER" : `${carrier.toUpperCase()} · US CONSUMER`}</p><h1>{tab === "market" ? localize(lang,"북미 시장 인텔리전스","Market intelligence") : ui.title}</h1><div className="carrier-switch">{["Verizon","AT&T","T-Mobile"].map((item)=><button key={item} className={tab !== "market" && carrier===item?"active":""} disabled={item==="AT&T"?!attData:item==="T-Mobile"?!tmobileData:false} onClick={()=>changeCarrier(item)}>{item}</button>)}</div></div>
        <div className="page-actions">
          <span><Clock3 size={14} /> {ui.observed} {data.meta.snapshotDate}</span>
          <button onClick={() => setTab("sources")}>{ui.crawlSources} <ChevronRight size={16} /></button>
        </div>
      </section>

      {tab === "market" && <MarketOverview verizonData={verizonData} attData={attData} tmobileData={tmobileData} setCarrier={changeCarrier} lang={lang} />}

      {tab === "overview" && <section className="market-strip">
        <MarketStat icon={Smartphone} label={ui.tracked} value={data.promotions.length} note={`${brandCount} priority brands`} />
        <MarketStat icon={CircleDollarSign} label={ui.largest} value={money(maxCredit)} note={maxCreditOffer?.model || verifiedLabel(lang)} accent />
        <MarketStat icon={Check} label={ui.onUs} value={zeroOffers} note={ui.onUsNote} />
        <MarketStat icon={ShieldCheck} label={ui.evidence} value={`${data.promotions.filter((x) => x.confidence === "High").length}/${data.promotions.length}`} note={`${carrier} domains`} />
        <div className="market-callout"><Activity size={18} /><div><strong>{ui.marketSignal}</strong><p>{marketNote}</p></div></div>
      </section>}

      {tab === "overview" && <CollectionTrendOverview carrier={carrier} history={carrier === "AT&T" ? attHistory : carrier === "T-Mobile" ? tmobileHistory : history} collection={carrier === "Verizon" ? collection : null} onOpenMatrix={() => setTab("matrix")} lang={lang} />}
      {tab === "matrix" && <PromotionView carrier={carrier} data={data} offers={offers} scenarios={carrier === "Verizon" ? scenarios : null} gridOffers={currentEvidence} brand={brand} setBrand={setBrand} mechanic={mechanic} setMechanic={setMechanic} noTrade={noTrade} setNoTrade={setNoTrade} selected={selected} setSelected={setSelected} collection={carrier === "Verizon" ? collection : null} lang={lang} sortMode={sortMode} setSortMode={setSortMode} />}
      {tab === "plans" && (carrier === "Verizon" ? <PlansView plans={data.plans} lang={lang} /> : <CarrierPlansView carrier={carrier} lang={lang} />)}
      {tab === "sources" && <SourcesView targets={data.targets} promotions={data.promotions} collection={carrier === "Verizon" ? collection : null} gridOffers={currentEvidence} carrier={carrier} lang={lang} />}
    </main>
  </div>;
}

function brandPortfolio(data) {
  return ["Samsung","Apple","Google","Motorola"].map((brand) => {
    const offers = data?.promotions?.filter((item) => item.brand === brand) || [];
    return {
      brand,
      offers: offers.length,
      onUs: offers.filter((item) => item.monthly === 0).length,
      tradeIn: offers.filter((item) => item.tradeIn).length,
      maxCredit: Math.max(0, ...offers.map((item) => item.credit || 0)),
    };
  });
}

function carrierSummary(name, data) {
  const offers = data?.promotions || [];
  return {
    carrier: name,
    offers: offers.length,
    onUs: offers.filter((item) => item.monthly === 0).length,
    tradeIn: offers.filter((item) => item.tradeIn).length,
    maxCredit: Math.max(0, ...offers.map((item) => item.credit || 0)),
    evidence: offers.filter((item) => item.confidence === "High").length,
    detailCaptures: offers.filter((item) => item.detailScreenshot).length,
    date: data?.meta?.snapshotDate || "-",
  };
}

function OverviewLineChart({ data, series, moneyAxis = false }) {
  return <div className="chart-area short line-profile"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:12,right:24,left:0,bottom:0}}>
    <CartesianGrid stroke="#edf0f2" vertical={false} strokeDasharray="3 3" />
    <XAxis dataKey="brand" tick={{fontSize:11,fill:"#8b95a1"}} axisLine={false} tickLine={false} padding={{left:18,right:18}} />
    <YAxis allowDecimals={!moneyAxis} tickFormatter={(value)=>moneyAxis ? `$${value}` : value} tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} width={moneyAxis ? 48 : 28} />
    <Tooltip formatter={(value)=>moneyAxis ? money(value) : value} contentStyle={{border:"1px solid #e5e8eb",borderRadius:8,fontSize:12,boxShadow:"0 8px 24px rgba(25,31,40,.08)"}} cursor={{stroke:"#d1d6db",strokeDasharray:"4 4"}} />
    <Legend wrapperStyle={{fontSize:11,paddingTop:8}} />
    {series.map((item)=><Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={2.6} strokeDasharray={item.dash} dot={{r:4,fill:"#fff",strokeWidth:2}} activeDot={{r:6}} connectNulls isAnimationActive={false} />)}
  </LineChart></ResponsiveContainer></div>;
}

const CARRIER_CHART_COLORS = { Verizon: "#e60000", "AT&T": "#009fdb", "T-Mobile": "#e20074" };

function MarketOverview({ verizonData, attData, tmobileData, setCarrier, lang }) {
  if (!verizonData || !attData || !tmobileData) return <div className="overview-loading">Loading carrier snapshots...</div>;
  const carrierDataByName = { Verizon: verizonData, "AT&T": attData, "T-Mobile": tmobileData };
  const carrierNames = Object.keys(carrierDataByName);
  const carriers = carrierNames.map((name) => carrierSummary(name, carrierDataByName[name]));
  const brandsByCarrier = Object.fromEntries(carrierNames.map((name) => [name, brandPortfolio(carrierDataByName[name])]));
  const brandsComparison = brandsByCarrier.Verizon.map((row, index) => {
    const entry = { brand: row.brand };
    carrierNames.forEach((name) => {
      const carrierRow = brandsByCarrier[name][index];
      entry[name] = carrierRow.maxCredit;
      entry[`${name} offers`] = carrierRow.offers;
      entry[`${name} On Us`] = carrierRow.onUs;
    });
    return entry;
  });
  const totalOffers = carriers.reduce((sum, row) => sum + row.offers, 0);
  const totalOnUs = carriers.reduce((sum, row) => sum + row.onUs, 0);
  return <>
    <section className="market-strip market-wide">
      <MarketStat icon={Database} label={localize(lang,"추적 통신사","Tracked carriers")} value={carrierNames.length} note={carrierNames.join(" · ")} />
      <MarketStat icon={Smartphone} label={localize(lang,"통합 프로모션","Combined offers")} value={totalOffers} note="4 priority brands" />
      <MarketStat icon={Check} label="On Us" value={totalOnUs} note={localize(lang,"통신사 합계","Across all carriers")} />
      <MarketStat icon={ShieldCheck} label={localize(lang,"공식 근거","Official evidence")} value={`${carriers.reduce((sum,row)=>sum+row.evidence,0)}/${totalOffers}`} note="Public carrier sources" />
      <div className="market-callout"><Activity size={18}/><div><strong>{localize(lang,"북미 시장 비교","North America market view")}</strong><p>{localize(lang,"동일한 프로모션 분류 기준으로 통신사와 제조사 포지션을 비교합니다.","Compare carrier and manufacturer positions using one promotion taxonomy.")}</p></div></div>
    </section>
    <section className="overview-grid">
      <div className="overview-main">
        <section className="chart-panel"><div className="panel-title"><div><p>OEM PORTFOLIO PROFILE</p><h2>{localize(lang,"제조사별 프로모션 수 비교","Promotion count by manufacturer")}</h2></div></div><OverviewLineChart data={brandsComparison} series={carrierNames.map((name)=>({key:`${name} offers`,name:`${name} offers`,color:CARRIER_CHART_COLORS[name]}))} /></section>
        <section className="chart-panel"><div className="panel-title"><div><p>OEM CREDIT PROFILE</p><h2>{localize(lang,"제조사별 최대 지원금 비교","Maximum observed credit by manufacturer")}</h2></div></div><OverviewLineChart data={brandsComparison} moneyAxis series={carrierNames.map((name)=>({key:name,name,color:CARRIER_CHART_COLORS[name]}))} /></section>
        <section className="movement-panel"><div className="panel-title"><div><p>CROSS-CARRIER READ</p><h2>{localize(lang,"제조사별 경쟁 포지션","Competitive position by manufacturer")}</h2></div></div><div className="carrier-compare-table" style={{"--compare-cols":carrierNames.length * 2}}><div className="carrier-compare-head"><span>OEM</span>{carrierNames.map((name)=><span key={name}>{name} max</span>)}{carrierNames.map((name)=><span key={name}>{name} On Us</span>)}</div>{brandsComparison.map((row)=><article key={row.brand}><strong>{row.brand}</strong>{carrierNames.map((name)=><span key={name}>{money(row[name])}</span>)}{carrierNames.map((name)=><b key={name}>{row[`${name} On Us`]}</b>)}</article>)}</div></section>
      </div>
      <aside className="overview-side">
        {carriers.map((row)=><section className="snapshot-summary carrier-summary" key={row.carrier}><p>{row.carrier.toUpperCase()} SNAPSHOT</p><h2>{row.date}</h2><div className="summary-number"><strong>{row.offers}</strong><span>{localize(lang,"추적 프로모션","tracked offers")}</span></div><dl><div><dt>On Us</dt><dd>{row.onUs}</dd></div><div><dt>Trade-in</dt><dd>{row.tradeIn}</dd></div><div><dt>{localize(lang,"최대 지원금","Max credit")}</dt><dd>{money(row.maxCredit)}</dd></div></dl><button className="carrier-open" onClick={()=>setCarrier(row.carrier)}>{localize(lang,"통신사 개요 열기","Open carrier overview")} <ChevronRight size={14}/></button></section>)}
        <section className="lexicon-panel"><p>COMPARISON RULE</p><h3>{localize(lang,"비교 기준","How this view compares")}</h3><Lexicon term="Max credit" text={localize(lang,"각 제조사에서 확인된 단일 최대 기기 지원금입니다.","Highest single observed device credit for each manufacturer.")}/><Lexicon term="On Us" text={localize(lang,"bill credits 적용 후 월 기기값이 $0인 행입니다.","Rows with a $0 monthly device installment after bill credits.")}/><Lexicon term={verifiedLabel(lang)} text={localize(lang,"정확한 조건이나 금액이 아직 공식 근거로 확인되지 않았다는 뜻이며 비대상을 의미하지 않습니다.","The exact condition or value is not yet verified by captured official evidence; it does not mean ineligible.")}/></section>
      </aside>
    </section>
  </>;
}

const TREND_BRAND_COLORS = { Samsung: "#1428a0", Apple: "#191f28", Google: "#34a853", Motorola: "#8a3ffc" };
const FALLBACK_TREND_COLORS = ["#009fdb", "#e20074", "#ff8a3d", "#20a464"];

function CollectionTrendOverview({ carrier, history, collection, onOpenMatrix, lang }) {
  if (!history || !history.snapshots.length) return <div className="overview-loading">{localize(lang,`${carrier} 수집 이력을 불러오는 중...`,`Loading ${carrier} collection history...`)}</div>;
  const brandNames = [...new Set(history.snapshots.flatMap((s) => Object.keys(s.brands || {})))]
    .sort((a, b) => (Object.keys(TREND_BRAND_COLORS).indexOf(a) - Object.keys(TREND_BRAND_COLORS).indexOf(b)) || a.localeCompare(b));
  const colorFor = (brand, index) => TREND_BRAND_COLORS[brand] || FALLBACK_TREND_COLORS[index % FALLBACK_TREND_COLORS.length];
  const trend = history.snapshots.map((snapshot) => {
    const entry = { date: snapshot.date, trackedOffers: snapshot.trackedOffers };
    brandNames.forEach((brand) => {
      entry[brand] = snapshot.brands?.[brand] ?? null;
      entry[`${brand}Free`] = snapshot.brandMetrics?.[brand]?.free ?? null;
    });
    return entry;
  });
  const latest = history.snapshots[history.snapshots.length - 1];
  const previous = history.snapshots.length > 1 ? history.snapshots[history.snapshots.length - 2] : null;

  return <section className="overview-grid">
    <div className="overview-main">
      <section className="chart-panel brand-trend">
        <div className="panel-title"><div><p>{localize(lang,"제조사 프로모션 트렌드","OEM PROMOTION TREND")}</p><h2>{localize(lang,"제조사별 최대 확인 지원금","Best observed promo credit by manufacturer")} <InfoTip text={localize(lang,"각 수집 시점에서 제조사별로 확인된 최대 기기 지원금이며 포트폴리오 평균 할인율은 아닙니다.","For each collection run, this plots the highest verified device credit found for each manufacturer. It does not represent average portfolio discount.")} /></h2></div><button onClick={onOpenMatrix}>{localize(lang,"매트릭스 열기","Open offer matrix")} <ChevronRight size={15} /></button></div>
        <div className="chart-area short"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{top:8,right:18,left:0,bottom:0}}>
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis dataKey="date" tick={{fontSize:11,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <YAxis tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
          <Tooltip contentStyle={{border:"1px solid #e5e8eb",borderRadius:8,fontSize:12}} />
          <Legend wrapperStyle={{fontSize:11}} />
          {brandNames.map((brand, index) => <Line key={brand} type="monotone" dataKey={brand} stroke={colorFor(brand, index)} strokeWidth={2.5} dot={{r:4}} connectNulls />)}
        </LineChart></ResponsiveContainer></div>
      </section>

      <section className="chart-panel brand-trend">
        <div className="panel-title"><div><p>{localize(lang,"제조사 On Us 트렌드","OEM ON US TREND")}</p><h2>{localize(lang,"제조사별 On Us 프로모션 수","On Us promotion count by manufacturer")} <InfoTip text={localize(lang,"각 수집 시점에서 요금제 크레딧 적용 후 월 기기값이 $0으로 확인된 프로모션 행 수입니다.","Number of promotion rows with a verified $0 monthly device payment after plan credits in each collection run.")} /></h2></div></div>
        <div className="chart-area short"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{top:8,right:18,left:0,bottom:0}}>
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          <XAxis dataKey="date" tick={{fontSize:11,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{fontSize:10,fill:"#8b95a1"}} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{border:"1px solid #e5e8eb",borderRadius:8,fontSize:12}} />
          <Legend wrapperStyle={{fontSize:11}} />
          {brandNames.map((brand, index) => <Line key={brand} type="monotone" dataKey={`${brand}Free`} name={brand} stroke={colorFor(brand, index)} strokeWidth={2.5} dot={{r:4}} connectNulls />)}
        </LineChart></ResponsiveContainer></div>
      </section>

      <section className="movement-panel"><div className="panel-title"><div><p>{localize(lang,"주요 변화","WHAT CHANGED")}</p><h2>{localize(lang,"수집 회차 간 변동 내역","Collection-to-collection movement log")}</h2></div></div>
        {history.movements.length ? <div className="movement-table"><div className="movement-head"><span>Metric</span><span>{previous?.date}</span><span>{latest.date}</span><span>Δ</span><span>Interpretation</span></div>{history.movements.map((row) => <article key={row.metric}><strong>{row.metric}</strong><span>{row.unit === "USD" ? money(row.from) : row.from}</span><span>{row.unit === "USD" ? money(row.to) : row.to}</span><b className={row.to-row.from >= 0 ? "up" : "down"}>{row.unit === "USD" ? money(row.to-row.from) : row.to-row.from}</b><p>{row.interpretation}</p></article>)}</div>
        : <p className="empty">{localize(lang,"첫 수집 회차라 아직 변동 내역이 없습니다. 다음 정기 수집부터 추이가 쌓입니다.","This is the first collection run, so there is no movement yet. Trends will build from the next scheduled run.")}</p>}
      </section>
    </div>

    <aside className="overview-side">
      <section className="snapshot-summary"><p>{localize(lang,"최신 스냅샷","LATEST SNAPSHOT")}</p><h2>{latest.date}</h2><div className="summary-number"><strong>{latest.trackedOffers}</strong><span>{localize(lang,"추적 프로모션","tracked offers")}</span></div><dl>{latest.mechanics && <><div><dt>EIP</dt><dd>{latest.mechanics.EIP}</dd></div><div><dt>Trade-in</dt><dd>{latest.mechanics["Trade-in"]}</dd></div><div><dt>BYOD+</dt><dd>{latest.mechanics["BYOD+"]}</dd></div></>}<div><dt>{localize(lang,"미국 크롤링","US crawl")}</dt><dd>{collection ? `${collection.sourceCount} ${localize(lang,"개 출처 완료","sources complete")}` : latest.source}</dd></div></dl></section>
      <section className="lexicon-panel"><p>{localize(lang,"영업 용어","COMMERCIAL LEXICON")}</p><h3>{localize(lang,"매트릭스 읽는 법","How to read the matrix")}</h3><Lexicon term="On Us" text={localize(lang,"프로모션 bill credits 적용 후 기기 할부금이 $0입니다. 요금제, 세금과 자격조건은 별도입니다.","Net device installment is $0 after promotional bill credits. Service-plan charges, taxes and conditions still apply.")} /><Lexicon term={verifiedLabel(lang)} text={localize(lang,"정확한 요금제별 값이 공식 근거에서 아직 확인되지 않았으며 비대상이라는 의미는 아닙니다.","The exact tier value is not yet verified in official evidence; it does not mean ineligible.")} /><Lexicon term="EIP" text={localize(lang,"Trade-in 없이 적용되는 기기 할부 프로모션입니다.","Equipment Installment Plan promotion without a required trade-in.")} /><Lexicon term="Trade-in" text={localize(lang,"기존 기기 반납이 필요한 프로모션입니다.","Device credit requiring an eligible traded device.")} /><Lexicon term="AC" text={localize(lang,"조건을 충족하는 기기를 상태와 관계없이 인정하는 Any Condition입니다.","Any Condition trade-in accepted, subject to eligible model rules.")} /><Lexicon term="TIV" text={localize(lang,"반납 기기의 Trade-in Value 또는 인정 금액 구간입니다.","Trade-in Value or value band attached to the traded model.")} /><Lexicon term="free/free/free" text={localize(lang,"High / Mid / Low 모두 기기값 $0이지만 요금제 혜택과 조건은 다를 수 있습니다.","High / Mid / Low tiers all show $0 device payment; plan value and qualifying conditions can differ.")} /></section>
      <section className="cadence-panel"><Clock3 size={17} /><div><strong>{history.cadence} collection cadence</strong><p>{localize(lang,"다음 정기 수집도 동일한 통신사 자동 수집기로 실행됩니다.","The next scheduled run uses the same automated carrier collector.")}</p></div></section>
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

function PromotionView({ carrier="Verizon", data, offers, scenarios, gridOffers, brand, setBrand, mechanic, setMechanic, noTrade, setNoTrade, selected, setSelected, collection, lang, sortMode, setSortMode }) {
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
      <div className="workspace-meta"><span className="screenshot-hint"><ShieldCheck size={13} /> {localize(lang,`Offer를 누르면 수집 당시 ${carrier} 화면을 확인할 수 있습니다.`,`Select Offer to view the captured ${carrier} screen.`)}</span><span>{ui.sorted}: {sortLabels[sortMode]} · {offers.length} / {data.promotions.length}</span></div>
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
          <thead><tr><th>{ui.brandDevice}</th><th><HeaderLabel help={localize(lang,"프로모션 유형: EIP, Trade-in, BYOD+입니다.","Promotion type: EIP, Trade-in or BYOD+.")}>{ui.mechanic}</HeaderLabel></th><th><HeaderLabel help={localize(lang,"High / Mid / Low 순서의 월 기기값입니다. 미확인은 비대상이 아니라 정확한 값이 아직 검증되지 않은 상태입니다.","Net monthly device payment in High / Mid / Low order. Not verified means the exact value is unconfirmed, not ineligible.")}>{ui.monthlyTier}</HeaderLabel></th><th><HeaderLabel help={localize(lang,"High / Mid / Low 순서의 내부 축약 표현입니다.","Analyst shorthand in High / Mid / Low order.")}>{ui.internalRead}</HeaderLabel></th><th><HeaderLabel help={localize(lang,"AC는 Any Condition, TIV는 Trade-in Value입니다.","AC means Any Condition. TIV means Trade-in Value.")}>{ui.acTiv}</HeaderLabel></th><th>{ui.action}</th><th><HeaderLabel help={`${carrier} official public-source evidence.`}>{ui.evidenceCol}</HeaderLabel></th></tr></thead>
          <tbody>{offers.map((offer) => { const capturedSource = findCapturedSource(collection, evidenceUrl(offer)); const matchedScenario = findMatchedScenario(scenarios, offer); const gridMatch = findGridOffer(gridOffers, offer); const evidenceState = matchedScenario ? "Matched" : gridMatch ? "Offer" : "Pending"; return <tr key={offer.id} className={selected?.id === offer.id ? "selected" : ""} onClick={() => setSelected(offer)}>
            <td><div className={`device-avatar ${slug(offer.brand)}`}>{offer.brand.charAt(0)}</div><div><BrandTag brand={offer.brand} /><strong>{offer.model}</strong></div></td>
            <td><span className={`mechanic-badge ${slug(offer.mechanic || "EIP")}`}>{offer.mechanic || "EIP"}</span><small>{localize(lang,`${offer.term}개월 bill credits`,`${offer.term}-month bill credits`)}</small></td>
            <td><TierLadder ladder={offer.tierLadder} lang={lang} /></td>
            <td><strong className="internal-read">{normalizedShorthand(offer, lang) || "Not classified"}</strong><small>{offer.plan}</small><span className="on-us-summary">{onUsSummary(offer, lang, carrier)}</span></td>
            <td>{offer.anyCondition ? <b className="ac-badge">AC</b> : <span className="muted">-</span>}<small>{offer.tiv || localize(lang,"TIV 미확인","TIV not verified")}</small></td>
            <td>{offer.lineAction}</td>
            <td><button className={`source-state ${matchedScenario || gridMatch ? "matched" : "pending"}`} disabled={!matchedScenario && !gridMatch} onClick={(event) => { event.stopPropagation(); setSelected(offer); setScreenshotOffer({offer, capture: capturedSource, scenario: matchedScenario, grid: gridMatch}); }} title={matchedScenario ? localize(lang,"동일 조건 시나리오 재생","Replay matched purchase scenario") : gridMatch ? `${carrier} official offer evidence` : localize(lang,"동일 조건 검증 대기 중","Exact scenario match pending")}><span /> {evidenceState} <FileText size={12} /></button></td>
          </tr>})}</tbody>
        </table></div>
        {!offers.length && <div className="empty">No offers match the current filters.</div>}
      </div>}
      {!screenshotOffer && <SplitHandle value={matrixWidth} onChange={setMatrixWidth} lang={lang} />}
      <EvidencePanel offer={selected} collection={collection} carrier={carrier} lang={lang} />
    </section>
    <footer><Info size={14} /> Promotional eligibility and availability may vary by ZIP code, customer status, inventory and checkout path. Original display text is retained separately from analyst interpretation.</footer>
  </>;
}

function normalizeModel(value = "") { return value.toLowerCase().replace(/apple|samsung|google|motorola/g, "").replace(/[^a-z0-9]/g, ""); }
function findGridOffer(grid, offer) {
  const target = normalizeModel(offer.model);
  return grid?.offers?.find((item) => item.brand === offer.brand && normalizeModel(item.model) === target) || null;
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
  if (item.grid && !item.scenario) return <GridEvidencePane item={item} onClose={onClose} lang={lang} />;
  const steps = item.scenario?.steps?.filter((step) => step.screenshot) || [];
  const [activeStep, setActiveStep] = useState(Math.max(0, steps.length - 1));
  const image = steps[activeStep]?.screenshot || item.capture?.screenshot;
  return <section className="captured-evidence-pane"><header><div><p>MATCHED SCENARIO REPLAY</p><h2>{item.offer.model}</h2><span>{item.scenario.scenarioId} · {item.scenario.status}</span></div><button className="back-matrix" onClick={onClose}><ArrowLeft size={14} />{localize(lang,"매트릭스로 돌아가기","Back to matrix")}</button></header>{steps.length > 0 && <nav className="scenario-steps">{steps.map((step, index) => <button key={`${step.name}-${index}`} className={activeStep === index ? "active" : ""} onClick={() => setActiveStep(index)}><span>{index + 1}</span>{step.name}<b>{step.verified ? "Verified" : "Failed"}</b></button>)}</nav>}<div className="longshot-scroll">{image ? <img src={image} alt={`${item.offer.model} Verizon scenario capture`} /> : <p>No captured screen</p>}</div><footer>{localize(lang,"왼쪽 단계별 상태와 오른쪽 동일 scenarioId 결과를 비교합니다.","Compare each captured state with the same scenarioId result on the right.")}</footer></section>;
}

function GridEvidencePane({ item, onClose, lang }) {
  const grid = item.grid;
  const isDirectCollector = grid.carrier !== "Verizon";
  const captures = [
    grid.detail_initial_screenshot && {key:"offer", label:localize(lang,"Offer 약관","Offer terms"), image:grid.detail_initial_screenshot},
    grid.detail_screenshot && {key:"additional", label:localize(lang,"추가 약관","Additional terms"), image:grid.detail_screenshot},
  ].filter(Boolean);
  const [captureKey, setCaptureKey] = useState(captures.at(-1)?.key || "grid");
  const image = captures.find((capture) => capture.key === captureKey)?.image || grid.detail_screenshot || grid.grid_screenshot || "./grid-evidence/all-brands-grid.jpg";
  const label = isDirectCollector ? (grid.detail_screenshot ? `${grid.carrier} OFFER DETAIL SNAPSHOT` : `${grid.carrier} BRAND GRID SNAPSHOT`) : (grid.detail_screenshot ? "OFFICIAL DETAILS SNAPSHOT" : "OFFICIAL GRID API · OFFER METADATA");
  const evidenceNote = grid.detail_screenshot
    ? localize(lang,"상세 약관 원문은 오른쪽 Summary에서 구조화해 표시합니다.","Captured terms are structured in the Summary panel on the right.")
    : (isDirectCollector ? localize(lang,"상세 모달 미확보: 공식 브랜드 Grid 근거입니다.","Offer modal not captured: showing official brand Grid evidence.") : localize(lang,"공식 Grid의 가격 및 Details 식별 근거입니다.","Official Grid price and Details identifier evidence."));
  return <section className="captured-evidence-pane"><header><div><p>{label}</p><h2>{item.offer.model}</h2><span>{grid.detail_params?.promoId} · {grid.term_months} months</span></div><button className="back-matrix" onClick={onClose}><ArrowLeft size={14} />{localize(lang,"매트릭스로 돌아가기","Back to matrix")}</button></header>{captures.length > 1 && <nav className="evidence-capture-tabs">{captures.map((capture)=><button key={capture.key} className={captureKey === capture.key ? "active" : ""} onClick={()=>setCaptureKey(capture.key)}>{capture.label}</button>)}</nav>}<div className="longshot-scroll"><img src={image} alt={`${item.offer.model} ${grid.carrier} evidence capture`} /></div>{grid.detail_text && <section className="evidence-source-preview"><div><FileText size={12}/><strong>{localize(lang,"수집 약관 원문","Captured legal text")}</strong></div><p>{grid.detail_text}</p></section>}<footer><ShieldCheck size={13}/><span>{evidenceNote}</span></footer></section>;
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

function TierLadder({ ladder = {}, lang }) { return <div className="tier-ladder"><TierCell label="H" value={ladder.high} lang={lang} /><TierCell label="M" value={ladder.mid} lang={lang} /><TierCell label="L" value={ladder.low} lang={lang} /></div>; }
function TierCell({ label, value, lang }) { const text = isOnUs(value) ? "ON US" : value == null ? verifiedLabel(lang) : `$${value}`; const help = value == null ? localize(lang,`${label} 요금제의 정확한 월 기기값이 아직 검증되지 않았습니다. 비대상이라는 뜻은 아닙니다.`,`${label} tier monthly device payment is not yet verified; this does not mean ineligible.`) : isOnUs(value) ? `${label} tier net device payment is $0 after promotional bill credits. Service-plan charges, taxes and eligibility conditions still apply.` : `${label} tier net device payment is $${value} per month after promotional credits.`; return <span title={help} className={isOnUs(value) ? "free" : value == null ? "unknown" : "paid"}><b>{label}</b>{text}</span>; }

function TierConditionMatrix({ offer, carrier, lang }) {
  return <section className="tier-condition-panel"><div className="tier-condition-title"><strong>{localize(lang,"같은 기기값이어도 요금제 가치가 다른 이유","Why the same device price can have different value")}</strong><InfoTip text={localize(lang,"기기값 외에도 네트워크, hotspot, international 혜택과 프로모션 자격이 다를 수 있습니다.","Each plan tier can differ in network access, hotspot, international service and promotion eligibility.")} /></div><div className="tier-condition-grid">{planTiersFor(carrier).map((tier) => {
    const value = offer.tierLadder?.[tier.key];
    const outcome = value == null ? verifiedLabel(lang) : isOnUs(value) ? "On Us" : `$${value}/mo`;
    const promoCondition = value == null ? localize(lang,"자격조건 미확인","Eligibility not verified") : offer.tradeIn ? offer.anyCondition ? "TI required · AC" : "TI required" : localize(lang,"TI 불필요 확인","No TI required");
    return <article key={tier.key} className={value == null ? "uncaptured" : isOnUs(value) ? "on-us" : "paid"}><span>{tier.short} · {tier.name}</span><strong>{outcome}</strong><b>{promoCondition}</b><p>{tier.network}</p><small>{tier.benefits}</small></article>;
  })}</div><p className="on-us-definition"><strong>On Us</strong> {localize(lang,"는 프로모션 bill credits 적용 후 기기 할부금이 $0이라는 뜻입니다. 무선 요금제, 세금과 자격조건은 별도입니다.","means the net device installment is $0 after promotional bill credits. The wireless service plan, taxes and eligibility obligations are still payable.")}</p></section>;
}

function ConditionEvidence({ offer, lang }) {
  const evidence = offer.conditionEvidence || {};
  return <section className="condition-panel"><div className="tier-condition-title"><strong>{localize(lang,"Trade-in 기기 상태 확인","Trade-in condition check")}</strong><InfoTip text={localize(lang,"Damaged 조건 결과와 통신사의 Any condition 원문이 일치할 때 AC로 확인합니다. 배터리 팽창, 잠금, 분실/도난은 별도 예외입니다.","AC is confirmed only when damaged-condition treatment and explicit carrier Any Condition language align.")} /></div><div className="condition-grid"><article><span>GOOD</span><strong>{evidence.good || localize(lang,"시나리오 미확인","Scenario not verified")}</strong></article><article className={offer.anyCondition ? "confirmed" : "pending"}><span>DAMAGED</span><strong>{evidence.damaged || localize(lang,"시나리오 미확인","Scenario not verified")}</strong></article></div><dl><div><dt>AC text</dt><dd>{offer.anyCondition ? localize(lang,"원문에서 명시적으로 확인","Explicit in source text") : verifiedLabel(lang)}</dd></div><div><dt>Battery swelling</dt><dd>{evidence.batterySwelling || verifiedLabel(lang)}</dd></div><div><dt>Activation lock</dt><dd>{evidence.activationLock || verifiedLabel(lang)}</dd></div><div><dt>Lost / stolen</dt><dd>{evidence.lostOrStolen || verifiedLabel(lang)}</dd></div></dl></section>;
}

function sentenceContaining(text, pattern) {
  return text.split(/(?<=[.!?])\s+/).find((sentence) => pattern.test(sentence))?.trim() || null;
}

function summarizeOfferTerms(offer) {
  const text = offer.detailText || "";
  if (!text) return null;
  const discounts = [...new Set([...text.matchAll(/Up to \$([0-9,]+(?:\.\d{2})?) off/gi)].map((match) => `$${match[1]}`))];
  const tivValues = [...new Set([...text.matchAll(/(?:min(?:imum)?\.?\s*)?(?:trade-in value|Trade-In value|TiV)[^$]{0,45}\$([0-9,]+)/gi)].map((match) => `$${match[1]}`))];
  const selectedTiv = offer.credit >= 1249 && tivValues.includes("$200") ? "$200" : offer.credit >= 1049 && offer.credit < 1100 && tivValues.includes("$35") ? "$35" : tivValues.join(" / ");
  const plan = /Extra 2\.0 or higher/i.test(text) ? "Eligible unlimited · Extra 2.0+ for maximum new-customer credit" : /eligible postpaid unlimited/i.test(text) ? "Eligible postpaid unlimited plan" : null;
  const customerParts = [];
  if (/new and existing customers/i.test(text)) customerParts.push("New & existing");
  else if (/new customers/i.test(text)) customerParts.push("New customer");
  if (/new line or an upgrade|activating new line or upgrading/i.test(text)) customerParts.push("New line or upgrade");
  else if (/new line/i.test(text)) customerParts.push("New line");
  const customer = customerParts.join(" · ") || null;
  const conditionExcluded = offer.credit >= 1249 && /Any year,? any condition does not apply to (?:this|\$1,250) credit/i.test(text);
  const condition = /any year,? (?:in )?any condition/i.test(text) && !conditionExcluded ? "Any year, any condition" : null;
  const exclusions = sentenceContaining(text, /not eligible/i);
  const creditTiming = /Credits start within 3 bills|starting within 3 bills/i.test(text) ? "Starts within 3 bills" : null;
  const deadline = /trade-in must be completed within 30 days/i.test(text) ? "Complete trade-in within 30 days" : null;
  const termination = /service is canceled.*credits will stop/i.test(text) ? "Canceling service stops future credits and the remaining device balance becomes due." : /pays? up\/off.*credits may stop|payoff.*credits may stop/i.test(text) ? "Early payoff or upgrade may stop future credits." : null;
  return {
    discounts,
    tiv: selectedTiv || null,
    plan,
    customer,
    condition,
    exclusions,
    creditTiming,
    deadline,
    termination,
    term: /36[- ]month/i.test(text) ? "36 months" : null,
  };
}

function OfferTermsSummary({ offer, lang }) {
  const summary = summarizeOfferTerms(offer);
  if (!summary) return null;
  const compact = (value, fallback = verifiedLabel(lang)) => value || fallback;
  const alternateCredits = summary.discounts.filter((value) => Math.abs(Number(value.replace(/[$,]/g,"")) - (offer.credit || 0)) > 1);
  return <section className="terms-summary"><div className="terms-summary-title"><div><p>CAPTURED TERMS SUMMARY</p><h3>{localize(lang,"공식 약관 핵심 조건","Key conditions from official terms")}</h3></div><ShieldCheck size={17}/></div>
    <div className="terms-summary-grid">
      <article><span>{localize(lang,"지원금","Credits")}</span><strong>{offer.headline}{alternateCredits.length ? ` · Other captured tier: ${alternateCredits.join(" / ")}` : ""}</strong></article>
      <article><span>{localize(lang,"기간 / 지급","Term / posting")}</span><strong>{compact(summary.term)} · {compact(summary.creditTiming, localize(lang,"지급 시점 미확인","Posting not verified"))}</strong></article>
      <article><span>{localize(lang,"가입자 / 회선","Customer / line")}</span><strong>{compact(summary.customer)}</strong></article>
      <article><span>{localize(lang,"요금제 조건","Plan gate")}</span><strong>{compact(summary.plan)}</strong></article>
      <article><span>TIV / Condition</span><strong>{compact(summary.tiv)}{summary.condition ? ` · ${summary.condition}` : ""}</strong></article>
      <article><span>{localize(lang,"Trade-in 기한","Trade-in deadline")}</span><strong>{compact(summary.deadline)}</strong></article>
    </div>
    {(summary.exclusions || summary.termination) && <div className="terms-caution"><Info size={14}/><div><strong>{localize(lang,"유의 조건","Watch-outs")}</strong><p>{[summary.exclusions,summary.termination].filter(Boolean).join(" ")}</p></div></div>}
    <details><summary>{localize(lang,"수집된 전체 약관 원문 보기","View full captured terms")}</summary><p>{offer.detailText}</p></details>
  </section>;
}

function EvidencePanel({ offer, collection, carrier="Verizon", lang }) {
  if (!offer) return <aside className="evidence-pane empty-evidence">Select an offer to inspect evidence.</aside>;
  const officialUrl = evidenceUrl(offer);
  const sourcePath = new URL(officialUrl).pathname;
  const capture = collection?.sources?.find((item) => new URL(item.url).pathname === sourcePath);
  const domain = carrier === "AT&T" ? "att.com" : carrier === "T-Mobile" ? "t-mobile.com" : "verizon.com";
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(`site:${domain} "${offer.model}" "${offer.verizonDisplay.split("·")[0].trim()}"`)}`;
  const capturedTerms = summarizeOfferTerms(offer);
  const confirmedAnyCondition = offer.anyCondition || Boolean(capturedTerms?.condition);
  const confirmedTiv = offer.tiv || capturedTerms?.tiv;
  return <aside className="evidence-pane">
    <div className="evidence-header"><div><p>{localeCopy[lang].selectedOffer}</p><h2>{offer.model}</h2></div><a href={officialUrl} target="_blank" rel="noreferrer" aria-label={`Open exact ${carrier} source`}><ExternalLink size={17} /></a></div>
    <div className="headline-block"><div className="headline-labels"><BrandTag brand={offer.brand} />{Object.values(offer.tierLadder || {}).some(isOnUs) && <span className="on-us-badge">ON US</span>}</div><strong>{offer.headline}</strong><p>{offer.verizonDisplay}</p></div>
    <OfferTermsSummary offer={offer} lang={lang} />
    <div className="detail-ladder"><div><span>Mechanic</span><strong>{offer.mechanic || "EIP"}</strong></div><TierLadder ladder={offer.tierLadder} lang={lang} /><code>{normalizedShorthand(offer, lang)}</code></div>
    <TierConditionMatrix offer={offer} carrier={carrier} lang={lang} />
    <dl className="evidence-facts">
      <div><dt>{localeCopy[lang].retail}</dt><dd>{money(offer.retail, 2)}</dd></div>
      <div><dt>{localeCopy[lang].monthly}</dt><dd>{money(offer.monthly, 2)}/mo</dd></div>
      <div><dt>{localeCopy[lang].saving}</dt><dd className="red">{money(offer.credit, 2)}</dd></div>
      <div><dt>{localeCopy[lang].planGate}</dt><dd>{offer.plan}</dd></div>
      <div><dt>{localeCopy[lang].lineAction}</dt><dd>{offer.lineAction}</dd></div>
      <div><dt>{localeCopy[lang].tradeIn}</dt><dd>{offer.tradeIn ? localize(lang,"필수","Required") : localize(lang,"불필요","Not required")}</dd></div>
      <div><dt>{localeCopy[lang].anyCondition}</dt><dd>{confirmedAnyCondition ? "Yes · AC" : localize(lang,"미확인","Not confirmed")}</dd></div>
      <div><dt>TIV</dt><dd>{confirmedTiv || verifiedLabel(lang)}</dd></div>
    </dl>
    {offer.tradeIn && <section className="generation-panel"><strong>Eligible trade-in generations</strong><div>{offer.eligibleGenerations?.map((generation) => <span key={generation}>{generation}</span>) || <span>{verifiedLabel(lang)}</span>}</div><p>* Generation buckets describe the analyst normalization. Exact eligible models still require {carrier} trade-in detail evidence.</p></section>}
    {offer.tradeIn && <ConditionEvidence offer={{...offer,anyCondition:confirmedAnyCondition}} lang={lang} />}
    <section className="raw-evidence"><div><FileText size={15} /><strong>{carrier} source text</strong></div><blockquote>{offer.rawText || offer.note}</blockquote></section>
    <section className="source-card"><div className="source-domain"><Globe2 size={15} /><div><strong>{offer.sourceLabel}</strong><span>www.{domain}</span></div></div><code>{offer.source}</code>{capture ? <div className="capture-proof"><span>US runner · HTTP {capture.status_code}</span><span>{capture.fetched_at}</span><code>SHA-256 {capture.content_hash}</code></div> : <div className="capture-proof pending"><span>Direct public source</span></div>}<div className="verification-actions"><a href={offer.source} target="_blank" rel="noreferrer">Live {carrier} page <ArrowUpRight size={14} /></a><a href={searchUrl} target="_blank" rel="noreferrer">Search verification <Search size={13} /></a>{carrier === "Verizon" && <a href="./downloads/vzw-evidence-pack-latest.zip" download>Evidence pack <Download size={13} /></a>}</div></section>
    <section className="analyst-note"><strong>Analyst interpretation</strong><p>{offer.note}</p></section>
    <ScreenGlossary terms={[
      {term:verifiedLabel(lang), text:localize(lang,"정확한 요금제별 값이 공식 근거에서 아직 검증되지 않았습니다. 비대상을 의미하지 않습니다.","The exact tier value is not yet verified in official evidence. It does not mean ineligible.")},
      {term:"On Us", text:"Net device installment is $0 after promotional bill credits; service-plan charges and eligibility obligations remain."},
      {term:"Free/Free/Free", text:"High, Mid and Low tiers all show $0 device payment, but plan benefits and qualifying conditions can differ."},
      {term:"Internal read", text:"Compact analyst shorthand in High / Mid / Low order."},
      {term:"AC", text:`Any Condition trade-in language is explicit in ${carrier} evidence.`},
      {term:"TIV", text:"Trade-in Value or qualifying value floor for the traded device."}
    ]} />
  </aside>;
}

const CARRIER_PLANS_META = {
  "AT&T": { tierSummary: "Elite / Premium 2.0 · Extra 2.0 · Value 2.0", plansUrl: "https://www.att.com/plans/unlimited-data-plans/" },
  "T-Mobile": { tierSummary: "Experience Beyond · Experience More · Essentials / Go5G", plansUrl: "https://www.t-mobile.com/cell-phone-plans" },
};

function CarrierPlansView({ carrier, lang }) {
  const meta = CARRIER_PLANS_META[carrier] || CARRIER_PLANS_META["AT&T"];
  const tiers = planTiersFor(carrier);
  return <div className="screen-layout"><section className="plans-view"><div className="section-heading"><div><p>{carrier.toUpperCase()} PLAN NORMALIZATION</p><h2>{localize(lang,"현재 요금제별 프로모션 매핑","Current promotion plan tiers")}</h2></div><span>{meta.tierSummary}</span></div><section className="tier-value-section"><div><p>H / M / L NORMALIZATION</p><h3>{localize(lang,"현재 판매 요금제를 3개 분석 Tier로 정규화","Current plans normalized into three analyst tiers")}</h3><span>{localize(lang,"정확한 월 기기값은 개별 offer 약관에서 해당 요금제와 credit이 명시된 경우에만 표시합니다.","An exact monthly device payment appears only when the individual offer terms explicitly state the plan and credit.")}</span></div><div className="tier-value-grid">{tiers.map((tier)=><article key={tier.key}><b>{tier.short}</b><div><strong>{tier.name}</strong><span>{tier.network}</span><p>{tier.benefits}</p></div></article>)}</div></section><div className="method-note"><ShieldCheck size={18} /><div><strong>Evidence boundary</strong><p>{localize(lang,"Eligible unlimited 문구만으로는 하나의 요금제만 해당한다고 판단하지 않습니다. Starter가 발견되면 현재 주력 Tier가 아닌 기존 가입자 조건으로 별도 기록합니다.","Eligible unlimited does not imply that only one plan qualifies. A Starter reference is recorded separately as a legacy existing-account condition, not a current primary tier.")}</p></div></div><a className="evidence-pack" href={meta.plansUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Official {carrier} unlimited plans</a></section><aside><ScreenGlossary title={`${carrier} plan terms`} terms={[{term:verifiedLabel(lang),text:localize(lang,"정확한 요금제별 기기값이 아직 공식 약관으로 검증되지 않았습니다. 비대상을 뜻하지 않습니다.","The exact tier-specific device payment is not yet verified in official terms; it does not mean ineligible.")},{term:"Not eligible",text:localize(lang,"공식 약관에서 해당 요금제나 조건이 명시적으로 제외된 경우에만 사용합니다.","Used only when official terms explicitly exclude that plan or condition.")},{term:"Eligible unlimited",text:`The promotion requires an eligible ${carrier} unlimited plan; qualifying tiers can vary by offer.`},{term:"On Us",text:"Net device installment is $0 after promotional bill credits; service charges remain payable."}]} /></aside></div>;
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
    <section className="tier-value-section"><div><p>{localize(lang,"왜 상위 요금제를 선택하는가?","WHY UPGRADE THE PLAN?")}</p><h3>{localize(lang,"모든 요금제에서 On Us여도 서비스는 다릅니다","If the phone is On Us on every tier, the service is still different")}</h3><span>{localize(lang,"Free/Free/Free는 기기값을 의미하며 네트워크와 서비스 가치가 동일하다는 뜻이 아닙니다.","Free/Free/Free describes device payment, not identical network or service value.")}</span></div><div className="tier-value-grid">{verizonPlanTiers.map((tier) => <article key={tier.key}><b>{tier.short}</b><div><strong>{tier.name}</strong><span>{tier.network}</span><p>{tier.benefits}</p></div></article>)}</div></section>
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

function SourcesView({ targets, promotions, collection, gridOffers, carrier="Verizon", lang }) {
  const counts = promotions.reduce((acc, offer) => ({ ...acc, [offer.source]: (acc[offer.source] || 0) + 1 }), {});
  const statuses = Object.fromEntries((collection?.sources || []).map((source) => [source.url, source]));
  return <div className="screen-layout"><section className="sources-view"><div className="section-heading"><div><p>CRAWL EVIDENCE MAP</p><h2>{localize(lang,"정확한 수집 URL","Exact monitored URLs")}</h2></div><span>{localize(lang,"각 레코드에 사용된 정확한 페이지를 확인하세요","Open the exact page used for each record")}</span></div>
    {carrier === "Verizon" ? <GridCoverage grid={gridOffers} lang={lang} /> : <DirectCollectionCoverage carrier={carrier} promotions={promotions} lang={lang} />}
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

function DirectCollectionCoverage({ carrier, promotions, lang }) {
  const details = promotions.filter((item) => item.detailScreenshot).length;
  return <section className="grid-coverage"><header><div><p>{carrier.toUpperCase()} DIRECT COLLECTION</p><h3>{localize(lang,"Grid 카드와 상세 모달 수집 범위","Grid card and offer-modal coverage")}</h3></div><span>{promotions[0]?.observed}</span></header><div className="coverage-cards"><article><strong>Direct cards</strong><div><span>Confirmed</span><b>{promotions.length}</b></div></article><article><strong>Detail snapshots</strong><div><span>Captured</span><b>{details}</b></div></article></div></section>;
}

function GridCoverage({ grid, lang }) {
  if (!grid) return <section className="grid-coverage pending"><div><p>ALL-BRAND GRID</p><h3>{localize(lang,"다음 수집 대기 중","Awaiting next collection")}</h3></div></section>;
  return <section className="grid-coverage"><header><div><p>ALL-BRAND GRID · DETAILS PIPELINE</p><h3>{localize(lang,"제조사별 공식 Grid 수집 범위","Official Grid coverage by manufacturer")}</h3></div><span>{grid.generatedAt}</span></header><div className="coverage-cards">{Object.entries(grid.coverage || {}).map(([brand, stats]) => <article key={brand}><strong>{brand}</strong><div><span>{localize(lang,"오퍼 확인","Offer metadata")}</span><b>{stats.offerMetadataConfirmed || 0}</b></div><div><span>{localize(lang,"조건 본문","Details body")}</span><b>{stats.detailsConfirmed}</b></div><small>{stats.offerMetadataConfirmed > 0 ? localize(lang,"공식 Grid API 확보","Official Grid API captured") : localize(lang,"오퍼 수집 대기","Offer pending")}</small></article>)}</div><footer><ShieldCheck size={15} /><span>{localize(lang,"Offer는 가격·Retail·Saving·요금제·회선 조건과 Details ID를 공식 Grid API에서 확인한 상태입니다. Matched는 동일 구매 시나리오까지 재현한 상태입니다.","Offer confirms price, retail, saving, plan/line conditions and Details IDs from the official Grid API. Matched additionally reproduces the same purchase scenario.")}</span></footer></section>;
}

function Scenario({ label, values, status }) { return <article><strong>{label}</strong><span>{values}</span><b className={status.toLowerCase()}>{status}</b></article>; }

function MarketStat({ icon: Icon, label, value, note, accent }) { return <article className={`market-stat ${accent ? "accent" : ""}`}><Icon size={17} /><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }
function BrandTag({ brand }) { return <span className={`brand-tag ${slug(brand)}`}>{brand}</span>; }
function slug(value) { return value.toLowerCase().replace(/[^a-z]/g, ""); }

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
