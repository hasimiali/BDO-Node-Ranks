import { calculateCycleTime, calculateCyclesPerDay } from "../../calculations/cycle.js";
import { calculateDemandScore, demandLabel } from "../../calculations/demand.js";
import { calculateLiquidityScore } from "../../calculations/liquidity.js";
import { marketLiquidityMultiplier, calculateRealizableValue, calculateSilverPerCP, calculateSilverPerDay, calculateTheoreticalValue } from "../../calculations/profitability.js";
import { calculateOverallScore } from "../../calculations/score.js";
import { calculateExpectedYield } from "../../calculations/yield.js";
import { DEFAULT_LIQUIDITY_MULTIPLIER, DEFAULT_RANKING_WEIGHTS, DEFAULT_WORKER_PRESET_ID } from "../../shared/config.js";
import type { DataConfidence, MarketData, NodeRanking, ProductRankingBreakdown, WorkerNode, WorkerPreset } from "../../shared/models.js";
import { normalizeMetric } from "../../calculations/common.js";
import type { MarketProvider } from "../market/MarketProvider.js";
import { getWorkerPresets, JsonNodeRepository } from "../repositories/JsonRepository.js";

export class RankingService {
  constructor(private readonly marketProvider: MarketProvider, private readonly nodeRepository = new JsonNodeRepository()) {}

  async getRankings(): Promise<NodeRanking[]> {
    const nodes = await this.nodeRepository.getAll();
    const worker = (await getWorkerPresets()).find((preset) => preset.id === DEFAULT_WORKER_PRESET_ID);
    if (!worker) throw new Error("Benchmark worker preset missing");

    const itemIds = [...new Set(nodes.flatMap((node) => node.products.map((product) => product.itemId)).filter((id): id is number => typeof id === "number" && id > 0))];
    const marketByItem = new Map<number, MarketData>();
    await Promise.all(itemIds.map(async (itemId) => marketByItem.set(itemId, await this.marketProvider.getItemMarketData(itemId))));

    const partial = nodes.map((node) => this.calculateNodeRanking(node, worker, marketByItem));
    const maxSilver = Math.max(0, ...partial.map((ranking) => ranking.realizableSilverPerDay ?? 0));
    const maxSilverPerCp = Math.max(0, ...partial.map((ranking) => ranking.silverPerCp ?? 0));

    const scored = partial.map((ranking) => {
      if (ranking.realizableSilverPerDay == null || ranking.silverPerCp == null || ranking.confidence === "incomplete") return ranking;
      const score = calculateOverallScore({
        profitabilityScore: normalizeMetric(ranking.realizableSilverPerDay, maxSilver),
        silverPerCpScore: normalizeMetric(ranking.silverPerCp, maxSilverPerCp),
        demandScore: ranking.demandScore,
        liquidityScore: ranking.liquidityScore,
        weights: DEFAULT_RANKING_WEIGHTS
      });
      return { ...ranking, score };
    });

    const ranked = [...scored].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    let rank = 1;
    return ranked.map((entry) => (entry.score == null ? { ...entry, rank: null } : { ...entry, rank: rank++ }));
  }

  async getNodeRanking(id: number): Promise<NodeRanking | null> {
    const rankings = await this.getRankings();
    return rankings.find((ranking) => ranking.node.id === id) ?? null;
  }

  private calculateNodeRanking(node: WorkerNode, worker: WorkerPreset, marketByItem: Map<number, MarketData>): NodeRanking {
    const cycle = calculateCycleTime(node, worker);
    const cyclesPerDay = calculateCyclesPerDay(cycle.cycleTimeMinutes);
    const issues = [...cycle.issues];
    const products: ProductRankingBreakdown[] = node.products.map((product) => {
      const luckyOnly = product.averageYield == null && product.luckyYield != null;
      if (product.averageYield == null && !luckyOnly) issues.push(`Yield missing for ${product.itemName}`);
      const marketData = product.itemId != null ? marketByItem.get(product.itemId) : undefined;
      if ((!marketData || marketData.source === "unavailable") && !luckyOnly) issues.push(`Market data unavailable for ${product.itemName}`);
      const yieldPerDay = calculateExpectedYield(product.averageYield, cyclesPerDay);
      const theoreticalSilverPerDay = calculateTheoreticalValue(yieldPerDay, marketData?.currentPrice);
      const multiplier = marketLiquidityMultiplier(marketData, DEFAULT_LIQUIDITY_MULTIPLIER);
      const realizableSilverPerDay = calculateRealizableValue(theoreticalSilverPerDay, multiplier);
      return { itemId: product.itemId, itemName: product.itemName, averageYield: product.averageYield, luckyYield: product.luckyYield, yieldPerDay, theoreticalSilverPerDay, realizableSilverPerDay, marketData };
    });

    const theoreticalSilverPerDay = calculateSilverPerDay(products.map((product) => product.theoreticalSilverPerDay));
    const realizableSilverPerDay = calculateSilverPerDay(products.map((product) => product.realizableSilverPerDay));
    const silverPerCp = calculateSilverPerCP(realizableSilverPerDay, node.cpCost);
    const availableMarkets = products
      .filter((product) => product.averageYield != null)
      .map((product) => product.marketData)
      .filter((data): data is MarketData => Boolean(data));
    const demandScore = average(availableMarkets.map(calculateDemandScore));
    const liquidityScore = average(availableMarkets.map(calculateLiquidityScore));
    const confidence = confidenceFor(node, issues, availableMarkets);

    return {
      rank: null,
      node,
      cycleTimeMinutes: cycle.cycleTimeMinutes,
      cyclesPerDay,
      products,
      theoreticalSilverPerDay,
      realizableSilverPerDay,
      silverPerCp,
      demandScore,
      demandLabel: demandLabel(demandScore),
      liquidityScore,
      score: null,
      confidence,
      issues: [...new Set(issues)]
    };
  }
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidenceFor(node: WorkerNode, issues: string[], marketData: MarketData[]): DataConfidence {
  if (issues.some((issue) => issue.includes("Workload") || issue.includes("distance") || issue.includes("Yield missing") || issue.includes("Market data unavailable"))) return "incomplete";
  if (node.confidence === "estimated" || marketData.some((data) => data.source === "stale" || data.source === "manual")) return "estimated";
  return "high";
}
