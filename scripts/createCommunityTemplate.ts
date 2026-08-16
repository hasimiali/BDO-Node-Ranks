import XLSX from "xlsx";
import { addSheet, dataDir, itemsToRows, marketToRows, nodesToRows, productsToRows, readJson, templatePath, workersToRows } from "./communityWorkbook.js";
import type { Item, MarketData, WorkerNode, WorkerPreset } from "../src/shared/models.js";

const nodes = readJson<WorkerNode[]>("nodes.json");
const items = readJson<Item[]>("items.json");
const market = readJson<MarketData[]>("manual-market.json");
const workers = readJson<WorkerPreset[]>("worker-presets.json");

const workbook = XLSX.utils.book_new();
addSheet(workbook, "Nodes", nodesToRows(nodes));
addSheet(workbook, "Products", productsToRows(nodes));
addSheet(workbook, "Items", itemsToRows(items));
addSheet(workbook, "Market_Manual", marketToRows(market));
addSheet(workbook, "Worker_Presets", workersToRows(workers));
addSheet(workbook, "Data_Dictionary", [
  { field: "nodeId", sheet: "Nodes/Products", required: "yes", description: "Stable numeric node ID. Use extractor/community ID if known." },
  { field: "itemId", sheet: "Products/Items/Market_Manual", required: "yes for market", description: "BDO item ID used by market API/provider." },
  { field: "totalWorkload", sheet: "Nodes", required: "yes for cycle", description: "Node workload after modifier. Used as workload when present." },
  { field: "distanceToNearestTown", sheet: "Nodes", required: "yes for cycle", description: "Worker round-trip formula uses this one-way distance." },
  { field: "averageYieldPerCycle", sheet: "Products", required: "yes for yield", description: "Expected item yield per worker cycle." },
  { field: "currentPrice", sheet: "Market_Manual", required: "yes for manual market", description: "Current Central Market price for the item." }
]);
addSheet(workbook, "Source_Notes", [
  { source: "bdo_complete_all_nodes_master_2026.xlsx", use: "node/product/yield seed", confidence: "estimated", notes: "Community seed file." },
  { source: "bdo-data-extractor", use: "item IDs, node IDs, client node products", confidence: "client-sourced", notes: "Run locally against legal BDO install." },
  { source: "Arsha", use: "market provider", confidence: "unofficial", notes: "Server-side provider only." },
  { source: "Manual Asia market", use: "market fallback", confidence: "manual", notes: "Community maintained." }
]);
addSheet(workbook, "Validation_Lists", [
  { list: "nodeType", value: "Excavation" },
  { list: "nodeType", value: "Mining" },
  { list: "nodeType", value: "Logging" },
  { list: "nodeType", value: "Gathering" },
  { list: "nodeType", value: "Farming" },
  { list: "nodeType", value: "Fishing" },
  { list: "nodeType", value: "Other" },
  { list: "confidence", value: "high" },
  { list: "confidence", value: "estimated" },
  { list: "confidence", value: "incomplete" },
  { list: "confidence", value: "mock" }
]);

XLSX.writeFile(workbook, templatePath);
console.log(`Created ${templatePath} from ${dataDir}.`);
