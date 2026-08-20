import fs from "node:fs/promises";
import path from "node:path";
import type { CraftRecipe, Item, MapNetwork, MarketData, WorkerNode, WorkerPreset } from "../../shared/models.js";

const dataDir = path.resolve("src/data");

async function readJson<T>(fileName: string): Promise<T> {
  const raw = await fs.readFile(path.join(dataDir, fileName), "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(fileName: string, data: unknown): Promise<void> {
  await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(data, null, 2));
}

export interface NodeRepository {
  getAll(): Promise<WorkerNode[]>;
  getById(id: number): Promise<WorkerNode | null>;
}

export interface ItemRepository {
  getAll(): Promise<Item[]>;
  getById(id: number): Promise<Item | null>;
}

export class JsonNodeRepository implements NodeRepository {
  async getAll(): Promise<WorkerNode[]> {
    return readJson<WorkerNode[]>("nodes.json");
  }

  async getById(id: number): Promise<WorkerNode | null> {
    const nodes = await this.getAll();
    return nodes.find((node) => node.id === id) ?? null;
  }
}

export class JsonItemRepository implements ItemRepository {
  async getAll(): Promise<Item[]> {
    return readJson<Item[]>("items.json");
  }

  async getById(id: number): Promise<Item | null> {
    const items = await this.getAll();
    return items.find((item) => item.id === id) ?? null;
  }
}

export class JsonRecipeRepository {
  async getAll(): Promise<CraftRecipe[]> { return readJson<CraftRecipe[]>("recipes.json"); }
  async getById(id: string): Promise<CraftRecipe | null> { return (await this.getAll()).find((recipe) => recipe.id === id) ?? null; }
}

export async function getMapNetwork(): Promise<MapNetwork> {
  return readJson<MapNetwork>("map-network.json");
}

export async function getWorkerPresets(): Promise<WorkerPreset[]> {
  return readJson<WorkerPreset[]>("worker-presets.json");
}

export async function getManualMarketData(): Promise<unknown[]> {
  return readJson<unknown[]>("manual-market.json");
}

export async function getDataBundle() {
  const [nodes, items, manualMarket, workerPresets, recipes] = await Promise.all([
    readJson<WorkerNode[]>("nodes.json"),
    readJson<Item[]>("items.json"),
    readJson<MarketData[]>("manual-market.json"),
    readJson<WorkerPreset[]>("worker-presets.json"),
    readJson<CraftRecipe[]>("recipes.json")
  ]);
  return { nodes, items, manualMarket, workerPresets, recipes };
}

export async function writeDataBundle(bundle: { nodes: WorkerNode[]; items: Item[]; manualMarket: MarketData[]; workerPresets: WorkerPreset[] }) {
  await Promise.all([
    writeJson("nodes.json", bundle.nodes),
    writeJson("items.json", bundle.items),
    writeJson("manual-market.json", bundle.manualMarket),
    writeJson("worker-presets.json", bundle.workerPresets)
  ]);
}
