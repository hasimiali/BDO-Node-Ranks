import type { MarketProvider } from "./MarketProvider.js";
import { ArshaMarketProvider } from "./ArshaMarketProvider.js";
import { BdolyticsMarketProvider } from "./BdolyticsMarketProvider.js";
import { ManualMarketProvider } from "./ManualMarketProvider.js";

class FallbackMarketProvider implements MarketProvider {
  readonly name: string;
  readonly region: string;

  constructor(private readonly primary: MarketProvider, private readonly fallback: MarketProvider) {
    this.name = `${primary.name}+${fallback.name}`;
    this.region = primary.region;
  }

  async getItemMarketData(itemId: number) {
    const primaryData = await this.primary.getItemMarketData(itemId);
    if (primaryData.source !== "unavailable") return primaryData;
    return this.fallback.getItemMarketData(itemId);
  }

  async getItemsMarketData(itemIds: number[]) {
    const primaryRows = this.primary.getItemsMarketData ? await this.primary.getItemsMarketData(itemIds) : await Promise.all(itemIds.map((id) => this.primary.getItemMarketData(id)));
    const unavailable = primaryRows.filter((row) => row.source === "unavailable").map((row) => row.itemId);
    if (!unavailable.length) return primaryRows;
    const fallbackRows = this.fallback.getItemsMarketData ? await this.fallback.getItemsMarketData(unavailable) : await mapWithConcurrency(unavailable, 8, (id) => this.fallback.getItemMarketData(id));
    const fallbackById = new Map(fallbackRows.map((row) => [row.itemId, row]));
    return primaryRows.map((row) => row.source === "unavailable" ? fallbackById.get(row.itemId) ?? row : row);
  }
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, read: (value: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length);
  let next = 0;
  async function worker() { while (next < values.length) { const index = next++; output[index] = await read(values[index]); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return output;
}

export function createMarketProvider(region = process.env.BDO_MARKET_REGION ?? "ASIA"): MarketProvider {
  const provider = process.env.MARKET_PROVIDER ?? "bdolytics-arsha";
  const bdolyticsRegion = region.toUpperCase();
  const arshaRegion = region.toLowerCase();
  if (provider === "manual") return new ManualMarketProvider(arshaRegion);
  if (provider === "arsha") return new ArshaMarketProvider(arshaRegion);
  if (provider === "bdolytics") return new BdolyticsMarketProvider(bdolyticsRegion);
  if (provider === "bdolytics-arsha") return new FallbackMarketProvider(new BdolyticsMarketProvider(bdolyticsRegion), new ArshaMarketProvider(arshaRegion));
  return new ArshaMarketProvider(arshaRegion);
}
