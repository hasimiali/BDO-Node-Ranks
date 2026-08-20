export type NodeType =
  | "Excavation"
  | "Mining"
  | "Logging"
  | "Gathering"
  | "Farming"
  | "Fishing"
  | "Other";

export type DataConfidence = "high" | "estimated" | "incomplete" | "mock";

export type MarketSource =
  "real" | "cached" | "stale" | "mock" | "unavailable" | "manual";

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
  parentNode?: {
    id: number;
    name: string;
    kind: number;
    cpCost: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
  };
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

export interface MapNetworkNode {
  id: number;
  name: string;
  kind: number;
  cpCost: number;
  isMain: boolean;
  isPlantzone: boolean;
  isTown: boolean;
  position: {
    x: number;
    z: number;
  };
}

export interface MapNetworkEdge {
  sourceId: number;
  targetId: number;
}

export interface MapNetwork {
  nodes: MapNetworkNode[];
  edges: MapNetworkEdge[];
  source: string;
  importedAt: string;
}

export type LifeSkill = "cooking" | "alchemy" | "processing";

export interface RecipeOutput {
  itemId: number;
  itemName: string;
  quantity: number;
  kind?: "normal" | "rare" | "byproduct";
}

export interface RecipeIngredient {
  itemId: number;
  itemName: string;
  equivalence?: number;
  vendorPrice?: number;
}

export interface RecipeIngredientGroup {
  quantity: number;
  alternatives: RecipeIngredient[];
}

export interface CraftRecipe {
  id: string;
  name: string;
  lifeSkill: LifeSkill;
  method: string;
  output: RecipeOutput;
  extraOutputs: RecipeOutput[];
  ingredients: RecipeIngredientGroup[];
  baseCraftSeconds?: number;
  source: { provider: string; url: string; importedAt: string };
  confidence: DataConfidence;
}

export interface CraftAssumptions {
  mastery: Record<LifeSkill, number>;
  craftSeconds: Record<LifeSkill, number>;
  saleMultiplier: number;
  batchSize: number;
  recursiveCrafting: boolean;
  maxCraftDepth: number;
  normalYield: Record<LifeSkill, number>;
  rareYield: Record<LifeSkill, number>;
}

export interface IngredientCostChoice {
  itemId: number;
  itemName: string;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  source: "market" | "vendor" | "craft" | "unavailable";
  recipeId?: string;
  marketPrice: number | null;
  marketTotalCost: number | null;
  listedStock: number | null;
  marketStockCoverage: number | null;
  marketHasEnoughStock: boolean | null;
  buyOrders: number | null;
  averageDailySales: number | null;
  fourteenDaySales: number | null;
  stockCoverage: number | null;
  hasEnoughStock: boolean | null;
  marketSource: MarketSource;
  marketUpdatedAt: string | null;
  vendorPrice: number | null;
  craftUnitCost: number | null;
  craftTotalCost: number | null;
  craftRecipeId?: string;
  craftRequirementsAvailable: boolean | null;
  craftResult?: CraftProfitResult;
  alternatives: IngredientAlternativeQuote[];
}

export interface IngredientAlternativeQuote {
  itemId: number;
  itemName: string;
  quantity: number;
  equivalence: number;
  selected: boolean;
  selectedSource: "market" | "vendor" | "craft" | "unavailable";
  selectedUnitCost: number | null;
  selectedTotalCost: number | null;
  marketPrice: number | null;
  marketTotalCost: number | null;
  listedStock: number | null;
  marketStockCoverage: number | null;
  marketHasEnoughStock: boolean | null;
  buyOrders: number | null;
  averageDailySales: number | null;
  fourteenDaySales: number | null;
  stockCoverage: number | null;
  hasEnoughStock: boolean | null;
  marketSource: MarketSource;
  marketUpdatedAt: string | null;
  vendorPrice: number | null;
  craftUnitCost: number | null;
  craftTotalCost: number | null;
  craftRecipeId?: string;
  craftRequirementsAvailable: boolean | null;
  craftResult?: CraftProfitResult;
}

export interface CraftProfitResult {
  recipe: CraftRecipe;
  craftCount: number;
  expectedOutputQuantity: number;
  materialCost: number | null;
  grossRevenue: number | null;
  netRevenue: number | null;
  profitPerBatch: number | null;
  profitPerHour: number | null;
  realizableProfitPerHour: number | null;
  marginPercent: number | null;
  demandScore: number;
  liquidityScore: number;
  outputPrice: number | null;
  outputSellOrders: number | null;
  outputBuyOrders: number | null;
  averageDailySales: number | null;
  fourteenDaySales: number | null;
  stockToDailySales: number | null;
  estimatedDaysToSellBatch: number | null;
  marketUpdatedAt: string | null;
  marketSource: MarketSource;
  requirementsAvailable: boolean | null;
  requirementStockCoverage: number | null;
  insufficientRequirementCount: number;
  unavailableRequirementCount: number;
  bottleneckRequirement: {
    itemId: number;
    itemName: string;
    requiredQuantity: number;
    listedStock: number;
    coverage: number;
  } | null;
  priceCoverage: number;
  ingredients: IngredientCostChoice[];
  issues: string[];
}
