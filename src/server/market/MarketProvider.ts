import type { MarketData } from "../../shared/models.js";

export interface MarketProvider {
  readonly name: string;
  readonly region: string;
  getItemMarketData(itemId: number): Promise<MarketData>;
  getItemsMarketData?(itemIds: number[]): Promise<MarketData[]>;
}
