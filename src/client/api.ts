import type { MarketStatus, NodeRanking, WorkerNode } from "../shared/models";
import type { DataBundle, ValidationSummary } from "../shared/validation";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchRankings(region = "ASIA"): Promise<NodeRanking[]> {
  return getJson<NodeRanking[]>(`/api/rankings?region=${encodeURIComponent(region)}`);
}

export function fetchNodeRanking(id: number, region = "ASIA"): Promise<NodeRanking> {
  return getJson<NodeRanking>(`/api/rankings/${id}?region=${encodeURIComponent(region)}`);
}

export function fetchNodes(): Promise<WorkerNode[]> {
  return getJson<WorkerNode[]>("/api/nodes");
}

export function fetchMarketStatus(region = "ASIA"): Promise<MarketStatus> {
  return getJson<MarketStatus>(`/api/market/status?region=${encodeURIComponent(region)}`);
}

export function fetchDataBundle(): Promise<DataBundle> {
  return getJson<DataBundle>("/api/data/export");
}

export function fetchValidation(): Promise<ValidationSummary> {
  return getJson<ValidationSummary>("/api/data/validate");
}

export async function validateDataBundleRemote(bundle: DataBundle): Promise<ValidationSummary> {
  const response = await fetch("/api/data/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bundle)
  });
  if (!response.ok) throw new Error(`Validation failed: ${response.status}`);
  return response.json() as Promise<ValidationSummary>;
}

export async function importDataBundleRemote(bundle: DataBundle): Promise<ValidationSummary> {
  const response = await fetch("/api/data/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bundle)
  });
  const data = await response.json() as ValidationSummary;
  if (!response.ok) throw new Error(`Import failed: ${data.issues?.[0]?.message ?? response.status}`);
  return data;
}
