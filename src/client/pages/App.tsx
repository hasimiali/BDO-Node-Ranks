import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { MarketStatus, NodeRanking } from "../../shared/models";
import { fetchMarketStatus, fetchNodeRanking, fetchRankings } from "../api";
import { confidenceClass, formatNumber, formatSilver } from "../format";
import { DataPage } from "./DataPage";

type Page = "dashboard" | "nodes" | "data" | "detail";
type SortKey = "score" | "silver/day" | "cp" | "demand" | "liquidity" | "yield";
const marketRegions = ["NA", "EU", "ASIA", "MENA", "JP", "KR", "TW", "SA", "RU"];

export function App() {
  const [rankings, setRankings] = useState<NodeRanking[]>([]);
  const [status, setStatus] = useState<MarketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<NodeRanking | null>(null);
  const [marketRegion, setMarketRegion] = useState(() => localStorage.getItem("bdo-market-region") ?? "ASIA");

  useEffect(() => {
    setLoading(true);
    setError(null);
    localStorage.setItem("bdo-market-region", marketRegion);
    Promise.all([fetchRankings(marketRegion), fetchMarketStatus(marketRegion)])
      .then(([rankingData, statusData]) => {
        setRankings(rankingData);
        setStatus(statusData);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [marketRegion]);

  useEffect(() => {
    if (page !== "detail" || selectedId == null) return;
    fetchNodeRanking(selectedId, marketRegion).then(setDetail).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load node"));
  }, [page, selectedId, marketRegion]);

  function openDetail(id: number) {
    setSelectedId(id);
    setPage("detail");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1f2937_0,#090b10_38%,#05070a_100%)] text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Header page={page} setPage={setPage} status={status} marketRegion={marketRegion} setMarketRegion={setMarketRegion} />
        {loading && <Panel>Loading rankings...</Panel>}
        {error && <Panel><span className="text-red-300">{error}</span></Panel>}
        {!loading && !error && page === "dashboard" && <Dashboard rankings={rankings} openDetail={openDetail} />}
        {!loading && !error && page === "nodes" && <NodesPage rankings={rankings} openDetail={openDetail} />}
        {!loading && !error && page === "data" && <DataPage />}
        {!loading && !error && page === "detail" && <DetailPage detail={detail} />}
      </div>
    </main>
  );
}

function Header({ page, setPage, status, marketRegion, setMarketRegion }: { page: Page; setPage: (page: Page) => void; status: MarketStatus | null; marketRegion: string; setMarketRegion: (region: string) => void }) {
  return (
    <header className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-brass">BDO Node Optimizer</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Best CP Worker Nodes</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">All node rankings use a standardized Artisan Goblin benchmark. Workerman static data is estimated; missing workload or Asia market data is marked incomplete.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-400">Market server<select className="ml-2 rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-sm font-semibold text-white" value={marketRegion} onChange={(event) => setMarketRegion(event.target.value)}>{marketRegions.map((region) => <option key={region}>{region}</option>)}</select></label>
          <button className={navClass(page === "dashboard")} onClick={() => setPage("dashboard")}>Dashboard</button>
          <button className={navClass(page === "nodes")} onClick={() => setPage("nodes")}>Nodes</button>
          <button className={navClass(page === "data")} onClick={() => setPage("data")}>Data</button>
        </div>
      </div>
      {status && <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Market provider: {status.provider} ({status.region}). Unofficial. API failures display unavailable or stale data.</div>}
    </header>
  );
}

function navClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-brass text-black" : "bg-white/10 text-slate-200 hover:bg-white/20"}`;
}

function Dashboard({ rankings, openDetail }: { rankings: NodeRanking[]; openDetail: (id: number) => void }) {
  const complete = rankings.filter((ranking) => ranking.score != null);
  const best = complete[0];
  const bestSilver = [...complete].sort((a, b) => (b.realizableSilverPerDay ?? 0) - (a.realizableSilverPerDay ?? 0))[0];
  const bestCp = [...complete].sort((a, b) => (b.silverPerCp ?? 0) - (a.silverPerCp ?? 0))[0];
  const bestDemand = [...rankings].sort((a, b) => b.demandScore - a.demandScore)[0];
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Summary title="Best Node" value={best?.node.name ?? "Incomplete"} sub={best ? `Score ${formatNumber(best.score, 1)}` : "Need market/workload"} />
        <Summary title="Best Silver/Day" value={bestSilver?.node.name ?? "-"} sub={formatSilver(bestSilver?.realizableSilverPerDay)} />
        <Summary title="Best Silver/CP" value={bestCp?.node.name ?? "-"} sub={formatSilver(bestCp?.silverPerCp)} />
        <Summary title="Highest Demand" value={bestDemand?.node.name ?? "-"} sub={`${formatNumber(bestDemand?.demandScore, 0)} ${bestDemand?.demandLabel ?? ""}`} />
      </div>
      <Panel>
        <h2 className="mb-4 text-xl font-bold">Top 10 Nodes</h2>
        <RankingTable rankings={rankings.slice(0, 10)} openDetail={openDetail} />
      </Panel>
    </div>
  );
}

function NodesPage({ rankings, openDetail }: { rankings: NodeRanking[]; openDetail: (id: number) => void }) {
  const [region, setRegion] = useState("All");
  const [type, setType] = useState("All");
  const [maxCp, setMaxCp] = useState(6);
  const [minDemand, setMinDemand] = useState("Low");
  const [sort, setSort] = useState<SortKey>("score");
  const regions = ["All", ...Array.from(new Set(rankings.map((ranking) => ranking.node.region))).sort()];
  const types = ["All", ...Array.from(new Set(rankings.map((ranking) => ranking.node.type))).sort()];
  const minDemandScore = { Low: 0, Medium: 31, High: 61, "Very High": 81 }[minDemand] ?? 0;
  const filtered = useMemo(() => rankings.filter((ranking) => (region === "All" || ranking.node.region === region) && (type === "All" || ranking.node.type === type) && ranking.node.cpCost <= maxCp && ranking.demandScore >= minDemandScore).sort((a, b) => sortValue(b, sort) - sortValue(a, sort)), [rankings, region, type, maxCp, minDemandScore, sort]);
  return (
    <Panel>
      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <Select label="Region" value={region} values={regions} setValue={setRegion} />
        <Select label="Type" value={type} values={types} setValue={setType} />
        <label className="text-sm text-slate-300">Max CP <span className="text-brass">{maxCp}</span><input className="mt-2 w-full" type="range" min="1" max="6" value={maxCp} onChange={(event) => setMaxCp(Number(event.target.value))} /></label>
        <Select label="Min Demand" value={minDemand} values={["Low", "Medium", "High", "Very High"]} setValue={setMinDemand} />
        <Select label="Sort" value={sort} values={["score", "silver/day", "cp", "demand", "liquidity", "yield"]} setValue={(value) => setSort(value as SortKey)} />
      </div>
      <RankingTable rankings={filtered} openDetail={openDetail} />
    </Panel>
  );
}

function sortValue(ranking: NodeRanking, key: SortKey): number {
  if (key === "silver/day") return ranking.realizableSilverPerDay ?? -1;
  if (key === "cp") return ranking.silverPerCp ?? -1;
  if (key === "demand") return ranking.demandScore;
  if (key === "liquidity") return ranking.liquidityScore;
  if (key === "yield") return ranking.products.reduce((sum, product) => sum + (product.yieldPerDay ?? 0), 0);
  return ranking.score ?? -1;
}

function RankingTable({ rankings, openDetail }: { rankings: NodeRanking[]; openDetail: (id: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400"><tr><th className="py-3">Rank</th><th>Node</th><th>Region</th><th>Item</th><th>CP</th><th>Yield/day</th><th>Silver/day</th><th>Silver/CP</th><th>Demand</th><th>Score</th><th>Data</th></tr></thead>
        <tbody>{rankings.map((ranking) => <tr key={ranking.node.id} className="border-b border-white/5 align-top hover:bg-white/5"><td className="py-3 text-brass">{ranking.rank ?? "-"}</td><td className="py-3"><button className="font-semibold text-white hover:text-brass" onClick={() => openDetail(ranking.node.id)}>{ranking.node.name}</button><div className="text-xs text-slate-500">{ranking.node.productionCategory}</div></td><td className="py-3">{ranking.node.region}</td><td className="py-3"><div className="grid gap-2">{ranking.products.map((product) => <div key={`${ranking.node.id}:${product.itemId ?? product.itemName}`} className="border-b border-white/5 pb-2 last:border-0 last:pb-0"><div className="font-semibold text-white">{product.itemName}</div><ProductSummaryLine product={product} /></div>)}</div></td><td className="py-3">{ranking.node.cpCost}</td><td className="py-3">{formatNumber(ranking.products.reduce((sum, p) => sum + (p.yieldPerDay ?? 0), 0))}</td><td className="py-3 font-semibold text-white">{formatSilver(ranking.realizableSilverPerDay)}</td><td className="py-3">{formatSilver(ranking.silverPerCp)}</td><td className="py-3">{formatNumber(ranking.demandScore, 0)} {ranking.demandLabel}</td><td className="py-3">{formatNumber(ranking.score, 1)}</td><td className="py-3"><span className={`rounded-full border px-2 py-1 text-xs ${confidenceClass(ranking.confidence)}`}>{ranking.confidence}</span></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ProductSummaryLine({ product }: { product: NodeRanking["products"][number] }) {
  const luckyOnly = product.averageYield == null && product.luckyYield != null;
  if (luckyOnly) {
    return <div className="text-xs text-slate-400">Lucky only · Excluded at 0 luck · Price {formatSilver(product.marketData?.currentPrice)} · Avg sales/day {formatNumber(product.marketData?.averageDailyVolume, 0)}</div>;
  }
  return <div className="text-xs text-slate-400">{formatNumber(product.yieldPerDay, 0)}/day · Price {formatSilver(product.marketData?.currentPrice)} · {formatSilver(product.realizableSilverPerDay)}/day · Avg sales/day {formatNumber(product.marketData?.averageDailyVolume, 0)}</div>;
}

function DetailPage({ detail }: { detail: NodeRanking | null }) {
  useEffect(() => {
    if (detail) document.title = `BDO ${detail.node.name} Worker Node Profitability`;
  }, [detail]);
  if (!detail) return <Panel>Loading node...</Panel>;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel>
        <h2 className="text-3xl font-black">{detail.node.name}</h2>
        <p className="mt-2 text-slate-400">{detail.node.region} · {detail.node.type} · {detail.node.cpCost} CP</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><Summary title="Cycle Time" value={`${formatNumber(detail.cycleTimeMinutes)} min`} sub={`${formatNumber(detail.cyclesPerDay)} cycles/day`} /><Summary title="Realizable Silver" value={formatSilver(detail.realizableSilverPerDay)} sub={`${formatSilver(detail.silverPerCp)} / CP`} /><Summary title="Score" value={formatNumber(detail.score, 1)} sub={`${detail.demandLabel} demand`} /></div>
        <h3 className="mt-6 text-xl font-bold">Products</h3>
        <div className="mt-3 grid gap-3">{detail.products.map((product) => <div key={product.itemName} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="font-semibold">{product.itemName} {product.averageYield == null && product.luckyYield != null && <span className="ml-2 text-xs font-normal text-brass">Lucky only, excluded at 0 luck</span>}</div><div className="mt-1"><ProductSummaryLine product={product} /></div><div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-4"><span>Yield/day: {formatNumber(product.yieldPerDay)}</span><span>Price: {formatSilver(product.marketData?.currentPrice)}</span><span>14d sales: {formatNumber(product.marketData?.fourteenDayVolume, 0)}</span><span>Avg sales/day: {formatNumber(product.marketData?.averageDailyVolume, 0)}</span><span>Total trades: {formatNumber(product.marketData?.totalTrades, 0)}</span><span>Theoretical: {formatSilver(product.theoreticalSilverPerDay)}</span><span>Realizable: {formatSilver(product.realizableSilverPerDay)}</span></div><div className="mt-2 text-xs text-slate-500">Market: {product.marketData?.source ?? "unavailable"} {product.marketData?.message ? `· ${product.marketData.message}` : ""}</div></div>)}</div>
      </Panel>
      <Panel>
        <h3 className="text-xl font-bold">Calculation Breakdown</h3>
        <dl className="mt-4 grid gap-3 text-sm"><Break label="Worker" value="Artisan Goblin (150 work speed, 7.5 movement speed)" /><Break label="Workload" value={detail.node.workload == null ? "Missing" : String(detail.node.workload)} /><Break label="Distance" value={detail.node.distance == null ? "Missing" : String(detail.node.distance)} /><Break label="Cycle time" value={`${formatNumber(detail.cycleTimeMinutes)} minutes`} /><Break label="Cycles/day" value={formatNumber(detail.cyclesPerDay)} /><Break label="Demand score" value={`${formatNumber(detail.demandScore, 0)} / 100`} /><Break label="Liquidity score" value={`${formatNumber(detail.liquidityScore, 0)} / 100`} /><Break label="Data confidence" value={detail.confidence} /></dl>
        {detail.issues.length > 0 && <div className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-3"><div className="font-semibold text-red-200">Incomplete data</div><ul className="mt-2 list-inside list-disc text-sm text-red-100">{detail.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
      </Panel>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-xl backdrop-blur">{children}</section>;
}

function Summary({ title, value, sub }: { title: string; value: string; sub: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-wider text-slate-500">{title}</div><div className="mt-2 truncate text-xl font-black text-white">{value}</div><div className="mt-1 text-sm text-slate-400">{sub}</div></div>;
}

function Select({ label, value, values, setValue }: { label: string; value: string; values: string[]; setValue: (value: string) => void }) {
  return <label className="text-sm text-slate-300">{label}<select className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" value={value} onChange={(event) => setValue(event.target.value)}>{values.map((entry) => <option key={entry}>{entry}</option>)}</select></label>;
}

function Break({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-white/10 pb-2"><dt className="text-slate-400">{label}</dt><dd className="text-right text-white">{value}</dd></div>;
}
