import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MapNetwork,
  MarketStatus,
  NodeRanking,
} from "../../shared/models";
import {
  fetchMapNetwork,
  fetchMarketStatus,
  fetchNodeRanking,
  fetchRankings,
} from "../api";
import { formatNumber, formatSilver } from "../format";
import { RankingResults } from "../components/RankingResults";
import {
  Badge,
  FeedbackState,
  Field,
  HelpLabel,
  LoadingCards,
  MetricCard,
  Panel,
  Skeleton,
  fieldClass,
} from "../components/ui";
import { DataPage } from "./DataPage";
import { AppSidebar } from "../components/app-sidebar";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { CraftingPage } from "./CraftingPage";
import { NodeMap, type NodeMapHandle } from "../components/NodeMap";
import {
  nodeMatchesMapScope,
  scopeForNode,
  type MapScope,
} from "../map/workerman";

type Page = "dashboard" | "nodes" | "map" | "crafting" | "data" | "detail";
type SortKey = "score" | "silver/day" | "cp" | "demand" | "liquidity" | "yield";
type Resource<T> =
  | { state: "loading"; data: T | null; error: null }
  | { state: "success"; data: T; error: null }
  | { state: "error"; data: T | null; error: string };

const marketRegions = [
  "NA",
  "EU",
  "ASIA",
  "MENA",
  "JP",
  "KR",
  "TW",
  "SA",
  "RU",
] as const;
const donateNumber = "081358579850";
const koFiUrl = "https://ko-fi.com/treaplabs";
const donateWallets = ["ShopeePay", "GoPay", "DANA"];

function initialMarketRegion(): string {
  try {
    const stored = localStorage.getItem("bdo-market-region");
    return stored &&
      marketRegions.includes(stored as (typeof marketRegions)[number])
      ? stored
      : "ASIA";
  } catch {
    return "ASIA";
  }
}

export function App() {
  const [rankings, setRankings] = useState<Resource<NodeRanking[]>>({
    state: "loading",
    data: null,
    error: null,
  });
  const [status, setStatus] = useState<Resource<MarketStatus>>({
    state: "loading",
    data: null,
    error: null,
  });
  const [detail, setDetail] = useState<Resource<NodeRanking>>({
    state: "loading",
    data: null,
    error: null,
  });
  const [page, setPage] = useState<Page>("dashboard");
  const [previousPage, setPreviousPage] =
    useState<Exclude<Page, "detail">>("nodes");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [marketRegion, setMarketRegion] = useState(initialMarketRegion);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [donateOpen, setDonateOpen] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    try {
      localStorage.setItem("bdo-market-region", marketRegion);
    } catch {
      /* Storage is optional. */
    }

    setRankings((current) => ({
      state: "loading",
      data: current.data,
      error: null,
    }));
    setStatus((current) => ({
      state: "loading",
      data: current.data,
      error: null,
    }));

    fetchRankings(marketRegion)
      .then((data) => {
        if (active) setRankings({ state: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setRankings((current) => ({
            state: "error",
            data: current.data,
            error: getError(error, "Rankings could not be loaded."),
          }));
      });
    fetchMarketStatus(marketRegion)
      .then((data) => {
        if (active) setStatus({ state: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setStatus((current) => ({
            state: "error",
            data: current.data,
            error: getError(error, "Market status is unavailable."),
          }));
      });

    return () => {
      active = false;
    };
  }, [marketRegion, refreshKey]);

  useEffect(() => {
    if (page !== "detail" || selectedId == null) return;
    let active = true;
    setDetail({ state: "loading", data: null, error: null });
    fetchNodeRanking(selectedId, marketRegion)
      .then((data) => {
        if (active) setDetail({ state: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setDetail({
            state: "error",
            data: null,
            error: getError(error, "This node could not be loaded."),
          });
      });
    return () => {
      active = false;
    };
  }, [page, selectedId, marketRegion, detailRefreshKey]);

  useEffect(() => {
    const titles: Record<Exclude<Page, "detail">, string> = {
      dashboard: "BDO Profit Lab",
      nodes: "Node Rankings | BDO Profit Lab",
      map: "Node Map | BDO Profit Lab",
      crafting: "Craft Profit | BDO Profit Lab",
      data: "Community Data | BDO Profit Lab",
    };
    if (page === "detail" && detail.data)
      document.title = `${detail.data.node.name} | BDO Profit Lab`;
    else if (page !== "detail") document.title = titles[page];
  }, [page, detail.data]);

  function navigate(nextPage: Exclude<Page, "detail">) {
    setPage(nextPage);
  }

  function openDetail(id: number) {
    if (page !== "detail") setPreviousPage(page);
    setSelectedId(id);
    setDetail({ state: "loading", data: null, error: null });
    setPage("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyDonateNumber(wallet: string) {
    try {
      await navigator.clipboard.writeText(donateNumber);
      setCopiedWallet(wallet);
      window.setTimeout(() => setCopiedWallet(null), 1800);
    } catch {
      setCopiedWallet("failed");
    }
  }

  const rankingData = rankings.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition focus:translate-y-0"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen">
        <AppSidebar
          page={page}
          navigate={navigate}
          status={status}
          marketRegion={marketRegion}
          setMarketRegion={setMarketRegion}
          regions={marketRegions}
          openSupport={() => setDonateOpen(true)}
          updating={rankings.state === "loading" && rankings.data !== null}
        />
        <div className="min-w-0 flex-1 pt-14 lg:pt-0">
          <main
            id="main-content"
            className="mx-auto w-full max-w-[1480px] min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8"
            tabIndex={-1}
          >
            {rankings.state === "error" && rankings.data && page !== "data" && (
              <div className="mb-4">
                <FeedbackState
                  compact
                  tone="error"
                  title="Refresh failed"
                  message={`${rankings.error} Showing the last successful rankings.`}
                  action={() => setRefreshKey((value) => value + 1)}
                  actionLabel="Retry"
                />
              </div>
            )}
            {page !== "data" &&
              page !== "detail" &&
              rankings.state === "loading" &&
              !rankings.data && <RankingLoading />}
            {page !== "data" &&
              page !== "detail" &&
              rankings.state === "error" &&
              !rankings.data && (
                <Panel className="p-5">
                  <FeedbackState
                    tone="error"
                    title={`Rankings unavailable for ${marketRegion}`}
                    message={rankings.error}
                    action={() => setRefreshKey((value) => value + 1)}
                    actionLabel="Retry rankings"
                  />
                </Panel>
              )}
            {rankingData.length > 0 && page === "dashboard" && (
              <Dashboard
                rankings={rankingData}
                openDetail={openDetail}
                openNodes={() => navigate("nodes")}
              />
            )}
            {rankingData.length > 0 && page === "nodes" && (
              <NodesPage rankings={rankingData} openDetail={openDetail} />
            )}
            {rankingData.length > 0 && page === "map" && (
              <MapPage rankings={rankingData} openDetail={openDetail} />
            )}
            {page === "crafting" && (
              <CraftingPage marketRegion={marketRegion} />
            )}
            {page === "data" && <DataPage />}
            {page === "detail" && (
              <DetailPage
                detail={detail}
                back={() => navigate(previousPage)}
                retry={() => setDetailRefreshKey((value) => value + 1)}
              />
            )}
          </main>
          <footer className="border-t px-6 py-5 text-xs text-muted-foreground">
            <div className="mx-auto flex max-w-[1420px] flex-wrap items-center justify-between gap-2">
              <span>
                Independent community project. Not affiliated with Pearl Abyss.
              </span>
              <span>
                Built by{" "}
                <a
                  href="https://treaplabs.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline"
                >
                  TreapLabs
                </a>
              </span>
            </div>
          </footer>
        </div>
      </div>

      {donateOpen && (
        <SupportDialog
          copiedWallet={copiedWallet}
          copyNumber={copyDonateNumber}
          close={() => setDonateOpen(false)}
        />
      )}
    </div>
  );
}

function RankingLoading() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <span className="sr-only">Loading node rankings</span>
      <LoadingCards />
      <Panel className="p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-5 h-72 w-full" />
      </Panel>
    </div>
  );
}

function Dashboard({
  rankings,
  openDetail,
  openNodes,
}: {
  rankings: NodeRanking[];
  openDetail: (id: number) => void;
  openNodes: () => void;
}) {
  const complete = rankings.filter((ranking) => ranking.score != null);
  const best = complete[0];
  const bestSilver = maxBy(
    complete,
    (ranking) => ranking.realizableSilverPerDay ?? -1,
  );
  const bestCp = maxBy(complete, (ranking) => ranking.silverPerCp ?? -1);
  const bestDemand = maxBy(rankings, (ranking) => ranking.demandScore);
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Analytics"
        title="Overview"
        description="Compare worker-node profitability, contribution efficiency, and market demand."
        action={
          <Button variant="outline" onClick={openNodes}>
            View rankings
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          <CardContent className="p-4 sm:p-8">
            <div className="text-sm font-medium text-muted-foreground">
              Top recommendation
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-semibold tracking-tight sm:text-4xl">
                #{best?.rank ?? "-"}
              </span>
              <h2 className="min-w-0 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {best?.node.name ?? "No ranked node"}
              </h2>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              The strongest overall node under a fixed Artisan Goblin benchmark.
              Review its market evidence and production record before investing
              contribution points.
            </p>
            <div className="mt-6 grid gap-2 min-[420px]:flex min-[420px]:flex-wrap">
              <Button
                onClick={() => best && openDetail(best.node.id)}
                disabled={!best}
                className="w-full min-[420px]:w-auto"
              >
                Open node details
              </Button>
              <Button
                variant="outline"
                onClick={openNodes}
                className="w-full min-[420px]:w-auto"
              >
                Browse all nodes
              </Button>
            </div>
          </CardContent>
          <div className="border-t bg-muted/30 p-4 sm:p-6 lg:border-l lg:border-t-0">
            <div className="text-sm font-medium">Performance snapshot</div>
            <dl className="mt-3 divide-y">
              <Break
                label="Overall score"
                value={formatNumber(best?.score, 1)}
              />
              <Break
                label="Silver / day"
                value={formatSilver(best?.realizableSilverPerDay)}
              />
              <Break
                label="Silver / CP"
                value={formatSilver(best?.silverPerCp)}
              />
              <Break
                label="Demand"
                value={
                  best
                    ? `${formatNumber(best.demandScore, 0)} · ${best.demandLabel}`
                    : "Unavailable"
                }
              />
            </dl>
          </div>
        </div>
      </Card>

      <section aria-labelledby="summary-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="summary-heading" className="text-lg font-semibold">
              Key opportunities
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Leaders across core investment metrics.
            </p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {complete.length} ranked nodes
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Recommended node"
            value={best?.node.name ?? "No ranked node"}
            detail={
              best
                ? `Overall score ${formatNumber(best.score, 1)}`
                : "Ranking data incomplete"
            }
            featured
          />
          <MetricCard
            label="Highest silver/day"
            value={bestSilver?.node.name ?? "Unavailable"}
            detail={formatSilver(bestSilver?.realizableSilverPerDay)}
          />
          <MetricCard
            label="Best silver/CP"
            value={bestCp?.node.name ?? "Unavailable"}
            detail={`${formatSilver(bestCp?.silverPerCp)} per CP`}
          />
          <MetricCard
            label="Highest market demand"
            value={bestDemand?.node.name ?? "Unavailable"}
            detail={`${formatNumber(bestDemand?.demandScore, 0)} · ${bestDemand?.demandLabel ?? "No demand data"}`}
          />
        </div>
      </section>

      <Panel className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Top worker nodes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fixed Artisan Goblin benchmark with current market data.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openNodes}>
            View all
          </Button>
        </div>
        <RankingResults
          rankings={rankings.slice(0, 10)}
          openDetail={openDetail}
          caption="Top ten worker-node rankings"
          pageSize={10}
        />
      </Panel>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function NodesPage({
  rankings,
  openDetail,
}: {
  rankings: NodeRanking[];
  openDetail: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All");
  const [type, setType] = useState("All");
  const maxAvailableCp = Math.max(
    1,
    ...rankings.map((ranking) => ranking.node.cpCost),
  );
  const [maxCp, setMaxCp] = useState(maxAvailableCp);
  const [minDemand, setMinDemand] = useState("Low");
  const [sort, setSort] = useState<SortKey>("score");
  const regions = [
    "All",
    ...Array.from(
      new Set(rankings.map((ranking) => ranking.node.region)),
    ).sort(),
  ];
  const types = [
    "All",
    ...Array.from(new Set(rankings.map((ranking) => ranking.node.type))).sort(),
  ];
  const minDemandScore =
    (
      { Low: 0, Medium: 31, High: 61, "Very High": 81 } as Record<
        string,
        number
      >
    )[minDemand] ?? 0;
  const query = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      rankings
        .filter(
          (ranking) =>
            (!query ||
              `${ranking.node.name} ${ranking.node.productionCategory} ${ranking.products.map((product) => product.itemName).join(" ")}`
                .toLocaleLowerCase()
                .includes(query)) &&
            (region === "All" || ranking.node.region === region) &&
            (type === "All" || ranking.node.type === type) &&
            ranking.node.cpCost <= maxCp &&
            ranking.demandScore >= minDemandScore,
        )
        .sort((a, b) => sortValue(b, sort) - sortValue(a, sort)),
    [rankings, query, region, type, maxCp, minDemandScore, sort],
  );
  const hasFilters = Boolean(
    query ||
    region !== "All" ||
    type !== "All" ||
    maxCp < maxAvailableCp ||
    minDemand !== "Low",
  );
  function resetFilters() {
    setSearch("");
    setRegion("All");
    setType("All");
    setMaxCp(maxAvailableCp);
    setMinDemand("Low");
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Analytics"
        title="Node rankings"
        description={`Search and compare ${formatNumber(rankings.length, 0)} production nodes under the same benchmark calculation.`}
      />
      <Panel className="p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,2fr)_1fr_1fr_1fr]">
          <Field label="Search nodes or products">
            <input
              className={fieldClass}
              type="search"
              placeholder="Try potato, ore, or a node name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <SelectField
            label="Region"
            value={region}
            values={regions}
            setValue={setRegion}
          />
          <SelectField
            label="Node type"
            value={type}
            values={types}
            setValue={setType}
          />
          <SelectField
            label="Sort by"
            value={sort}
            values={[
              "score",
              "silver/day",
              "cp",
              "demand",
              "liquidity",
              "yield",
            ]}
            labels={{
              score: "Overall score",
              "silver/day": "Silver/day",
              cp: "Silver/CP",
              demand: "Demand",
              liquidity: "Liquidity",
              yield: "Yield/day",
            }}
            setValue={(value) => setSort(value as SortKey)}
          />
        </div>
        <details className="mt-3 rounded-lg border bg-muted/30">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-[var(--text-muted)]">
            Advanced settings
          </summary>
          <div className="grid gap-4 border-t border-[var(--border)] p-4 md:grid-cols-2">
            <Field label={`Maximum CP: ${maxCp}`}>
              <input
                className="min-h-11 w-full"
                type="range"
                min="1"
                max={maxAvailableCp}
                value={maxCp}
                onChange={(event) => setMaxCp(Number(event.target.value))}
              />
            </Field>
            <SelectField
              label="Minimum demand"
              value={minDemand}
              values={["Low", "Medium", "High", "Very High"]}
              setValue={setMinDemand}
            />
          </div>
        </details>
        <div
          className="mt-4 flex flex-wrap items-center gap-2"
          aria-label="Active filters"
        >
          <span className="mr-1 text-sm font-bold text-[var(--text-muted)]">
            {formatNumber(filtered.length, 0)} results
          </span>
          {query && (
            <FilterChip
              label={`Search: ${search}`}
              remove={() => setSearch("")}
            />
          )}
          {region !== "All" && (
            <FilterChip
              label={`Region: ${region}`}
              remove={() => setRegion("All")}
            />
          )}
          {type !== "All" && (
            <FilterChip label={`Type: ${type}`} remove={() => setType("All")} />
          )}
          {maxCp < maxAvailableCp && (
            <FilterChip
              label={`Up to ${maxCp} CP`}
              remove={() => setMaxCp(maxAvailableCp)}
            />
          )}
          {minDemand !== "Low" && (
            <FilterChip
              label={`${minDemand}+ demand`}
              remove={() => setMinDemand("Low")}
            />
          )}
          {hasFilters && (
            <button
              type="button"
              className="btn ml-auto"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          )}
        </div>
      </Panel>
      <Panel className="p-4 sm:p-5">
        <RankingResults
          rankings={filtered}
          openDetail={openDetail}
          caption={`${filtered.length} worker nodes sorted by ${sort}`}
          emptyAction={resetFilters}
          emptyActionLabel="Reset filters"
        />
      </Panel>
    </div>
  );
}

function FilterChip({ label, remove }: { label: string; remove: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-secondary px-2.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
      onClick={remove}
      aria-label={`Remove ${label} filter`}
    >
      {label}
      <span aria-hidden="true">×</span>
    </button>
  );
}

function MapPage({
  rankings,
  openDetail,
}: {
  rankings: NodeRanking[];
  openDetail: (id: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    rankings.find((ranking) => ranking.rank === 1)?.node.id ?? null,
  );
  const [type, setType] = useState("All");
  const [showOnlyRanked, setShowOnlyRanked] = useState(true);
  const [mapScope, setMapScope] = useState<MapScope>("mainland");
  const [mapSearch, setMapSearch] = useState("");
  const [mapNetwork, setMapNetwork] = useState<MapNetwork | null>(null);
  const mapRef = useRef<NodeMapHandle>(null);
  useEffect(() => {
    let active = true;
    fetchMapNetwork()
      .then((network) => {
        if (active) setMapNetwork(network);
      })
      .catch(() => {
        if (active) setMapNetwork(null);
      });
    return () => {
      active = false;
    };
  }, []);
  const types = [
    "All",
    ...Array.from(new Set(rankings.map((ranking) => ranking.node.type))).sort(),
  ];
  const mapRankings = rankings.filter(
    (ranking) =>
      ranking.node.position &&
      nodeMatchesMapScope(ranking.node, mapScope) &&
      (type === "All" || ranking.node.type === type) &&
      (!showOnlyRanked || ranking.score != null),
  );
  const selected =
    mapRankings.find((ranking) => ranking.node.id === selectedId) ??
    mapRankings[0] ??
    null;
  const listRankings = rankings
    .filter((ranking) => ranking.node.position)
    .filter((ranking) =>
      ranking.node.name
        .toLocaleLowerCase()
        .includes(mapSearch.trim().toLocaleLowerCase()),
    )
    .slice(0, 80);
  function selectFromList(ranking: NodeRanking) {
    const nextScope = scopeForNode(ranking.node);
    if (!nodeMatchesMapScope(ranking.node, mapScope)) setMapScope(nextScope);
    setSelectedId(ranking.node.id);
    window.setTimeout(() => mapRef.current?.centerNode(ranking), 0);
  }

  useEffect(() => {
    if (mapRankings.some((ranking) => ranking.node.id === selectedId)) return;
    setSelectedId(
      mapRankings.find((ranking) => ranking.rank != null)?.node.id ??
        mapRankings[0]?.node.id ??
        null,
    );
  }, [mapScope, type, showOnlyRanked, rankings, selectedId, mapRankings]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Analytics"
        title="Node map"
        description="Browse positioned production nodes and inspect their current profitability."
      />
      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[200px_200px_220px_1fr] lg:items-end">
          <SelectField
            label="Map scope"
            value={mapScope}
            values={["mainland", "remote", "all"]}
            labels={{
              mainland: "Mainland",
              remote: "Islands & remote",
              all: "All nodes",
            }}
            setValue={(value) => setMapScope(value as MapScope)}
          />
          <SelectField
            label="Node type"
            value={type}
            values={types}
            setValue={setType}
          />
          <label className="flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--canvas-raised)] px-3 text-sm font-semibold text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={showOnlyRanked}
              onChange={(event) => setShowOnlyRanked(event.target.checked)}
            />{" "}
            Ranked nodes only
          </label>
          <div className="text-sm text-[var(--text-muted)] lg:text-right">
            <strong className="text-[var(--text)]">{mapRankings.length}</strong>{" "}
            positioned nodes ·{" "}
            <span className="inline-flex items-center gap-1">
              <i className="grid h-6 w-6 place-items-center rounded bg-sky-700 text-[10px] text-white">
                N
              </i>{" "}
              Exploration node
            </span>{" "}
            ·{" "}
            <span className="inline-flex items-center gap-1">
              <i className="grid h-4 w-4 place-items-center rounded bg-sky-700 text-[8px] text-white">
                P
              </i>{" "}
              Production subnode
            </span>{" "}
            ·{" "}
            <span className="inline-flex items-center gap-1">
              <i className="grid h-5 w-5 place-items-center rounded border-2 border-amber-500 bg-sky-700 text-[8px] text-white">
                P
              </i>{" "}
              Selected
            </span>{" "}
            ·{" "}
            <span className="inline-flex items-center gap-1">
              <i className="h-px w-4 bg-zinc-400" /> Node connection
            </span>
          </div>
        </div>
      </Panel>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="overflow-hidden p-2 sm:p-3">
          {mapRankings.length === 0 ? (
            <FeedbackState
              title="No mapped nodes match"
              message="Change the node type or include incomplete nodes."
              action={() => {
                setType("All");
                setShowOnlyRanked(false);
              }}
              actionLabel="Reset map filters"
            />
          ) : (
            <div
              className="relative h-[60dvh] min-h-[420px] overflow-hidden rounded-lg border bg-black xl:h-[720px]"
              aria-label={`Interactive map with ${mapRankings.length} production nodes`}
            >
              <NodeMap
                ref={mapRef}
                rankings={mapRankings}
                selectedId={selected?.node.id ?? null}
                onSelect={setSelectedId}
                scope={mapScope}
                network={mapNetwork}
              />
            </div>
          )}
          <p className="px-1 pb-1 pt-2 text-[11px] text-muted-foreground">
            Workerman exploration icons and connections show the full
            contribution-node network. The selected production relationship is
            highlighted. The source atlas contains disconnected regional tiles;
            dark areas indicate regions without map artwork.
          </p>
        </Panel>
        <div className="grid content-start gap-4">
          <Panel className="p-4" aria-live="polite">
            {selected ? (
              <MapNodeDetail ranking={selected} openDetail={openDetail} />
            ) : (
              <FeedbackState
                title="No positioned node"
                message="No node is available for the current filters."
                compact
              />
            )}
          </Panel>
          <Panel className="p-4">
            <Field label="Find a mapped node">
              <input
                className={fieldClass}
                type="search"
                value={mapSearch}
                onChange={(event) => setMapSearch(event.target.value)}
                placeholder="Search node name"
              />
            </Field>
            <div className="scrollbar-thin mt-3 max-h-72 overflow-y-auto border-t">
              {listRankings.map((ranking) => (
                <button
                  key={ranking.node.id}
                  type="button"
                  aria-pressed={selected?.node.id === ranking.node.id}
                  onClick={() => selectFromList(ranking)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 border-b px-2 text-left text-sm hover:bg-muted ${selected?.node.id === ranking.node.id ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {ranking.node.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {scopeForNode(ranking.node) === "remote"
                        ? "Remote"
                        : "Mainland"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    #{ranking.rank ?? "Unranked"}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MapNodeDetail({
  ranking,
  openDetail,
}: {
  ranking: NodeRanking;
  openDetail: (id: number) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge tone={ranking.rank && ranking.rank <= 10 ? "gold" : "neutral"}>
            {ranking.rank ? `Rank #${ranking.rank}` : "Unranked"}
          </Badge>
          <h3 className="mt-2 text-xl font-black">{ranking.node.name}</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {ranking.node.type} · {ranking.node.cpCost} CP ·{" "}
            {ranking.node.nearestTown ?? ranking.node.region}
          </p>
          {ranking.node.parentNode && (
            <p className="mt-1 text-xs text-muted-foreground">
              Connected to {ranking.node.parentNode.name} ·{" "}
              {ranking.node.parentNode.cpCost} parent CP
            </p>
          )}
        </div>
        <ConfidenceBadge confidence={ranking.confidence} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <CompactMetric
          label="Silver/day"
          value={formatSilver(ranking.realizableSilverPerDay)}
        />
        <CompactMetric
          label="Silver/CP"
          value={formatSilver(ranking.silverPerCp)}
        />
        <CompactMetric label="Score" value={formatNumber(ranking.score, 1)} />
        <CompactMetric
          label="Demand"
          value={`${formatNumber(ranking.demandScore, 0)} ${ranking.demandLabel}`}
        />
      </dl>
      <button
        className="btn-primary mt-4 w-full"
        type="button"
        onClick={() => openDetail(ranking.node.id)}
      >
        Open node details
      </button>
    </div>
  );
}

function DetailPage({
  detail,
  back,
  retry,
}: {
  detail: Resource<NodeRanking>;
  back: () => void;
  retry: () => void;
}) {
  if (detail.state === "loading")
    return (
      <div className="grid gap-4" aria-busy="true">
        <button type="button" className="btn w-fit" onClick={back}>
          ← Back to results
        </button>
        <LoadingCards count={3} />
        <Panel className="p-5">
          <Skeleton className="h-72" />
        </Panel>
      </div>
    );
  if (detail.state === "error" || !detail.data)
    return (
      <div className="grid gap-4">
        <button type="button" className="btn w-fit" onClick={back}>
          ← Back to results
        </button>
        <Panel className="p-5">
          <FeedbackState
            tone="error"
            title="Node details unavailable"
            message={detail.error ?? "The requested node was not found."}
            action={retry}
            actionLabel="Retry"
          />
        </Panel>
      </div>
    );
  const ranking = detail.data;
  return (
    <div className="grid gap-4">
      <button type="button" className="btn w-fit" onClick={back}>
        ← Back to results
      </button>
      <Panel className="overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Node record {ranking.node.id}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={ranking.rank === 1 ? "gold" : "neutral"}>
                  {ranking.rank ? `Rank #${ranking.rank}` : "Unranked"}
                </Badge>
                <ConfidenceBadge confidence={ranking.confidence} />
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {ranking.node.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {ranking.node.region} · {ranking.node.type} ·{" "}
                {ranking.node.productionCategory} · {ranking.node.cpCost} CP
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 px-5 py-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                Overall rank
              </p>
              <p className="mt-1 text-3xl font-semibold">
                #{ranking.rank ?? "-"}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Cycle time"
              value={
                ranking.cycleTimeMinutes == null
                  ? "Not calculated"
                  : `${formatNumber(ranking.cycleTimeMinutes)} min`
              }
              detail={
                ranking.cyclesPerDay == null
                  ? "Missing cycle inputs"
                  : `${formatNumber(ranking.cyclesPerDay)} cycles/day`
              }
            />
            <MetricCard
              label="Realizable silver/day"
              value={
                ranking.realizableSilverPerDay == null
                  ? "Market unavailable"
                  : formatSilver(ranking.realizableSilverPerDay)
              }
              detail={`${formatSilver(ranking.silverPerCp)} per CP`}
              featured
            />
            <MetricCard
              label="Overall score"
              value={
                ranking.score == null
                  ? "Unranked"
                  : formatNumber(ranking.score, 1)
              }
              detail={`${ranking.demandLabel} demand`}
            />
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <Panel className="p-4 sm:p-5">
          <div className="border-b pb-3">
            <h2 className="text-lg font-semibold">Products and market value</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estimated output and current market evidence.
            </p>
          </div>
          {ranking.products.length === 0 ? (
            <div className="mt-4">
              <FeedbackState
                title="No product data"
                message="This node has no product records available."
                compact
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {ranking.products.map((product) => (
                <ProductCard
                  key={`${product.itemId ?? "unknown"}-${product.itemName}`}
                  product={product}
                />
              ))}
            </div>
          )}
        </Panel>
        <div className="grid content-start gap-4">
          <Panel className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Calculation assumptions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every node is compared with the same benchmark worker.
            </p>
            <dl className="mt-4 grid gap-0 text-sm">
              <Break label="Worker" value="Artisan Goblin" />
              <Break label="Work speed" value="150" />
              <Break label="Movement speed" value="7.5" />
              <Break label="Worker luck" value="0" />
              <Break
                label="Workload"
                value={
                  ranking.node.workload == null
                    ? "Missing"
                    : formatNumber(ranking.node.workload)
                }
              />
              <Break
                label="Distance"
                value={
                  ranking.node.distance == null
                    ? "Missing"
                    : formatNumber(ranking.node.distance)
                }
              />
              <Break
                label="Demand score"
                value={`${formatNumber(ranking.demandScore, 0)} / 100`}
              />
              <Break
                label="Liquidity score"
                value={`${formatNumber(ranking.liquidityScore, 0)} / 100`}
              />
            </dl>
          </Panel>
          {ranking.issues.length > 0 ? (
            <Panel className="border-destructive/30 bg-destructive/10 p-4">
              <h3 className="font-semibold text-destructive">
                Incomplete calculation
              </h3>
              <p className="mt-1 text-sm text-destructive">
                These missing inputs prevent or reduce confidence in this
                result.
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-destructive">
                {ranking.issues.map((issue) => (
                  <li key={issue} className="flex gap-2">
                    <span aria-hidden="true">!</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <FeedbackState
              compact
              tone="success"
              title="Calculation inputs complete"
              message="No incomplete-data issues were reported for this node."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
}: {
  product: NodeRanking["products"][number];
}) {
  const luckyOnly = product.averageYield == null && product.luckyYield != null;
  const market = product.marketData;
  return (
    <article className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{product.itemName}</h3>
          {luckyOnly && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Lucky-only product, excluded from the 0-luck benchmark
            </p>
          )}
        </div>
        <Badge
          tone={
            market?.source === "real" || market?.source === "cached"
              ? "positive"
              : market?.source === "stale"
                ? "warning"
                : "neutral"
          }
        >
          Market: {market?.source ?? "unavailable"}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <CompactMetric
          label="Yield/day"
          value={luckyOnly ? "Excluded" : formatNumber(product.yieldPerDay)}
        />
        <CompactMetric
          label="Current price"
          value={market ? formatSilver(market.currentPrice) : "Unavailable"}
        />
        <CompactMetric
          label="Realizable/day"
          value={formatSilver(product.realizableSilverPerDay)}
        />
        <CompactMetric
          label="Avg sales/day"
          value={formatNumber(market?.averageDailyVolume, 0)}
        />
        <CompactMetric
          label="14-day sales"
          value={formatNumber(market?.fourteenDayVolume, 0)}
        />
        <CompactMetric
          label="Total trades"
          value={formatNumber(market?.totalTrades, 0)}
        />
        <CompactMetric
          label="Theoretical/day"
          value={formatSilver(product.theoreticalSilverPerDay)}
        />
      </dl>
      {market?.message && (
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {market.message}
        </p>
      )}
    </article>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-subtle)]">{label}</dt>
      <dd className="mt-1 font-bold tabular-nums text-[var(--text)]">
        {value}
      </dd>
    </div>
  );
}
function Break({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-0">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right font-semibold text-[var(--text)]">{value}</dd>
    </div>
  );
}
function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <Badge
      tone={
        confidence === "high"
          ? "positive"
          : confidence === "estimated"
            ? "warning"
            : "negative"
      }
    >
      {confidence} confidence
    </Badge>
  );
}

function SelectField({
  label,
  value,
  values,
  labels,
  setValue,
}: {
  label: string;
  value: string;
  values: string[];
  labels?: Record<string, string>;
  setValue: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={fieldClass}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        {values.map((entry) => (
          <option key={entry} value={entry}>
            {labels?.[entry] ?? entry}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SupportDialog({
  copiedWallet,
  copyNumber,
  close,
}: {
  copiedWallet: string | null;
  copyNumber: (wallet: string) => void;
  close: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Support BDO Profit Lab</DialogTitle>
          <DialogDescription>
            Help cover hosting, data maintenance, and future improvements.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Ko-fi</CardTitle>
              <CardDescription>Secure external support page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <a href={koFiUrl} target="_blank" rel="noopener noreferrer">
                  Open Ko-fi
                </a>
              </Button>
            </CardContent>
          </Card>
          {donateWallets.map((wallet) => (
            <Card key={wallet}>
              <CardHeader className="pb-3">
                <CardTitle>{wallet}</CardTitle>
                <CardDescription>Indonesian e-wallet transfer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-muted p-3 text-center font-mono font-semibold">
                  {donateNumber}
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => copyNumber(wallet)}
                >
                  {copiedWallet === wallet ? "Copied" : "Copy number"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {copiedWallet === "failed" && (
          <p className="text-sm text-destructive" role="alert">
            Copy failed. Select the number manually.
          </p>
        )}
        <p className="border-t pt-4 text-xs text-muted-foreground">
          Support is optional and does not affect rankings, data access, or
          features.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function sortValue(ranking: NodeRanking, key: SortKey): number {
  if (key === "silver/day") return ranking.realizableSilverPerDay ?? -1;
  if (key === "cp") return ranking.silverPerCp ?? -1;
  if (key === "demand") return ranking.demandScore;
  if (key === "liquidity") return ranking.liquidityScore;
  if (key === "yield")
    return ranking.products.reduce(
      (sum, product) => sum + (product.yieldPerDay ?? 0),
      0,
    );
  return ranking.score ?? -1;
}

function maxBy<T>(values: T[], read: (value: T) => number): T | undefined {
  return values.reduce<T | undefined>(
    (best, value) => (best == null || read(value) > read(best) ? value : best),
    undefined,
  );
}
function getError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
