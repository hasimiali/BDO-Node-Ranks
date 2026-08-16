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
