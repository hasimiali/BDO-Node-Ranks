import type {
  CraftAssumptions,
  CraftProfitResult,
  CraftRecipe,
  Item,
  MapNetwork,
  MarketData,
  MarketStatus,
  NodeRanking,
  WorkerNode,
} from "../shared/models";
import type { DataBundle, ValidationSummary } from "../shared/validation";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchRankings(region = "ASIA"): Promise<NodeRanking[]> {
  return getJson<NodeRanking[]>(
    `/api/rankings?region=${encodeURIComponent(region)}`,
  );
}

export function fetchNodeRanking(
  id: number,
  region = "ASIA",
): Promise<NodeRanking> {
  return getJson<NodeRanking>(
    `/api/rankings/${id}?region=${encodeURIComponent(region)}`,
  );
}

export function fetchNodes(): Promise<WorkerNode[]> {
  return getJson<WorkerNode[]>("/api/nodes");
}

export function fetchMapNetwork(): Promise<MapNetwork> {
  return getJson<MapNetwork>("/api/map/network");
}

export function fetchMarketStatus(region = "ASIA"): Promise<MarketStatus> {
  return getJson<MarketStatus>(
    `/api/market/status?region=${encodeURIComponent(region)}`,
  );
}

export interface ItemSearchResult extends Item {
  producedByRecipeCount: number;
  usedByRecipeCount: number;
}

export function searchItems(query: string): Promise<ItemSearchResult[]> {
  return getJson<ItemSearchResult[]>(
    `/api/items/search?q=${encodeURIComponent(query)}&limit=20`,
  );
}

export function fetchItemMarket(
  itemId: number,
  region = "ASIA",
): Promise<MarketData> {
  return getJson<MarketData>(
    `/api/items/${itemId}/market?region=${encodeURIComponent(region)}`,
  );
}

export function fetchRecipes(
  query = "",
  lifeSkill = "",
): Promise<CraftRecipe[]> {
  return getJson<CraftRecipe[]>(
    `/api/recipes?q=${encodeURIComponent(query)}&lifeSkill=${encodeURIComponent(lifeSkill)}&limit=500`,
  );
}

export async function fetchCraftRankings(
  region: string,
  assumptions: CraftAssumptions,
  lifeSkills = ["cooking", "alchemy", "processing"],
): Promise<CraftProfitResult[]> {
  const response = await fetch("/api/crafting/rank", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ region, assumptions, lifeSkills }),
  });
  if (!response.ok) throw new Error(`Craft ranking failed: ${response.status}`);
  return response.json() as Promise<CraftProfitResult[]>;
}

export async function fetchCraftGuide(
  recipeId: string,
  region: string,
  assumptions: CraftAssumptions,
): Promise<CraftProfitResult> {
  const response = await fetch(
    `/api/crafting/guide/${encodeURIComponent(recipeId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ region, assumptions }),
    },
  );
  const data = (await response.json()) as
    CraftProfitResult | { error?: string };
  if (!response.ok) {
    throw new Error(
      "error" in data && data.error
        ? data.error
        : `Craft guide failed: ${response.status}`,
    );
  }
  return data as CraftProfitResult;
}

export function fetchDataBundle(): Promise<DataBundle> {
  return getJson<DataBundle>("/api/data/export");
}

export function fetchValidation(): Promise<ValidationSummary> {
  return getJson<ValidationSummary>("/api/data/validate");
}

export async function validateDataBundleRemote(
  bundle: DataBundle,
): Promise<ValidationSummary> {
  const response = await fetch("/api/data/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bundle),
  });
  if (!response.ok) throw new Error(`Validation failed: ${response.status}`);
  return response.json() as Promise<ValidationSummary>;
}

export async function importDataBundleRemote(
  bundle: DataBundle,
): Promise<ValidationSummary> {
  const response = await fetch("/api/data/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bundle),
  });
  const data = (await response.json()) as ValidationSummary;
  if (!response.ok)
    throw new Error(
      `Import failed: ${data.issues?.[0]?.message ?? response.status}`,
    );
  return data;
}
