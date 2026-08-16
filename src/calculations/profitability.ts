import type { MarketData } from "../shared/models.js";

export function calculateTheoreticalValue(expectedYieldPerDay: number | null, currentPrice: number | null | undefined): number | null {
  if (expectedYieldPerDay == null || currentPrice == null || currentPrice <= 0) return null;
  return expectedYieldPerDay * currentPrice;
}

export function calculateRealizableValue(theoreticalValue: number | null, liquidityMultiplier: number): number | null {
  if (theoreticalValue == null) return null;
  return theoreticalValue * Math.max(0, Math.min(1, liquidityMultiplier));
}

export function calculateSilverPerDay(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (available.length === 0) return null;
  return available.reduce((sum, value) => sum + value, 0);
}

export function calculateSilverPerCP(silverPerDay: number | null, cpCost: number): number | null {
  if (silverPerDay == null || cpCost <= 0) return null;
  return silverPerDay / cpCost;
}

export function marketLiquidityMultiplier(marketData: MarketData | undefined, defaultMultiplier: number): number {
  if (!marketData || marketData.source === "unavailable") return 0;
  if ((marketData.buyOrders ?? 0) <= 0 && (marketData.transactionVolume ?? 0) <= 0) return Math.min(defaultMultiplier, 0.35);
  return defaultMultiplier;
}
