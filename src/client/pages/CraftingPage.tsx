import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, Search } from "lucide-react";
import type {
  CraftAssumptions,
  CraftProfitResult,
  IngredientAlternativeQuote,
  IngredientCostChoice,
  LifeSkill,
  MarketData,
} from "../../shared/models";
import {
  fetchCraftRankings,
  fetchCraftGuide,
  fetchItemMarket,
  searchItems,
  type ItemSearchResult,
} from "../api";
import { formatNumber, formatSilver } from "../format";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";

type Sort =
  | "realizableProfitPerHour"
  | "profitPerHour"
  | "profitPerBatch"
  | "marginPercent"
  | "demandScore"
  | "liquidityScore";
const skills: LifeSkill[] = ["cooking", "alchemy", "processing"];
const defaults: CraftAssumptions = {
  mastery: { cooking: 1000, alchemy: 1000, processing: 1000 },
  craftSeconds: { cooking: 1.2, alchemy: 1.2, processing: 10 },
  saleMultiplier: 0.845,
  batchSize: 1,
  recursiveCrafting: true,
  maxCraftDepth: 5,
  normalYield: { cooking: 2.5, alchemy: 2.5, processing: 2.5 },
  rareYield: { cooking: 0.3, alchemy: 0.3, processing: 0 },
};

export function CraftingPage({ marketRegion }: { marketRegion: string }) {
  const [assumptions, setAssumptions] = useState<CraftAssumptions>(() => {
    try {
      return {
        ...defaults,
        ...JSON.parse(localStorage.getItem("bdo-craft-settings") ?? "{}"),
      };
    } catch {
      return defaults;
    }
  });
  const [enabledSkills, setEnabledSkills] = useState<LifeSkill[]>(skills);
  const [results, setResults] = useState<CraftProfitResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("realizableProfitPerHour");
  const [onlyPriced, setOnlyPriced] = useState(true);
  const [materialsAvailableOnly, setMaterialsAvailableOnly] = useState(false);
  const [minDailySales, setMinDailySales] = useState(0);
  const [maxDaysToSell, setMaxDaysToSell] = useState(30);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ItemSearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemSearchResult | null>(
    null,
  );
  const [itemMarket, setItemMarket] = useState<MarketData | null>(null);
  const [guide, setGuide] = useState<CraftProfitResult | null>(null);
  const [guideHistory, setGuideHistory] = useState<CraftProfitResult[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("bdo-craft-settings", JSON.stringify(assumptions));
  }, [assumptions]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchCraftRankings(marketRegion, assumptions, enabledSkills)
      .then((data) => {
        if (active) setResults(data);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to calculate craft profits.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [marketRegion, assumptions, enabledSkills]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim().length >= 2)
        searchItems(query)
          .then(setItems)
          .catch(() => setItems([]));
      else setItems([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function chooseItem(item: ItemSearchResult) {
    setSelectedItem(item);
    setQuery(item.name);
    setItems([]);
    setItemMarket(
      await fetchItemMarket(item.id, marketRegion).catch(() => null),
    );
  }
  async function openGuide(recipeId: string, embedded?: CraftProfitResult) {
    if (guide) setGuideHistory((current) => [...current, guide]);
    setGuideError(null);
    if (embedded) {
      setGuide(embedded);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setGuideLoading(true);
    try {
      setGuide(await fetchCraftGuide(recipeId, marketRegion, assumptions));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason: unknown) {
      setGuideError(
        reason instanceof Error
          ? reason.message
          : "Unable to load craft guide.",
      );
    } finally {
      setGuideLoading(false);
    }
  }

  function closeOrBackGuide() {
    const previous = guideHistory.at(-1);
    if (previous) {
      setGuide(previous);
      setGuideHistory((current) => current.slice(0, -1));
    } else {
      setGuide(null);
    }
  }
  const visible = results
    .filter(
      (result) =>
        (!onlyPriced || result.priceCoverage === 1) &&
        (!materialsAvailableOnly || result.requirementsAvailable !== false) &&
        (result.averageDailySales ?? 0) >= minDailySales &&
        (result.estimatedDaysToSellBatch == null ||
          result.estimatedDaysToSellBatch <= maxDaysToSell),
    )
    .sort(
      (a, b) =>
        (b[sort] ?? Number.NEGATIVE_INFINITY) -
        (a[sort] ?? Number.NEGATIVE_INFINITY),
    );

  if (guideLoading && !guide) {
    return (
      <div className="grid gap-4">
        <Button variant="outline" className="w-fit" onClick={closeOrBackGuide}>
          <ArrowLeft /> Back to craft rankings
        </Button>
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (guide) {
    return (
      <CraftGuidePage
        result={guide}
        error={guideError}
        back={closeOrBackGuide}
        openGuide={openGuide}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Life skill analytics
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Craft profit
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Search current item prices and compare cooking, alchemy, and
          processing recipes using live {marketRegion} market data.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Item price search</CardTitle>
          <CardDescription>
            Find an output or required material by name or item ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedItem(null);
                setItemMarket(null);
              }}
              placeholder="Search Beer, Iron Ore, reagent..."
            />
            {items.length > 0 && (
              <div className="absolute inset-x-0 top-11 z-20 overflow-hidden rounded-lg border bg-popover shadow-lg">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className="flex w-full items-center justify-between gap-4 border-b px-3 py-2.5 text-left text-sm last:border-0 hover:bg-accent"
                    onClick={() => chooseItem(item)}
                  >
                    <span>
                      <strong className="font-medium">{item.name}</strong>
                      <span className="ml-2 text-xs text-muted-foreground">
                        #{item.id}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.producedByRecipeCount} recipes
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedItem && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Current price"
                value={
                  itemMarket?.source === "unavailable"
                    ? "Unavailable"
                    : formatSilver(itemMarket?.currentPrice)
                }
              />
              <Metric
                label="Sell orders"
                value={formatNumber(itemMarket?.sellOrders, 0)}
              />
              <Metric
                label="Daily volume"
                value={formatNumber(itemMarket?.averageDailyVolume, 0)}
              />
              <Metric
                label="Recipe usage"
                value={`${selectedItem.producedByRecipeCount} outputs · ${selectedItem.usedByRecipeCount} inputs`}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>
              Stored in this browser. Expected yields remain editable because
              mastery output varies by life skill.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div>
              <Label>Life skills</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Button
                    key={skill}
                    size="sm"
                    variant={
                      enabledSkills.includes(skill) ? "default" : "outline"
                    }
                    onClick={() =>
                      setEnabledSkills((current) =>
                        current.includes(skill)
                          ? current.filter((value) => value !== skill)
                          : [...current, skill],
                      )
                    }
                  >
                    {skill}
                  </Button>
                ))}
              </div>
            </div>
            <Setting
              label="Sale proceeds"
              value={assumptions.saleMultiplier * 100}
              suffix="%"
              setValue={(value) =>
                setAssumptions((current) => ({
                  ...current,
                  saleMultiplier: value / 100,
                }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Setting
                label="Cooking mastery"
                value={assumptions.mastery.cooking}
                setValue={(value) =>
                  setAssumptions((current) => ({
                    ...current,
                    mastery: { ...current.mastery, cooking: value },
                  }))
                }
              />
              <Setting
                label="Alchemy mastery"
                value={assumptions.mastery.alchemy}
                setValue={(value) =>
                  setAssumptions((current) => ({
                    ...current,
                    mastery: { ...current.mastery, alchemy: value },
                  }))
                }
              />
            </div>
            <Setting
              label="Processing mastery"
              value={assumptions.mastery.processing}
              setValue={(value) =>
                setAssumptions((current) => ({
                  ...current,
                  mastery: { ...current.mastery, processing: value },
                }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Setting
                label="Expected normal yield"
                value={assumptions.normalYield.cooking}
                setValue={(value) =>
                  setAssumptions((current) => ({
                    ...current,
                    normalYield: {
                      ...current.normalYield,
                      cooking: value,
                      alchemy: value,
                    },
                  }))
                }
              />
              <Setting
                label="Expected rare yield"
                value={assumptions.rareYield.cooking}
                setValue={(value) =>
                  setAssumptions((current) => ({
                    ...current,
                    rareYield: {
                      ...current.rareYield,
                      cooking: value,
                      alchemy: value,
                    },
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Setting
                label="Cook seconds"
                value={assumptions.craftSeconds.cooking}
                setValue={(value) =>
                  setAssumptions((current) => ({
                    ...current,
                    craftSeconds: { ...current.craftSeconds, cooking: value },
                  }))
                }
              />
              <Setting
                label="Alchemy seconds"
                value={assumptions.craftSeconds.alchemy}
                setValue={(value) =>
                  setAssumptions((current) => ({
                    ...current,
                    craftSeconds: { ...current.craftSeconds, alchemy: value },
                  }))
                }
              />
            </div>
            <Setting
              label="Batch crafts"
              value={assumptions.batchSize}
              setValue={(value) =>
                setAssumptions((current) => ({
                  ...current,
                  batchSize: Math.max(1, value),
                }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Setting
                label="Min daily sales"
                value={minDailySales}
                setValue={setMinDailySales}
              />
              <Setting
                label="Max days to sell"
                value={maxDaysToSell}
                setValue={setMaxDaysToSell}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={assumptions.recursiveCrafting}
                onChange={(event) =>
                  setAssumptions((current) => ({
                    ...current,
                    recursiveCrafting: event.target.checked,
                  }))
                }
              />{" "}
              Compare buy vs craft
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyPriced}
                onChange={(event) => setOnlyPriced(event.target.checked)}
              />{" "}
              Fully priced recipes only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={materialsAvailableOnly}
                onChange={(event) =>
                  setMaterialsAvailableOnly(event.target.checked)
                }
              />{" "}
              Materials available only
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Best items to create</CardTitle>
              <CardDescription>
                {visible.length} recipes ranked with current prices and
                finished-item sellability.
              </CardDescription>
            </div>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-auto"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
            >
              <option value="realizableProfitPerHour">
                Realizable profit / hour
              </option>
              <option value="profitPerHour">Theoretical profit / hour</option>
              <option value="profitPerBatch">Profit / batch</option>
              <option value="marginPercent">Margin</option>
              <option value="demandScore">Demand</option>
              <option value="liquidityScore">Liquidity</option>
            </select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((value) => (
                  <Skeleton key={value} className="h-24" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                No recipes match the current price and sellability filters.
              </div>
            ) : (
              <div className="grid gap-3">
                {visible.map((result) => (
                  <RecipeResult
                    key={result.recipe.id}
                    result={result}
                    openGuide={openGuide}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecipeResult({
  result,
  openGuide,
}: {
  result: CraftProfitResult;
  openGuide: (recipeId: string, embedded?: CraftProfitResult) => void;
}) {
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="font-semibold hover:underline"
              onClick={(event) => {
                event.preventDefault();
                openGuide(result.recipe.id);
              }}
            >
              {result.recipe.name}
            </button>
            <Badge variant="secondary">{result.recipe.lifeSkill}</Badge>
            {result.priceCoverage < 1 && (
              <Badge variant="warning">
                {formatNumber(result.priceCoverage * 100, 0)}% priced
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.recipe.method} · {formatNumber(result.averageDailySales, 0)}{" "}
            sold/day · {formatNumber(result.outputSellOrders, 0)} listed
          </p>
          <p className="mt-1 text-xs">
            <RequirementStatus result={result} />
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <div
            className={
              result.realizableProfitPerHour != null &&
              result.realizableProfitPerHour > 0
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : "font-semibold"
            }
          >
            {formatSilver(result.realizableProfitPerHour)} / hr
          </div>
          <div className="text-xs text-muted-foreground">
            realizable · {formatSilver(result.profitPerHour)} theoretical
          </div>
        </div>
        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Current output price"
            value={formatSilver(result.outputPrice)}
          />
          <Metric
            label="Listed stock"
            value={formatNumber(result.outputSellOrders, 0)}
          />
          <Metric
            label="Average daily sales"
            value={formatNumber(result.averageDailySales, 0)}
          />
          <Metric
            label="Days to sell batch"
            value={formatNumber(result.estimatedDaysToSellBatch, 2)}
          />
          <Metric
            label="Material cost"
            value={formatSilver(result.materialCost)}
          />
          <Metric
            label="Profit / batch"
            value={formatSilver(result.profitPerBatch)}
          />
          <Metric
            label="Margin"
            value={`${formatNumber(result.marginPercent, 1)}%`}
          />
          <Metric
            label="Demand / liquidity"
            value={`${formatNumber(result.demandScore, 0)} / ${formatNumber(result.liquidityScore, 0)}`}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Market: {result.marketSource} · Updated{" "}
          {result.marketUpdatedAt
            ? new Date(result.marketUpdatedAt).toLocaleString()
            : "unavailable"}{" "}
          · Stock covers {formatNumber(result.stockToDailySales, 2)} days of
          average sales.
        </p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Requirements</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Listed stock is compared with the quantity required for this
              batch.
            </p>
          </div>
          <RequirementStatus result={result} badge />
        </div>
        <div className="mt-3 grid gap-3">
          {result.ingredients.map((item) => (
            <RequirementRow
              key={`${item.itemId}-${item.source}`}
              item={item}
              openGuide={openGuide}
            />
          ))}
        </div>
        {result.issues.length > 0 && (
          <ul className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {result.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
        <a
          href={result.recipe.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Recipe source <ExternalLink className="size-3" />
        </a>
      </div>
    </details>
  );
}

function CraftGuidePage({
  result,
  error,
  back,
  openGuide,
}: {
  result: CraftProfitResult;
  error: string | null;
  back: () => void;
  openGuide: (recipeId: string, embedded?: CraftProfitResult) => void;
}) {
  return (
    <div className="grid gap-6">
      <Button variant="outline" className="w-fit" onClick={back}>
        <ArrowLeft /> Back
      </Button>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {result.recipe.lifeSkill} · {result.recipe.method}
        </p>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          How to craft {result.recipe.name}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Complete recursive guide for {formatNumber(result.craftCount, 2)}{" "}
          crafts, producing approximately{" "}
          {formatNumber(result.expectedOutputQuantity, 2)} units. Every
          craftable ingredient includes its own requirements.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Expected output"
          value={formatNumber(result.expectedOutputQuantity, 2)}
        />
        <Metric
          label="Material cost"
          value={formatSilver(result.materialCost)}
        />
        <Metric
          label="Net sale revenue"
          value={formatSilver(result.netRevenue)}
        />
        <Metric
          label="Profit / batch"
          value={formatSilver(result.profitPerBatch)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Crafting tree</CardTitle>
          <CardDescription>
            Craft paths use the cheapest available recipe. Market and vendor
            fallbacks remain visible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecursiveCraftTree result={result} depth={0} openGuide={openGuide} />
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <RequirementStatus result={result} badge />
        <span>Source: {result.recipe.source.provider}</span>
        <a
          href={result.recipe.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          Original recipe <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

function RecursiveCraftTree({
  result,
  depth,
  openGuide,
}: {
  result: CraftProfitResult;
  depth: number;
  openGuide: (recipeId: string, embedded?: CraftProfitResult) => void;
}) {
  return (
    <section
      className={
        depth === 0 ? "" : "ml-2 border-l-2 border-border pl-3 sm:ml-5 sm:pl-5"
      }
    >
      {depth > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
          <div>
            <button
              type="button"
              className="font-semibold hover:underline"
              onClick={() => openGuide(result.recipe.id, result)}
            >
              {result.recipe.name}
            </button>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatNumber(result.craftCount, 2)} crafts →{" "}
              {formatNumber(result.expectedOutputQuantity, 2)} expected units
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="font-medium">
              {formatSilver(result.materialCost)}
            </div>
            <div className="text-muted-foreground">craft cost</div>
          </div>
        </div>
      )}
      <div className="grid gap-3">
        {result.ingredients.map((item) => (
          <details
            key={`${depth}-${result.recipe.id}-${item.itemId}`}
            className="group/tree rounded-lg border bg-background"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                {item.craftRecipeId ? (
                  <button
                    type="button"
                    className="break-words text-left font-medium hover:underline"
                    onClick={(event) => {
                      event.preventDefault();
                      openGuide(item.craftRecipeId!, item.craftResult);
                    }}
                  >
                    {formatNumber(item.quantity, 2)} × {item.itemName}
                  </button>
                ) : (
                  <div className="break-words font-medium">
                    {formatNumber(item.quantity, 2)} × {item.itemName}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline">Selected: {item.source}</Badge>
                  {item.craftRecipeId && (
                    <Badge variant="secondary">Craftable</Badge>
                  )}
                  <StockBadge
                    available={item.hasEnoughStock}
                    source={item.source}
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <div>
                  <div className="font-medium tabular-nums">
                    {formatSilver(item.totalCost)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    selected cost
                  </div>
                </div>
                <ChevronDown className="size-4 text-muted-foreground transition group-open/tree:rotate-180" />
              </div>
            </summary>
            <div className="border-t p-3">
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <GuideFact
                  label="Market fallback"
                  value={formatSilver(item.marketTotalCost)}
                />
                <GuideFact
                  label="Market stock"
                  value={stockLabel(item.listedStock, "market")}
                />
                <GuideFact
                  label="Vendor price"
                  value={formatSilver(item.vendorPrice)}
                />
              </div>
              {item.craftResult ? (
                <div className="mt-3">
                  <RecursiveCraftTree
                    result={item.craftResult}
                    depth={depth + 1}
                    openGuide={openGuide}
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  No deeper recipe is available. Obtain this material from the
                  selected market or vendor source.
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
      {result.issues.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs text-amber-600 dark:text-amber-400">
          {result.issues.map((issue) => (
            <li key={`${depth}-${issue}`}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GuideFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}

function RequirementStatus({
  result,
  badge = false,
}: {
  result: CraftProfitResult;
  badge?: boolean;
}) {
  if (result.requirementsAvailable === false) {
    const text = result.bottleneckRequirement
      ? `${result.insufficientRequirementCount} shortage${result.insufficientRequirementCount === 1 ? "" : "s"} · bottleneck ${result.bottleneckRequirement.itemName}`
      : `${result.insufficientRequirementCount} material shortages`;
    return badge ? (
      <Badge variant="destructive">{text}</Badge>
    ) : (
      <span className="text-destructive">Materials: {text}</span>
    );
  }
  if (result.requirementsAvailable == null) {
    const text = `${result.unavailableRequirementCount} stock value${result.unavailableRequirementCount === 1 ? "" : "s"} unknown`;
    return badge ? (
      <Badge variant="warning">{text}</Badge>
    ) : (
      <span className="text-amber-600 dark:text-amber-400">
        Materials: {text}
      </span>
    );
  }
  const text =
    result.requirementStockCoverage == null
      ? "Available · vendor supplied"
      : `Available · ${formatNumber(result.requirementStockCoverage, 1)} batches covered`;
  return badge ? (
    <Badge variant="success">{text}</Badge>
  ) : (
    <span className="text-emerald-600 dark:text-emerald-400">
      Materials: {text}
    </span>
  );
}

function RequirementRow({
  item,
  openGuide,
}: {
  item: IngredientCostChoice;
  openGuide: (recipeId: string, embedded?: CraftProfitResult) => void;
}) {
  return (
    <details className="group/requirement rounded-lg border bg-muted/10">
      <summary className="grid cursor-pointer list-none gap-3 p-3 text-sm sm:grid-cols-[minmax(180px,1.4fr)_100px_110px_110px_120px_auto] sm:items-center">
        <div className="min-w-0">
          {item.craftRecipeId ? (
            <button
              type="button"
              className="block max-w-full truncate font-medium hover:underline"
              onClick={(event) => {
                event.preventDefault();
                openGuide(item.craftRecipeId!, item.craftResult);
              }}
            >
              {item.itemName}
            </button>
          ) : (
            <div className="truncate font-medium">{item.itemName}</div>
          )}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="outline">{item.source}</Badge>
            <StockBadge available={item.hasEnoughStock} source={item.source} />
            {item.alternatives.length > 1 && (
              <Badge variant="secondary">
                {item.alternatives.length} alternatives
              </Badge>
            )}
          </div>
        </div>
        <RequirementValue
          label="Required"
          value={formatNumber(item.quantity)}
        />
        <RequirementValue
          label="Unit cost"
          value={formatSilver(item.unitCost)}
        />
        <RequirementValue
          label="Total cost"
          value={formatSilver(item.totalCost)}
        />
        <RequirementValue
          label="Listed stock"
          value={stockLabel(item.listedStock, item.source)}
        />
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <RequirementValue
            label="Coverage"
            value={coverageLabel(item.stockCoverage, item.source)}
          />
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open/requirement:rotate-180" />
        </div>
      </summary>
      <div className="border-t p-3">
        {item.source === "craft" && (
          <div className="mb-3 rounded-md border bg-background p-3 text-xs">
            <div className="font-medium">Craft path selected</div>
            <div className="mt-1 grid gap-1 text-muted-foreground sm:grid-cols-3">
              <span>Craft cost: {formatSilver(item.craftTotalCost)}</span>
              <span>Market fallback: {formatSilver(item.marketTotalCost)}</span>
              <span>
                Market stock: {stockLabel(item.listedStock, "market")} ·{" "}
                {coverageLabel(item.marketStockCoverage, "market")}
              </span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Alternative</th>
                <th className="px-3 py-2 text-right font-medium">Required</th>
                <th className="px-3 py-2 text-right font-medium">
                  Selected cost
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Market price
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Listed stock
                </th>
                <th className="px-3 py-2 text-right font-medium">Coverage</th>
                <th className="px-3 py-2 font-medium">Availability</th>
              </tr>
            </thead>
            <tbody>
              {item.alternatives.map((alternative) => (
                <AlternativeRow
                  key={alternative.itemId}
                  item={alternative}
                  openGuide={openGuide}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Market data: {item.marketSource} ·{" "}
          {item.marketUpdatedAt
            ? new Date(item.marketUpdatedAt).toLocaleString()
            : "unavailable"}
        </p>
      </div>
    </details>
  );
}

function AlternativeRow({
  item,
  openGuide,
}: {
  item: IngredientAlternativeQuote;
  openGuide: (recipeId: string, embedded?: CraftProfitResult) => void;
}) {
  return (
    <tr className={item.selected ? "bg-accent/60" : "border-t"}>
      <td className="px-3 py-2">
        {item.craftRecipeId ? (
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={() => openGuide(item.craftRecipeId!, item.craftResult)}
          >
            {item.itemName}
          </button>
        ) : (
          <span className="font-medium">{item.itemName}</span>
        )}
        {item.selected && (
          <Badge className="ml-2" variant="default">
            Selected
          </Badge>
        )}
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Via {item.selectedSource}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatNumber(item.quantity)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatSilver(item.selectedTotalCost)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatSilver(item.marketPrice)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {stockLabel(item.listedStock, item.selectedSource)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {coverageLabel(item.marketStockCoverage, "market")}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <StockBadge
            available={item.hasEnoughStock}
            source={item.selectedSource}
          />
          {item.selectedSource === "craft" && (
            <Badge
              variant={
                item.marketHasEnoughStock === false
                  ? "destructive"
                  : item.marketHasEnoughStock === true
                    ? "outline"
                    : "warning"
              }
            >
              Market{" "}
              {item.marketHasEnoughStock === false
                ? "short"
                : item.marketHasEnoughStock === true
                  ? "available"
                  : "unknown"}
            </Badge>
          )}
        </div>
      </td>
    </tr>
  );
}

function RequirementValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">
        {label}
      </div>
      <div className="tabular-nums sm:text-right">{value}</div>
    </div>
  );
}

function StockBadge({
  available,
  source,
}: {
  available: boolean | null;
  source: IngredientCostChoice["source"];
}) {
  if (source === "vendor")
    return <Badge variant="success">Vendor unlimited</Badge>;
  if (available === true) return <Badge variant="success">Available</Badge>;
  if (available === false)
    return <Badge variant="destructive">Insufficient</Badge>;
  return <Badge variant="warning">Stock unknown</Badge>;
}

function stockLabel(
  stock: number | null,
  source: IngredientCostChoice["source"],
): string {
  if (source === "vendor") return "Unlimited";
  return stock == null ? "Unknown" : formatNumber(stock, 0);
}

function coverageLabel(
  coverage: number | null,
  source: IngredientCostChoice["source"],
): string {
  if (source === "vendor") return "Unlimited";
  return coverage == null ? "Unknown" : `${formatNumber(coverage, 1)}×`;
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function Setting({
  label,
  value,
  suffix,
  setValue,
}: {
  label: string;
  value: number;
  suffix?: string;
  setValue: (value: number) => void;
}) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      <div className="relative">
        <Input
          type="number"
          min="0"
          step="0.1"
          value={value}
          onChange={(event) =>
            setValue(Math.max(0, Number(event.target.value)))
          }
        />
        {suffix && (
          <span className="absolute right-3 top-2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </Label>
  );
}
