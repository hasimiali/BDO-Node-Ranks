import { describe, expect, it } from "vitest";
import type { MarketData, WorkerNode } from "../../shared/models.js";
import type { MarketProvider } from "../market/MarketProvider.js";
import type { NodeRepository } from "../repositories/JsonRepository.js";
import { RankingService } from "./rankingService.js";

const normalMarket: MarketData = {
  itemId: 4604,
  currentPrice: 3_700,
  sellOrders: 100,
  transactionVolume: 10_000,
  updatedAt: new Date().toISOString(),
  source: "real"
};

const node: WorkerNode = {
  id: 1,
  name: "Test Lumbering",
  region: "Test",
  type: "Logging",
  productionCategory: "Lumbering",
  cpCost: 1,
  workload: 300,
  distance: 100,
  products: [
    { itemId: 4604, itemName: "Birch Timber", averageYield: 17, isPrimary: true, source: "test", confidence: "estimated" },
    { itemId: 5005, itemName: "Bloody Tree Knot", averageYield: null, luckyYield: 1, isPrimary: false, source: "test", confidence: "estimated" }
  ],
  source: "test",
  confidence: "estimated"
};

describe("RankingService", () => {
  it("scores nodes with lucky-only products at zero luck", async () => {
    const provider: MarketProvider = {
      name: "test",
      region: "test",
      getItemMarketData: async (itemId) => itemId === normalMarket.itemId ? normalMarket : unavailable(itemId)
    };
    const repository: NodeRepository = {
      getAll: async () => [node],
      getById: async (id) => id === node.id ? node : null
    };

    const [ranking] = await new RankingService(provider, repository).getRankings();

    expect(ranking.score).not.toBeNull();
    expect(ranking.confidence).toBe("estimated");
    expect(ranking.issues).not.toContain("Yield missing for Bloody Tree Knot");
    expect(ranking.issues).not.toContain("Market data unavailable for Bloody Tree Knot");
    expect(ranking.products[1].luckyYield).toBe(1);
  });
});

function unavailable(itemId: number): MarketData {
  return {
    itemId,
    currentPrice: 0,
    sellOrders: 0,
    updatedAt: new Date().toISOString(),
    source: "unavailable"
  };
}
