import XLSX from "xlsx";
import type { DataConfidence, Item, MarketData, NodeProduct, NodeType, WorkerNode, WorkerPreset } from "../src/shared/models.js";
import { numberOrNull, readSheet, stringValue, templatePath, writeJson } from "./communityWorkbook.js";

const workbook = XLSX.readFile(templatePath);
const nodeRows = readSheet(workbook, "Nodes");
const productRows = readSheet(workbook, "Products");
const itemRows = readSheet(workbook, "Items");
const marketRows = readSheet(workbook, "Market_Manual");
const workerRows = readSheet(workbook, "Worker_Presets");

const itemIdByName = new Map<string, number>();
let nextTempItemId = -1;
const items: Item[] = itemRows.map((row) => {
  const name = stringValue(row.itemName);
  const id = Number(row.itemId || nextTempItemId--);
  if (name) itemIdByName.set(name.toLowerCase(), id);
  return {
    id,
    name,
    category: stringValue(row.category) || "Unknown",
    marketCategory: stringValue(row.marketCategory) || undefined,
    marketSubCategory: stringValue(row.marketSubCategory) || undefined,
    icon: stringValue(row.icon) || undefined,
    source: stringValue(row.source) || "community-template",
    confidence: confidence(row.confidence)
  };
}).filter((item) => item.name);

const productsByNode = new Map<number, NodeProduct[]>();
for (const row of productRows) {
  const nodeId = Number(row.nodeId);
  if (!Number.isFinite(nodeId)) continue;
  const itemName = stringValue(row.itemName);
  const itemId = numberOrNull(row.itemId) ?? itemIdByName.get(itemName.toLowerCase()) ?? null;
  const product: NodeProduct = {
    itemId,
    itemName,
    isPrimary: stringValue(row.isPrimary).toLowerCase() !== "false",
    yieldPer100CyclesMin: numberOrNull(row.yieldPer100CyclesMin),
    yieldPer100CyclesMax: numberOrNull(row.yieldPer100CyclesMax),
    averageYield: numberOrNull(row.averageYieldPerCycle),
    source: stringValue(row.yieldSource),
    confidence: confidence(row.yieldConfidence)
  };
  productsByNode.set(nodeId, [...(productsByNode.get(nodeId) ?? []), product]);
}

const nodes: WorkerNode[] = nodeRows.map((row, index) => {
  const nodeId = Number(row.nodeId || index + 1);
  const totalWorkload = numberOrNull(row.totalWorkload);
  const baseWorkload = numberOrNull(row.baseWorkload);
  const regionModifier = numberOrNull(row.regionModifier);
  const computedWorkload = totalWorkload ?? (baseWorkload != null && regionModifier != null ? baseWorkload * ((200 - regionModifier) / 100) : null);
  return {
    id: nodeId,
    region: stringValue(row.region),
    name: stringValue(row.nodeName),
    type: nodeType(row.nodeType),
    productionCategory: stringValue(row.productionCategory),
    cpCost: Number(row.totalCp || row.cpCost || 0),
    baseWorkload,
    regionModifier,
    workload: computedWorkload,
    distance: numberOrNull(row.distanceToNearestTown),
    nearestTown: stringValue(row.nearestTown),
    products: productsByNode.get(nodeId) ?? [],
    source: "bdo_node_optimizer_community_template_2026.xlsx",
    confidence: confidence(row.confidence),
    notes: stringValue(row.notes)
  };
});

const manualMarket: MarketData[] = marketRows.map((row) => ({
  itemId: Number(row.itemId || 0),
  currentPrice: Number(row.currentPrice || 0),
  minPrice: numberOrNull(row.minPrice) ?? undefined,
  maxPrice: numberOrNull(row.maxPrice) ?? undefined,
  buyOrders: Number(row.buyOrders || 0),
  sellOrders: Number(row.sellOrders || 0),
  transactionVolume: numberOrNull(row.transactionVolume) ?? undefined,
  updatedAt: stringValue(row.updatedAt) || new Date().toISOString(),
  source: "manual" as const
})).filter((row) => row.itemId > 0 && row.currentPrice > 0);

const workerPresets: WorkerPreset[] = workerRows.map((row) => ({
  id: stringValue(row.presetId),
  name: stringValue(row.name),
  workSpeed: Number(row.workSpeed || 0),
  movementSpeed: Number(row.movementSpeed || 0),
  luck: Number(row.luck || 0),
  endurance: Number(row.endurance || 0)
})).filter((row) => row.id && row.name);

writeJson("nodes.json", nodes);
writeJson("items.json", items);
writeJson("manual-market.json", manualMarket);
writeJson("worker-presets.json", workerPresets);
console.log(`Imported ${nodes.length} nodes, ${items.length} items, ${manualMarket.length} market rows, ${workerPresets.length} worker presets.`);

function confidence(value: unknown): DataConfidence {
  const text = stringValue(value);
  if (text === "high" || text === "estimated" || text === "incomplete" || text === "mock") return text;
  return "estimated";
}

function nodeType(value: unknown): NodeType {
  const text = stringValue(value);
  if (text === "Excavation" || text === "Mining" || text === "Logging" || text === "Gathering" || text === "Farming" || text === "Fishing" || text === "Other") return text;
  return "Other";
}
