import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import type { Item, MarketData, WorkerNode, WorkerPreset } from "../src/shared/models.js";

export const templatePath = path.resolve("bdo_node_optimizer_community_template_2026.xlsx");
export const dataDir = path.resolve("src/data");

export function readJson<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

export function writeJson(fileName: string, data: unknown): void {
  fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(data, null, 2));
}

export function nodesToRows(nodes: WorkerNode[]) {
  return nodes.map((node) => ({
    nodeId: node.id,
    region: node.region,
    nodeName: node.name,
    nodeType: node.type,
    productionCategory: node.productionCategory,
    cpCost: node.cpCost,
    mainNodeCp: "",
    subNodeCp: "",
    connectionCp: "",
    totalCp: node.cpCost,
    nearestTown: node.nearestTown ?? "",
    secondTown: "",
    distanceToNearestTown: node.distance ?? "",
    distanceToSecondTown: "",
    baseWorkload: node.baseWorkload ?? "",
    regionModifier: node.regionModifier ?? "",
    totalWorkload: node.workload ?? "",
    workloadSource: "",
    distanceSource: "",
    cpSource: node.source,
    confidence: node.confidence,
    notes: node.notes ?? ""
  }));
}

export function productsToRows(nodes: WorkerNode[]) {
  return nodes.flatMap((node) => node.products.map((product, index) => ({
    nodeId: node.id,
    nodeName: node.name,
    region: node.region,
    productSlot: index + 1,
    itemId: product.itemId && product.itemId > 0 ? product.itemId : "",
    itemName: product.itemName,
    isPrimary: product.isPrimary ? "TRUE" : "FALSE",
    yieldPer100CyclesMin: product.yieldPer100CyclesMin ?? "",
    yieldPer100CyclesMax: product.yieldPer100CyclesMax ?? "",
    averageYieldPerCycle: product.averageYield ?? "",
    yieldSource: product.source ?? "",
    yieldConfidence: product.confidence,
    notes: ""
  })));
}

export function itemsToRows(items: Item[]) {
  return items.map((item) => ({
    itemId: item.id > 0 ? item.id : "",
    itemName: item.name,
    category: item.category,
    marketCategory: item.marketCategory ?? "",
    marketSubCategory: item.marketSubCategory ?? "",
    icon: item.icon ?? "",
    tradeable: "",
    source: item.source,
    confidence: item.confidence,
    notes: item.id < 0 ? "Temporary ID from workbook import. Replace with real BDO item ID." : ""
  }));
}

export function marketToRows(rows: MarketData[]) {
  return rows.map((row) => ({
    region: "asia",
    server: "asia",
    itemId: row.itemId,
    itemName: "",
    currentPrice: row.currentPrice,
    minPrice: row.minPrice ?? "",
    maxPrice: row.maxPrice ?? "",
    buyOrders: row.buyOrders,
    sellOrders: row.sellOrders,
    transactionVolume: row.transactionVolume ?? "",
    updatedAt: row.updatedAt,
    sourceUrl: "",
    sourceType: row.source,
    confidence: row.source === "manual" ? "estimated" : "incomplete",
    notes: row.message ?? ""
  }));
}

export function workersToRows(presets: WorkerPreset[]) {
  return presets.map((preset) => ({
    presetId: preset.id,
    name: preset.name,
    workSpeed: preset.workSpeed,
    movementSpeed: preset.movementSpeed,
    luck: preset.luck,
    endurance: preset.endurance,
    isBenchmark: preset.id === "artisan-goblin" ? "TRUE" : "FALSE",
    source: "worker-presets.json",
    notes: preset.id === "artisan-goblin" ? "Global MVP benchmark worker." : ""
  }));
}

export function addSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!autofilter"] = { ref: sheet["!ref"] ?? "A1:A1" };
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function readSheet(workbook: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function numberOrNull(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}
