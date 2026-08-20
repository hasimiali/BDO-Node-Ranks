import type { CraftRecipe, Item, MarketData, WorkerNode, WorkerPreset } from "./models.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  entity: "node" | "product" | "item" | "market" | "worker";
  id?: string | number;
  field: string;
  message: string;
}

export interface ValidationSummary {
  nodes: number;
  products: number;
  items: number;
  marketRows: number;
  rankableNodes: number;
  missingItemIds: number;
  missingWorkload: number;
  missingDistance: number;
  missingMarket: number;
  issues: ValidationIssue[];
}

export interface DataBundle {
  nodes: WorkerNode[];
  items: Item[];
  manualMarket: MarketData[];
  workerPresets: WorkerPreset[];
  recipes?: CraftRecipe[];
}

const allowedNodeTypes = new Set(["Excavation", "Mining", "Logging", "Gathering", "Farming", "Fishing", "Other"]);

export function validateDataBundle(bundle: DataBundle): ValidationSummary {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<number>();
  const itemIds = new Set(bundle.items.map((item) => item.id));
  const marketIds = new Set(bundle.manualMarket.map((row) => row.itemId));
  let products = 0;
  let missingItemIds = 0;
  let missingWorkload = 0;
  let missingDistance = 0;
  let missingMarket = 0;
  let rankableNodes = 0;

  for (const node of bundle.nodes) {
    if (!node.id || node.id <= 0) push(issues, "error", "node", node.name, "nodeId", "Node ID must be positive.");
    if (nodeIds.has(node.id)) push(issues, "error", "node", node.id, "nodeId", "Node ID is duplicated.");
    nodeIds.add(node.id);
    if (!node.name.trim()) push(issues, "error", "node", node.id, "nodeName", "Node name is required.");
    if (!node.region.trim()) push(issues, "error", "node", node.id, "region", "Region is required.");
    if (!allowedNodeTypes.has(node.type)) push(issues, "error", "node", node.id, "nodeType", "Node type is invalid.");
    if (!Number.isFinite(node.cpCost) || node.cpCost <= 0) push(issues, "error", "node", node.id, "cpCost", "CP cost must be greater than zero.");
    if (node.workload == null || node.workload <= 0) {
      missingWorkload++;
      push(issues, "warning", "node", node.id, "workload", "Workload missing; cycle time cannot be calculated.");
    }
    if (node.distance == null || node.distance < 0) {
      missingDistance++;
      push(issues, "warning", "node", node.id, "distance", "Worker travel distance missing; cycle time cannot be calculated.");
    }

    let hasMarket = false;
    let hasYield = true;
    for (const product of node.products) {
      products++;
      if (product.itemId == null || product.itemId <= 0) {
        missingItemIds++;
        push(issues, "warning", "product", `${node.id}:${product.itemName}`, "itemId", "Product item ID missing; market data cannot join.");
      } else {
        if (!itemIds.has(product.itemId)) push(issues, "warning", "product", `${node.id}:${product.itemId}`, "itemId", "Product item ID not found in Items sheet.");
        if (marketIds.has(product.itemId)) hasMarket = true;
      }
      if (product.averageYield == null || product.averageYield <= 0) {
        hasYield = false;
        push(issues, "warning", "product", `${node.id}:${product.itemName}`, "averageYieldPerCycle", "Average yield missing or zero.");
      }
    }
    if (!hasMarket) missingMarket++;
    if (node.workload != null && node.workload > 0 && node.distance != null && node.distance >= 0 && hasYield && hasMarket) rankableNodes++;
  }

  for (const item of bundle.items) {
    if (!item.id || item.id === 0) push(issues, "error", "item", item.name, "itemId", "Item ID is required.");
    if (!item.name.trim()) push(issues, "error", "item", item.id, "itemName", "Item name is required.");
  }

  for (const row of bundle.manualMarket) {
    if (!row.itemId || row.itemId <= 0) push(issues, "error", "market", row.itemId, "itemId", "Market item ID must be positive.");
    if (!Number.isFinite(row.currentPrice) || row.currentPrice <= 0) push(issues, "error", "market", row.itemId, "currentPrice", "Current price must be greater than zero.");
    if ((row.buyOrders ?? 0) < 0 || row.sellOrders < 0) push(issues, "error", "market", row.itemId, "orders", "Order counts cannot be negative.");
  }

  for (const preset of bundle.workerPresets) {
    if (!preset.id.trim()) push(issues, "error", "worker", preset.name, "presetId", "Preset ID is required.");
    if (preset.workSpeed <= 0) push(issues, "error", "worker", preset.id, "workSpeed", "Work speed must be positive.");
    if (preset.movementSpeed <= 0) push(issues, "error", "worker", preset.id, "movementSpeed", "Movement speed must be positive.");
  }

  const recipeIds = new Set<string>();
  for (const recipe of bundle.recipes ?? []) {
    if (!recipe.id || recipeIds.has(recipe.id)) push(issues, "error", "item", recipe.id || recipe.name, "recipeId", "Recipe ID is missing or duplicated.");
    recipeIds.add(recipe.id);
    if (!recipe.output?.itemId) push(issues, "error", "item", recipe.id, "outputItemId", "Recipe output item ID is required.");
    if (!recipe.source?.url || !recipe.source.importedAt) push(issues, "warning", "item", recipe.id, "source", "Recipe source metadata is incomplete.");
    for (const group of recipe.ingredients ?? []) {
      if (!(group.quantity > 0)) push(issues, "error", "item", recipe.id, "ingredientQuantity", "Recipe ingredient quantity must be positive.");
      if (!group.alternatives.length) push(issues, "error", "item", recipe.id, "ingredientAlternatives", "Recipe ingredient group needs at least one alternative.");
    }
  }

  return {
    nodes: bundle.nodes.length,
    products,
    items: bundle.items.length,
    marketRows: bundle.manualMarket.length,
    rankableNodes,
    missingItemIds,
    missingWorkload,
    missingDistance,
    missingMarket,
    issues
  };
}

function push(issues: ValidationIssue[], severity: ValidationSeverity, entity: ValidationIssue["entity"], id: string | number | undefined, field: string, message: string) {
  issues.push({ severity, entity, id, field, message });
}
