import type { MarketData } from "../shared/models.js";
import { clamp, safeLogScore } from "./common.js";

export function calculateLiquidityScore(marketData?: MarketData): number {
  if (!marketData || marketData.source === "unavailable") return 0;
  const buyOrders = marketData.buyOrders ?? 0;
  const buyOrderScore = safeLogScore(buyOrders, 5);
  const volumeScore = safeLogScore(marketData.transactionVolume ?? 0, 10);
  const totalOrders = buyOrders + marketData.sellOrders;
  const orderActivityScore = safeLogScore(totalOrders, 5);
  const sellPressurePenalty = marketData.buyOrders == null ? 0 : marketData.sellOrders > buyOrders * 5 && buyOrders < 100 ? 25 : 0;
  return clamp(volumeScore * 0.5 + buyOrderScore * 0.3 + orderActivityScore * 0.2 - sellPressurePenalty);
}
