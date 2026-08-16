import type { MarketData } from "../shared/models.js";
import { DEMAND_LABELS } from "../shared/config.js";
import { clamp, safeLogScore } from "./common.js";

export function calculateDemandScore(marketData?: MarketData): number {
  if (!marketData || marketData.source === "unavailable") return 0;
  const buyOrders = marketData.buyOrders ?? 0;
  const volumeScore = safeLogScore(marketData.transactionVolume ?? 0, 10);
  if (marketData.buyOrders == null) return clamp(volumeScore * 0.8 + safeLogScore(marketData.sellOrders, 5) * 0.2);
  const buyOrderScore = safeLogScore(buyOrders, 5);
  const imbalanceScore = clamp((buyOrders / (buyOrders + marketData.sellOrders + 1)) * 100);
  return clamp(buyOrderScore * 0.45 + volumeScore * 0.35 + imbalanceScore * 0.2);
}

export function demandLabel(score: number): string {
  return DEMAND_LABELS.find((entry) => score >= entry.min)?.label ?? "Low";
}
