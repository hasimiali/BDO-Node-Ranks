export type NodeType = "Excavation" | "Mining" | "Logging" | "Gathering" | "Farming" | "Fishing" | "Other";

export type DataConfidence = "high" | "estimated" | "incomplete" | "mock";

export type MarketSource = "real" | "cached" | "stale" | "mock" | "unavailable" | "manual";

export interface NodeProduct {
  itemId: number | null;
  itemName: string;
  averageYield: number | null;
  luckyYield?: number | null;
  giantYield?: number | null;
  yieldPer100CyclesMin?: number | null;
  yieldPer100CyclesMax?: number | null;
  isPrimary: boolean;
  source?: string;
  confidence: DataConfidence;
}

export interface WorkerNode {
  id: number;
  name: string;
  region: string;
  type: NodeType;
  productionCategory: string;
  cpCost: number;
  workload: number | null;
  baseWorkload?: number | null;
  regionModifier?: number | null;
  distance: number | null;
  nearestTown?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  parentNodeId?: number;
  productionNodeId?: number;
  regionGroup?: number;
  workerSpecies?: number[];
  products: NodeProduct[];
  source: string;
  confidence: DataConfidence;
  notes?: string;
}

export interface Item {
  id: number;
  name: string;
  category: string;
  icon?: string;
  marketCategory?: string;
  marketSubCategory?: string;
  source: string;
  confidence: DataConfidence;
}

export interface WorkerPreset {
  id: string;
  name: string;
  workSpeed: number;
  movementSpeed: number;
  luck: number;
  endurance: number;
}

export interface MarketData {
  itemId: number;
  currentPrice: number;
  minPrice?: number;
  maxPrice?: number;
  buyOrders?: number;
  sellOrders: number;
  transactionVolume?: number;
  fourteenDayVolume?: number;
  averageDailyVolume?: number;
  totalTrades?: number;
  updatedAt: string;
  source: MarketSource;
  stale?: boolean;
  message?: string;
}

export interface RankingWeights {
  profitability: number;
  silverPerCp: number;
  demand: number;
  liquidity: number;
}

export interface ProductRankingBreakdown {
  itemId: number | null;
  itemName: string;
  averageYield: number | null;
  luckyYield?: number | null;
  yieldPerDay: number | null;
  theoreticalSilverPerDay: number | null;
  realizableSilverPerDay: number | null;
  marketData?: MarketData;
}

export interface NodeRanking {
  rank: number | null;
  node: WorkerNode;
  cycleTimeMinutes: number | null;
  cyclesPerDay: number | null;
  products: ProductRankingBreakdown[];
  theoreticalSilverPerDay: number | null;
  realizableSilverPerDay: number | null;
  silverPerCp: number | null;
  demandScore: number;
  demandLabel: string;
  liquidityScore: number;
  score: number | null;
  confidence: DataConfidence;
  issues: string[];
}

export interface MarketStatus {
  provider: string;
  region: string;
  available: boolean;
  updatedAt: string;
  message?: string;
}
