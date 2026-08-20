import type { MarketData } from "../../shared/models.js";
import { MarketCache } from "./cache.js";
import type { MarketProvider } from "./MarketProvider.js";

interface BdolyticsRow {
  itemId: number;
  price?: number;
  inStock?: number;
  totalTrades?: number;
  fourteenDayVolume?: number;
}

interface BdolyticsResponse {
  result?: { data?: BdolyticsRow[] };
}

export class BdolyticsMarketProvider implements MarketProvider {
  readonly name = "bdolytics";
  private readonly cache = new MarketCache(30 * 60 * 1000);
  private marketRows: Promise<Map<number, BdolyticsRow>> | null = null;
  private marketRowsLoadedAt = 0;

  constructor(readonly region = process.env.BDO_MARKET_REGION ?? "ASIA", private readonly baseUrl = process.env.BDOLYTICS_BASE_URL ?? "https://bdolytics.com") {}

  async getItemMarketData(itemId: number): Promise<MarketData> {
    const key = `${this.region}:${itemId}`;
    const cached = this.cache.getFresh(key);
    if (cached) return cached;

    try {
      const rows = await this.getMarketRows();
      const row = rows.get(itemId);
      if (!row || !row.price) throw new Error("BDOLytics item unavailable");
      const data: MarketData = {
        itemId,
        currentPrice: Number(row.price ?? 0),
        sellOrders: Number(row.inStock ?? 0),
        transactionVolume: Number(row.fourteenDayVolume ?? 0),
        fourteenDayVolume: Number(row.fourteenDayVolume ?? 0),
        averageDailyVolume: Number(row.fourteenDayVolume ?? 0) / 14,
        totalTrades: Number(row.totalTrades ?? 0),
        updatedAt: new Date().toISOString(),
        source: "real"
      };
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

  async getItemsMarketData(itemIds: number[]): Promise<MarketData[]> {
    return Promise.all(itemIds.map((itemId) => this.getItemMarketData(itemId)));
  }

  private async getMarketRows(): Promise<Map<number, BdolyticsRow>> {
    if (!this.marketRows || Date.now() - this.marketRowsLoadedAt >= 30 * 60 * 1000) {
      this.marketRowsLoadedAt = Date.now();
      this.marketRows = this.fetchMarketRows().catch((error) => { this.marketRows = null; this.marketRowsLoadedAt = 0; throw error; });
    }
    return this.marketRows;
  }

  private async fetchMarketRows(): Promise<Map<number, BdolyticsRow>> {
    const input = encodeURIComponent(JSON.stringify({ language: "en", region: this.region.toUpperCase() }));
    const response = await fetch(`${this.baseUrl}/api/trpc/market.getMarket?input=${input}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`BDOLytics ${response.status} for market.getMarket`);
    const data = (await response.json()) as BdolyticsResponse;
    const rows = data.result?.data ?? [];
    return new Map(rows.map((row) => [Number(row.itemId), row]));
  }
}
