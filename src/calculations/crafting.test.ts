import { describe, expect, it } from "vitest";
import type { CraftAssumptions, CraftRecipe, MarketData } from "../shared/models.js";
import { calculateCraftGuide, calculateCraftProfits } from "./crafting.js";

const assumptions: CraftAssumptions = { mastery: { cooking: 1000, alchemy: 0, processing: 0 }, craftSeconds: { cooking: 2, alchemy: 2, processing: 10 }, saleMultiplier: 0.845, batchSize: 1, recursiveCrafting: true, maxCraftDepth: 5, normalYield: { cooking: 2.5, alchemy: 2.5, processing: 2.5 }, rareYield: { cooking: 0.3, alchemy: 0.3, processing: 0 } };
const market = (itemId: number, currentPrice: number): MarketData => ({ itemId, currentPrice, sellOrders: 10, buyOrders: 10, fourteenDayVolume: 1400, averageDailyVolume: 100, updatedAt: "2026-01-01", source: "real" });
const recipe = (id: string, outputId: number, ingredientId: number): CraftRecipe => ({ id, name: id, lifeSkill: "cooking", method: "Cooking", output: { itemId: outputId, itemName: `Item ${outputId}`, quantity: 1 }, extraOutputs: [], ingredients: [{ quantity: 2, alternatives: [{ itemId: ingredientId, itemName: `Item ${ingredientId}` }] }], source: { provider: "test", url: "test", importedAt: "2026-01-01" }, confidence: "high" });

describe("craft profitability", () => {
  it("applies opportunity cost, yield, and marketplace tax", () => {
    const [result] = calculateCraftProfits([recipe("beer", 2, 1)], [market(1, 100), market(2, 1000)], assumptions);
    expect(result.materialCost).toBe(200);
    expect(result.netRevenue).toBe(2112.5);
    expect(result.profitPerBatch).toBe(1912.5);
    expect(result.marginPercent).toBeCloseTo(956.25);
  });

  it("selects a cheaper alternative ingredient", () => {
    const value = recipe("meal", 3, 1);
    value.ingredients[0].alternatives.push({ itemId: 4, itemName: "Cheap grain" });
    const [result] = calculateCraftProfits([value], [market(1, 100), market(4, 40), market(3, 500)], assumptions);
    expect(result.ingredients[0].itemId).toBe(4);
    expect(result.materialCost).toBe(80);
  });

  it("crafts an intermediate when cheaper than buying", () => {
    const child = recipe("dough", 5, 1);
    const parent = recipe("pie", 6, 5);
    const results = calculateCraftProfits([child, parent], [market(1, 10), market(5, 100), market(6, 1000)], assumptions);
    const result = results.find((entry) => entry.recipe.id === "pie")!;
    expect(result.ingredients[0].source).toBe("craft");
    expect(result.ingredients[0].unitCost).toBe(8);
  });

  it("marks incomplete prices instead of inventing profit", () => {
    const [result] = calculateCraftProfits([recipe("missing", 2, 1)], [market(2, 1000)], assumptions);
    expect(result.materialCost).toBeNull();
    expect(result.profitPerBatch).toBeNull();
    expect(result.priceCoverage).toBe(0.5);
  });

  it("scales batch materials and time without inflating hourly profit", () => {
    const base = calculateCraftProfits([recipe("beer", 2, 1)], [market(1, 100), market(2, 1000)], assumptions)[0];
    const batch = calculateCraftProfits([recipe("beer", 2, 1)], [market(1, 100), market(2, 1000)], { ...assumptions, batchSize: 10 })[0];
    expect(batch.materialCost).toBe(base.materialCost! * 10);
    expect(batch.profitPerBatch).toBe(base.profitPerBatch! * 10);
    expect(batch.profitPerHour).toBe(base.profitPerHour);
  });

  it("limits realizable hourly profit by finished-item daily sales", () => {
    const slowOutput = { ...market(2, 1000), fourteenDayVolume: 14, averageDailyVolume: 1 };
    const [result] = calculateCraftProfits([recipe("beer", 2, 1)], [market(1, 100), slowOutput], assumptions);
    expect(result.averageDailySales).toBe(1);
    expect(result.outputSellOrders).toBe(10);
    expect(result.stockToDailySales).toBe(10);
    expect(result.realizableProfitPerHour).toBeLessThan(result.profitPerHour!);
  });

  it("reports requirement stock coverage for the configured batch", () => {
    const ingredient = { ...market(1, 100), sellOrders: 15 };
    const [result] = calculateCraftProfits(
      [recipe("beer", 2, 1)],
      [ingredient, market(2, 1000)],
      { ...assumptions, batchSize: 10 },
    );
    expect(result.ingredients[0].quantity).toBe(20);
    expect(result.ingredients[0].listedStock).toBe(15);
    expect(result.ingredients[0].stockCoverage).toBe(0.75);
    expect(result.ingredients[0].hasEnoughStock).toBe(false);
    expect(result.requirementsAvailable).toBe(false);
    expect(result.insufficientRequirementCount).toBe(1);
    expect(result.bottleneckRequirement?.itemName).toBe("Item 1");
  });

  it("preserves every alternative and adjusts required stock by equivalence", () => {
    const value = recipe("meal", 3, 1);
    value.ingredients[0].alternatives.push({
      itemId: 4,
      itemName: "Concentrated grain",
      equivalence: 2,
    });
    const [result] = calculateCraftProfits(
      [value],
      [market(1, 100), { ...market(4, 150), sellOrders: 1 }, market(3, 500)],
      assumptions,
    );
    expect(result.ingredients[0].alternatives).toHaveLength(2);
    const concentrated = result.ingredients[0].alternatives.find((entry) => entry.itemId === 4)!;
    expect(concentrated.quantity).toBe(1);
    expect(concentrated.stockCoverage).toBe(1);
    expect(concentrated.selected).toBe(true);
  });

  it("treats vendor requirements as available with market availability retained", () => {
    const value = recipe("vendor", 2, 1);
    value.ingredients[0].alternatives[0].vendorPrice = 20;
    const [result] = calculateCraftProfits(
      [value],
      [{ ...market(1, 100), sellOrders: 0 }, market(2, 1000)],
      assumptions,
    );
    expect(result.ingredients[0].source).toBe("vendor");
    expect(result.ingredients[0].hasEnoughStock).toBe(true);
    expect(result.ingredients[0].listedStock).toBe(0);
    expect(result.requirementsAvailable).toBe(true);
  });

  it("keeps direct market stock when recursive crafting is selected", () => {
    const child = recipe("dough", 5, 1);
    const parent = recipe("pie", 6, 5);
    const results = calculateCraftProfits(
      [child, parent],
      [market(1, 10), { ...market(5, 100), sellOrders: 300 }, market(6, 1000)],
      assumptions,
    );
    const result = results.find((entry) => entry.recipe.id === "pie")!;
    expect(result.ingredients[0].source).toBe("craft");
    expect(result.ingredients[0].marketPrice).toBe(100);
    expect(result.ingredients[0].listedStock).toBe(300);
    expect(result.ingredients[0].craftRecipeId).toBe("dough");
    expect(result.ingredients[0].craftRequirementsAvailable).toBe(true);
    expect(result.ingredients[0].marketStockCoverage).toBe(150);
  });

  it("propagates a recursive child material shortage to the parent", () => {
    const child = recipe("dough", 5, 1);
    const parent = recipe("pie", 6, 5);
    const results = calculateCraftProfits(
      [child, parent],
      [{ ...market(1, 10), sellOrders: 0 }, market(5, 1000), market(6, 1000)],
      assumptions,
    );
    const result = results.find((entry) => entry.recipe.id === "pie")!;
    expect(result.ingredients[0].source).toBe("craft");
    expect(result.ingredients[0].craftRequirementsAvailable).toBe(false);
    expect(result.requirementsAvailable).toBe(false);
    expect(result.bottleneckRequirement?.itemId).toBe(1);
  });

  it("retains a multi-level recursive crafting guide on demand", () => {
    const rawToIntermediate = recipe("flour", 5, 1);
    const intermediateToIngredient = recipe("dough", 6, 5);
    const finalRecipe = recipe("pie", 7, 6);
    const recipes = [rawToIntermediate, intermediateToIngredient, finalRecipe];
    const markets = [
      market(1, 10),
      market(5, 1000),
      market(6, 1000),
      market(7, 2000),
    ];
    const guide = calculateCraftGuide(
      recipes,
      markets,
      { ...assumptions, batchSize: 10 },
      "pie",
    )!;
    expect(guide.craftCount).toBe(10);
    expect(guide.expectedOutputQuantity).toBe(25);
    expect(guide.ingredients[0].craftResult?.recipe.id).toBe("dough");
    expect(
      guide.ingredients[0].craftResult?.ingredients[0].craftResult?.recipe.id,
    ).toBe("flour");
    expect(
      guide.ingredients[0].craftResult?.ingredients[0].craftResult?.ingredients[0]
        .quantity,
    ).toBeGreaterThan(0);

    const ranked = calculateCraftProfits(recipes, markets, assumptions);
    expect(ranked[2].ingredients[0].craftResult).toBeUndefined();
  });

  it("returns null when a requested guide recipe does not exist", () => {
    expect(calculateCraftGuide([], [], assumptions, "missing")).toBeNull();
  });

  it("keeps unavailable stock unknown instead of reporting zero", () => {
    const unavailableMarket: MarketData = {
      itemId: 1,
      currentPrice: 0,
      sellOrders: 0,
      updatedAt: "2026-01-01",
      source: "unavailable",
    };
    const [result] = calculateCraftProfits(
      [recipe("missing", 2, 1)],
      [unavailableMarket, market(2, 1000)],
      assumptions,
    );
    expect(result.ingredients[0].listedStock).toBeNull();
    expect(result.ingredients[0].hasEnoughStock).toBeNull();
    expect(result.requirementsAvailable).toBeNull();
  });
});
