import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import type { Item, NodeProduct, NodeType, WorkerNode } from "../src/shared/models.js";

const workbookPath = path.resolve("bdo_complete_all_nodes_master_2026.xlsx");
const dataDir = path.resolve("src/data");

function parseRange(value: unknown): { min: number | null; max: number | null; average: number | null } {
  if (value == null) return { min: null, max: null, average: null };
  const text = String(value).trim();
  if (!text || text === "0") return { min: 0, max: 0, average: 0 };
  const match = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return { min: null, max: null, average: null };
  const min = Number(match[1]);
  const max = Number(match[2]);
  return { min, max, average: (min + max) / 2 / 100 };
}

function categoryToNodeType(category: string): NodeType {
  switch (category) {
    case "Excavation":
      return "Excavation";
    case "Ore/Mineral":
      return "Mining";
    case "Timber":
      return "Logging";
    case "Cereal/Grain":
    case "Vegetable/Fruit":
      return "Farming";
    case "Dried Fish":
      return "Fishing";
    case "Specialty/Textile":
      return "Gathering";
    default:
      return "Other";
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Missing workbook: ${workbookPath}`);
}

const workbook = XLSX.readFile(workbookPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

const nodeByKey = new Map<string, WorkerNode>();
const itemByName = new Map<string, Item>();
let nextNodeId = 1;
let nextItemId = -1;

function getItem(name: string): Item | null {
  const itemName = normalizeName(name);
  if (!itemName || itemName === "None") return null;
  const key = itemName.toLowerCase();
  const existing = itemByName.get(key);
  if (existing) return existing;
  const item: Item = {
    id: nextItemId--,
    name: itemName,
    category: "Unknown",
    source: "bdo_complete_all_nodes_master_2026.xlsx",
    confidence: "estimated"
  };
  itemByName.set(key, item);
  return item;
}

for (const row of rows) {
  const region = normalizeName(String(row["Region/Continent"]));
  const name = normalizeName(String(row["Specific Node Name"]));
  const productionCategory = normalizeName(String(row["Node Production Category"]));
  const cpCost = Number(row["Contribution Point Cost (CP)"] || 0);
  if (!region || !name || !productionCategory) continue;

  const key = `${region}::${name}::${productionCategory}`.toLowerCase();
  let node = nodeByKey.get(key);
  if (!node) {
    node = {
      id: nextNodeId++,
      name,
      region,
      type: categoryToNodeType(productionCategory),
      productionCategory,
      cpCost,
      workload: null,
      distance: null,
      products: [],
      source: "bdo_complete_all_nodes_master_2026.xlsx",
      confidence: "estimated",
      notes: "Community seed workbook. Workload, item IDs, and travel distance need verification."
    };
    nodeByKey.set(key, node);
  }

  const primaryItem = getItem(String(row["Primary Material Yield"]));
  if (primaryItem) {
    const range = parseRange(row["Nominal Yield (Per 100 Cycles)"]);
    const product: NodeProduct = {
      itemId: primaryItem.id,
      itemName: primaryItem.name,
      averageYield: range.average,
      yieldPer100CyclesMin: range.min,
      yieldPer100CyclesMax: range.max,
      isPrimary: true,
      source: "bdo_complete_all_nodes_master_2026.xlsx",
      confidence: range.average == null ? "incomplete" : "estimated"
    };
    node.products.push(product);
  }

  const secondaryItem = getItem(String(row["Secondary/Rare Material Yield"]));
  if (secondaryItem) {
    const range = parseRange(row["Secondary Nominal Yield (Per 100 Cycles)"]);
    if ((range.average ?? 0) > 0) {
      const product: NodeProduct = {
        itemId: secondaryItem.id,
        itemName: secondaryItem.name,
        averageYield: range.average,
        yieldPer100CyclesMin: range.min,
        yieldPer100CyclesMax: range.max,
        isPrimary: false,
        source: "bdo_complete_all_nodes_master_2026.xlsx",
        confidence: range.average == null ? "incomplete" : "estimated"
      };
      node.products.push(product);
    }
  }
}

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "nodes.json"), JSON.stringify([...nodeByKey.values()], null, 2));
fs.writeFileSync(path.join(dataDir, "items.json"), JSON.stringify([...itemByName.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2));
console.log(`Imported ${nodeByKey.size} nodes and ${itemByName.size} items from ${path.basename(workbookPath)}.`);
