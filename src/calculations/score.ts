import type { RankingWeights } from "../shared/models.js";
import { clamp } from "./common.js";

export function calculateOverallScore(input: {
  profitabilityScore: number;
  silverPerCpScore: number;
  demandScore: number;
  liquidityScore: number;
  weights: RankingWeights;
}): number {
  const score =
    input.profitabilityScore * input.weights.profitability +
    input.silverPerCpScore * input.weights.silverPerCp +
    input.demandScore * input.weights.demand +
    input.liquidityScore * input.weights.liquidity;
  return clamp(score);
}
