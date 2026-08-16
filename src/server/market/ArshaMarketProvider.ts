import type { MarketData } from "../../shared/models.js";
import { MarketCache } from "./cache.js";
import type { MarketProvider } from "./MarketProvider.js";

interface ArshaAvailabilityRow {
  sellCount?: number;
  buyCount?: number;
  onePrice?: number;
}

interface ArshaDetailData {
  availability?: ArshaAvailabilityRow[];
  basePrice?: number;
  sellCount?: number;
  recentPrice?: number;
  recentTransaction?: number;
}

interface ArshaListItem {
  id: number;
  enhancement?: number;
  basePrice?: number;
  count?: number;
  tradeCount?: number;
}

export class ArshaMarketProvider implements MarketProvider {
  readonly name = "arsha";
  private readonly cache = new MarketCache(30 * 60 * 1000);

  constructor(readonly region = process.env.BDO_MARKET_REGION ?? "asia", private readonly baseUrl = process.env.ARSHA_BASE_URL ?? "https://api.arsha.io") {}

  async getItemMarketData(itemId: number): Promise<MarketData> {
    const key = `${this.region}:${itemId}`;
    const cached = this.cache.getFresh(key);
    if (cached) return cached;

    try {
      const variant = await this.fetchVariant(itemId);
      const enhancement = variant.enhancement ?? 0;
      const detail = await this.fetchDetail(itemId, enhancement);
      const availability = detail.availability ?? [];
      const prices = availability.map((row) => Number(row.onePrice)).filter((price) => Number.isFinite(price) && price > 0);
      const data: MarketData = {
        itemId,
        currentPrice: Number(detail.recentPrice ?? variant.basePrice ?? detail.basePrice ?? 0),
        minPrice: prices.length ? Math.min(...prices) : undefined,
        maxPrice: prices.length ? Math.max(...prices) : undefined,
        buyOrders: availability.reduce((sum, row) => sum + Number(row.buyCount ?? 0), 0),
        sellOrders: Number(detail.sellCount ?? availability.reduce((sum, row) => sum + Number(row.sellCount ?? 0), 0)),
        transactionVolume: Number(variant.tradeCount ?? detail.recentTransaction ?? 0),
        updatedAt: new Date().toISOString(),
        source: "real"
      };
      if (!data.currentPrice) throw new Error("Arsha response missing current price");
      this.cache.set(key, data);
      return data;
    } catch (error) {
      const stale = this.cache.getAny(key);
      if (stale) return { ...stale, source: "stale", stale: true, message: "Market data is stale" };
      return {
        itemId,
        currentPrice: 0,
        buyOrders: 0,
        sellOrders: 0,
        updatedAt: new Date().toISOString(),
        source: "unavailable",
        message: error instanceof Error ? error.message : "Market data unavailable"
      };
    }
  }

  private async fetchVariant(itemId: number): Promise<ArshaListItem> {
    const candidates = [
      `${this.baseUrl}/v2/${this.region}/item/${itemId}`,
      `${this.baseUrl}/v2/${this.region}/GetItem?id=${itemId}`,
      `${this.baseUrl}/v2/${this.region}/GetItem?mainKey=${itemId}`
    ];
    for (const url of candidates) {
      const data = await tryJson(url);
      const rows = unwrapRows<ArshaListItem>(data);
      const match = rows.find((row) => row.id === itemId && (row.enhancement ?? 0) === 0) ?? rows.find((row) => row.id === itemId) ?? rows[0];
      if (match) return match;
    }
    throw new Error("Arsha item endpoint unavailable");
  }

  private async fetchDetail(itemId: number, enhancement: number): Promise<ArshaDetailData> {
    const candidates = [
      `${this.baseUrl}/v2/${this.region}/item/${itemId}/${enhancement}?extended=true`,
      `${this.baseUrl}/v2/${this.region}/GetBiddingInfoList?keyType=0&mainKey=${itemId}&subKey=${enhancement}`,
      `${this.baseUrl}/v2/${this.region}/GetMarketPriceInfo?mainKey=${itemId}&subKey=${enhancement}`
    ];
    for (const url of candidates) {
      const data = await tryJson(url);
      const unwrapped = unwrapData<ArshaDetailData>(data);
      if (unwrapped && (unwrapped.availability || unwrapped.recentPrice || unwrapped.basePrice)) return unwrapped;
    }
    throw new Error("Arsha detail endpoint unavailable");
  }
}

async function tryJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Arsha ${response.status} for ${new URL(url).pathname}`);
  return response.json() as Promise<unknown>;
}

function unwrapData<T>(data: unknown): T | null {
  if (data && typeof data === "object" && "data" in data) return (data as { data: T }).data;
  return data as T;
}

function unwrapRows<T>(data: unknown): T[] {
  const unwrapped = unwrapData<unknown>(data);
  if (Array.isArray(unwrapped)) return unwrapped as T[];
  if (unwrapped && typeof unwrapped === "object") return [unwrapped as T];
  return [];
}
