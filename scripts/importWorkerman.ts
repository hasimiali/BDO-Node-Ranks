import fs from "node:fs";
import path from "node:path";
import type { Item, MapNetwork, NodeProduct, NodeType, WorkerNode } from "../src/shared/models.js";

const baseUrl = "https://shrddr.github.io/workerman/data";
const source = "shrddr-workerman";
const sourceUrls = {
  drops: `${baseUrl}/manual/plantzone_drops.json`,
  plantzone: `${baseUrl}/plantzone.json`,
  exploration: `${baseUrl}/exploration.json`,
  deckIcons: `${baseUrl}/deck_icons.json`,
  deckIconPositions: `${baseUrl}/deck_icon_positions.json`,
  deckLinks: `${baseUrl}/deck_links.json`,
  distances: `${baseUrl}/distances_pzk2tk.json`,
  loc: `${baseUrl}/loc.json`,
  itemInfo: `${baseUrl}/item_info.json`
};
const dataDir = path.resolve("src/data");

interface WorkermanDrops {
  workload?: number;
  unlucky?: Record<string, number>;
  lucky?: Record<string, number>;
  unlucky_gi?: Record<string, number>;
}

interface WorkermanPlantzone {
  key: number;
  node?: { key?: number; kind?: number; CP?: number; pos?: { x: number; y: number; z: number } };
  peg?: { subgroup?: { drops?: number[] } };
  regiongroup?: number;
  parent?: number;
  species?: number[];
}

interface WorkermanExplorationNode {
  key: number;
  pos: { x: number; y: number; z: number };
  kind: number;
  CP: number;
  name?: string;
  is_main?: number;
  is_plantzone?: boolean;
  is_planttown?: boolean;
}

interface WorkermanItemInfo {
  key?: number;
  icon?: string;
  itemType?: number;
  grade?: number;
}

interface WorkermanLoc {
  en?: {
    item?: Record<string, string>;
    node?: Record<string, string>;
    town?: Record<string, string>;
  };
}

interface YieldRow {
  productionNodeId: number;
  itemId: number;
  normalYield: number | null;
  luckyYield: number | null;
  giantYield: number | null;
  source: string;
  sourceUrl: string;
  confidence: "estimated";
}

interface DistanceRow {
  productionNodeId: number;
  nearestTownId: number | null;
  nearestTownName: string;
  distance: number | null;
  source: string;
  sourceUrl: string;
  confidence: "estimated";
}

const [drops, plantzones, exploration, deckIcons, deckIconPositions, deckLinks, distances, loc, itemInfo] = await Promise.all([
  fetchJson<Record<string, WorkermanDrops>>(sourceUrls.drops),
  fetchJson<Record<string, WorkermanPlantzone>>(sourceUrls.plantzone),
  fetchJson<Record<string, WorkermanExplorationNode>>(sourceUrls.exploration),
  fetchJson<Array<[number, number]>>(sourceUrls.deckIcons),
  fetchJson<Record<string, [number, number]>>(sourceUrls.deckIconPositions),
  fetchJson<Array<[number, number]>>(sourceUrls.deckLinks),
  fetchJson<Record<string, [number, number][]>>(sourceUrls.distances),
  fetchJson<WorkermanLoc>(sourceUrls.loc),
  fetchJson<Record<string, WorkermanItemInfo>>(sourceUrls.itemInfo)
]);

const itemNames = loc.en?.item ?? {};
const nodeNames = loc.en?.node ?? {};
const townNames = loc.en?.town ?? {};
const itemIds = new Set<number>();
const yieldRows: YieldRow[] = [];
const distanceRows: DistanceRow[] = [];

const nodes: WorkerNode[] = Object.entries(drops).map(([nodeIdText, dropData]) => {
  const productionNodeId = Number(nodeIdText);
  const plantzone = plantzones[nodeIdText];
  const parentNodeId = plantzone?.parent;
  const parent = parentNodeId == null ? undefined : exploration[String(parentNodeId)];
  const nearest = nearestTown(distances[nodeIdText] ?? []);
  const products = productsFrom(dropData, productionNodeId, itemIds, yieldRows);
  const parentName = parentNodeId == null ? "" : nodeNames[String(parentNodeId)] ?? `Node ${parentNodeId}`;
  const productionName = nodeNames[nodeIdText] ?? `Production ${productionNodeId}`;

  distanceRows.push({
    productionNodeId,
    nearestTownId: nearest?.townId ?? null,
    nearestTownName: nearest ? townNames[String(nearest.townId)] ?? `Town ${nearest.townId}` : "",
    distance: nearest?.distance ?? null,
    source,
    sourceUrl: sourceUrls.distances,
    confidence: "estimated"
  });

  return {
    id: productionNodeId,
    productionNodeId,
    parentNodeId,
    parentNode: parentNodeId != null && parent ? {
      id: parentNodeId,
      name: nodeNames[String(parentNodeId)] ?? parent.name ?? `Node ${parentNodeId}`,
      kind: parent.kind,
      cpCost: Number(parent.CP ?? 0),
      position: parent.pos,
    } : undefined,
    regionGroup: plantzone?.regiongroup,
    workerSpecies: plantzone?.species,
    region: plantzone?.regiongroup == null ? "Unknown" : `Region Group ${plantzone.regiongroup}`,
    name: parentName ? `${parentName} ${productionName}` : productionName,
    type: nodeType(plantzone?.node?.kind),
    productionCategory: productionName,
    cpCost: Number(plantzone?.node?.CP ?? 0),
    baseWorkload: dropData.workload ?? null,
    regionModifier: 0,
    workload: dropData.workload == null ? null : dropData.workload * 2,
    distance: nearest?.distance ?? null,
    nearestTown: nearest ? townNames[String(nearest.townId)] ?? `Town ${nearest.townId}` : "",
    position: plantzone?.node?.pos,
    products,
    source,
    confidence: "estimated",
    notes: `Imported from Workerman. Ranking workload uses resource percentage 0%, so base workload is doubled. Source: ${sourceUrls.drops}`
  } satisfies WorkerNode;
}).sort((a, b) => a.id - b.id);

for (const id of itemIds) {
  if (!itemNames[String(id)] && !itemInfo[String(id)]) itemIds.delete(id);
}

const items: Item[] = [...itemIds].sort((a, b) => a - b).map((id) => ({
  id,
  name: itemNames[String(id)] ?? `Item ${id}`,
  category: itemCategory(itemInfo[String(id)]?.itemType),
  icon: itemInfo[String(id)]?.icon,
  source,
  confidence: "estimated"
}));

writeJson("nodes.json", nodes);
writeJson("items.json", items);
writeJson("yields.json", yieldRows.sort((a, b) => a.productionNodeId - b.productionNodeId || a.itemId - b.itemId));
writeJson("distances.json", distanceRows.sort((a, b) => a.productionNodeId - b.productionNodeId));
const mapNodeIds = new Set(deckIcons.map(([id]) => id).filter((id) => exploration[String(id)] && deckIconPositions[String(id)]));
const mapNetwork: MapNetwork = {
  nodes: deckIcons
    .filter(([id]) => mapNodeIds.has(id))
    .map(([id, kind]) => {
      const node = exploration[String(id)];
      const [x, z] = deckIconPositions[String(id)];
      return {
        id,
        name: nodeNames[String(id)] ?? node.name ?? `Node ${id}`,
        kind,
        cpCost: Number(node.CP ?? 0),
        isMain: node.is_main === 1,
        isPlantzone: node.is_plantzone === true,
        isTown:
          node.is_planttown === true ||
          (kind > 0 && kind < 3 && Number(node.CP ?? 0) === 0),
        position: { x, z },
      };
    })
    .sort((a, b) => a.id - b.id),
  edges: deckLinks
    .filter(([sourceId, targetId]) => mapNodeIds.has(sourceId) && mapNodeIds.has(targetId))
    .map(([sourceId, targetId]) => ({ sourceId, targetId })),
  source,
  importedAt: new Date().toISOString(),
};
writeJson("map-network.json", mapNetwork);
console.log(`Imported ${nodes.length} Workerman production nodes, ${items.length} items, ${yieldRows.length} yield rows, ${distanceRows.length} distance rows, ${mapNetwork.nodes.length} map icons, and ${mapNetwork.edges.length} map connections.`);

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Workerman ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

function productsFrom(dropData: WorkermanDrops, productionNodeId: number, itemIds: Set<number>, rows: YieldRow[]): NodeProduct[] {
  const normal = dropData.unlucky ?? {};
  const lucky = dropData.lucky ?? {};
  const giant = dropData.unlucky_gi ?? {};
  const normalIds = Object.keys(normal).map(Number).filter((id) => Number.isFinite(id) && id > 0);
  const extraIds = [...new Set([...Object.keys(lucky), ...Object.keys(giant)].map(Number).filter((id) => Number.isFinite(id) && id > 0 && !normalIds.includes(id)))];
  return [...normalIds, ...extraIds].map((itemId, index) => {
    itemIds.add(itemId);
    const normalYield = normal[String(itemId)] ?? null;
    const luckyYield = lucky[String(itemId)] ?? null;
    const giantYield = giant[String(itemId)] ?? null;
    rows.push({ productionNodeId, itemId, normalYield, luckyYield, giantYield, source, sourceUrl: sourceUrls.drops, confidence: "estimated" });
    return {
      itemId,
      itemName: itemNames[String(itemId)] ?? `Item ${itemId}`,
      averageYield: normalYield,
      luckyYield,
      giantYield,
      isPrimary: index === 0,
      source,
      confidence: "estimated"
    };
  });
}

function nearestTown(rows: [number, number][]) {
  return rows
    .map(([townId, distance]) => ({ townId, distance }))
    .filter((row) => Number.isFinite(row.distance) && row.distance >= 0 && row.distance < 10_000_000)
    .sort((a, b) => a.distance - b.distance)[0];
}

function nodeType(kind?: number): NodeType {
  if (kind === 4) return "Farming";
  if (kind === 6) return "Gathering";
  if (kind === 7) return "Mining";
  if (kind === 8) return "Logging";
  if (kind === 11) return "Fishing";
  if (kind === 15) return "Excavation";
  return "Other";
}

function itemCategory(itemType?: number): string {
  return itemType == null ? "Unknown" : `Item Type ${itemType}`;
}

function writeJson(fileName: string, data: unknown): void {
  fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(data, null, 2));
}
