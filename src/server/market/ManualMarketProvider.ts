import type { MarketData } from "../../shared/models.js";
import { getManualMarketData } from "../repositories/JsonRepository.js";
import type { MarketProvider } from "./MarketProvider.js";

interface ManualRow {
  itemId: number;
  currentPrice: number;
  minPrice?: number;
  maxPrice?: number;
  buyOrders?: number;
  sellOrders?: number;
  transactionVolume?: number;
  updatedAt?: string;
}

export class ManualMarketProvider implements MarketProvider {
  readonly name = "manual-json";

  constructor(readonly region = "asia") {}

  async getItemMarketData(itemId: number): Promise<MarketData> {
    const rows = (await getManualMarketData()) as ManualRow[];
    const row = rows.find((entry) => Number(entry.itemId) === itemId);
    if (!row) {
      return {
        itemId,
        currentPrice: 0,
        buyOrders: 0,
        sellOrders: 0,
        updatedAt: new Date().toISOString(),
        source: "unavailable",
        message: "Market data unavailable"
      };
    }
    return {
      itemId,
      currentPrice: Number(row.currentPrice) || 0,
      minPrice: row.minPrice,
      maxPrice: row.maxPrice,
      buyOrders: Number(row.buyOrders ?? 0),
      sellOrders: Number(row.sellOrders ?? 0),
      transactionVolume: row.transactionVolume,
      updatedAt: row.updatedAt ?? new Date().toISOString(),
      source: "manual"
    };
  }
}
