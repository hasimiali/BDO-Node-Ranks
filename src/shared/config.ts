import type { RankingWeights } from "./models.js";

export const DEFAULT_WORKER_PRESET_ID = "artisan-goblin";

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  profitability: 0.4,
  silverPerCp: 0.3,
  demand: 0.2,
  liquidity: 0.1
};

export const DEFAULT_LIQUIDITY_MULTIPLIER = 0.82;

export const DEMAND_LABELS = [
  { min: 81, label: "Very High" },
  { min: 61, label: "High" },
  { min: 31, label: "Medium" },
  { min: 0, label: "Low" }
] as const;
