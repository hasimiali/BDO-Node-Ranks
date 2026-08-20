import type {
  CraftAssumptions,
  CraftProfitResult,
  CraftRecipe,
  IngredientAlternativeQuote,
  IngredientCostChoice,
  MarketData,
  RecipeOutput,
} from "../shared/models.js";
import { calculateDemandScore } from "./demand.js";
import { calculateLiquidityScore } from "./liquidity.js";

type Bottleneck = NonNullable<CraftProfitResult["bottleneckRequirement"]>;
type EvaluatedAlternative = IngredientAlternativeQuote & {
  bottleneck: Bottleneck | null;
};

export function calculateCraftProfits(
  recipes: CraftRecipe[],
  marketRows: MarketData[],
  assumptions: CraftAssumptions,
  includeCraftDetails = false,
  roots = recipes,
): CraftProfitResult[] {
  const markets = new Map(marketRows.map((row) => [row.itemId, row]));
  const byOutput = new Map<number, CraftRecipe[]>();
  for (const recipe of recipes) {
    byOutput.set(recipe.output.itemId, [
      ...(byOutput.get(recipe.output.itemId) ?? []),
      recipe,
    ]);
  }

  function evaluate(
    recipe: CraftRecipe,
    craftCount: number,
    depth = 0,
    visiting = new Set<string>(),
  ): CraftProfitResult {
    if (visiting.has(recipe.id)) {
      return unavailable(recipe, "Recipe cycle detected.");
    }

    const nextVisiting = new Set(visiting).add(recipe.id);
    const issues: string[] = [];
    const ingredientBottlenecks = new Map<number, Bottleneck | null>();
    const ingredients: IngredientCostChoice[] = recipe.ingredients.map(
      (group) => {
        const evaluated = group.alternatives.map(
          (ingredient): EvaluatedAlternative => {
            const equivalence =
              ingredient.equivalence && ingredient.equivalence > 0
                ? ingredient.equivalence
                : 1;
            const quantity = (group.quantity * craftCount) / equivalence;
            const market = markets.get(ingredient.itemId);
            const marketAvailable = Boolean(
              market &&
              market.source !== "unavailable" &&
              market.currentPrice > 0,
            );
            const marketPrice = marketAvailable ? market!.currentPrice : null;
            const listedStock = marketAvailable ? market!.sellOrders : null;
            const stockCoverage =
              listedStock == null || quantity <= 0
                ? null
                : listedStock / quantity;
            const marketHasEnoughStock =
              stockCoverage == null ? null : stockCoverage >= 1;
            const marketBottleneck: Bottleneck | null =
              stockCoverage == null
                ? null
                : {
                    itemId: ingredient.itemId,
                    itemName: ingredient.itemName,
                    requiredQuantity: quantity,
                    listedStock: listedStock!,
                    coverage: stockCoverage,
                  };

            let craftUnitCost: number | null = null;
            let craftTotalCost: number | null = null;
            let craftRecipeId: string | undefined;
            let craftRequirementsAvailable: boolean | null = null;
            let craftCoverage: number | null = null;
            let craftBottleneck: Bottleneck | null = null;
            let craftResult: CraftProfitResult | undefined;

            if (
              assumptions.recursiveCrafting &&
              depth < assumptions.maxCraftDepth
            ) {
              for (const child of byOutput.get(ingredient.itemId) ?? []) {
                if (nextVisiting.has(child.id)) continue;
                const outputPerCraft = expectedQuantityPerCraft(
                  child.output,
                  child,
                  assumptions,
                );
                if (outputPerCraft <= 0) continue;
                const requiredChildCrafts = quantity / outputPerCraft;
                const childResult = evaluate(
                  child,
                  requiredChildCrafts,
                  depth + 1,
                  nextVisiting,
                );
                if (childResult.materialCost == null) continue;
                const candidateUnitCost = childResult.materialCost / quantity;
                if (
                  craftUnitCost == null ||
                  candidateUnitCost < craftUnitCost
                ) {
                  craftUnitCost = candidateUnitCost;
                  craftTotalCost = childResult.materialCost;
                  craftRecipeId = child.id;
                  craftRequirementsAvailable =
                    childResult.requirementsAvailable;
                  craftCoverage = childResult.requirementStockCoverage;
                  craftBottleneck = childResult.bottleneckRequirement;
                  craftResult = includeCraftDetails ? childResult : undefined;
                }
              }
            }

            const options = [
              marketPrice == null
                ? null
                : {
                    source: "market" as const,
                    unitCost: marketPrice,
                    totalCost: marketPrice * quantity,
                  },
              ingredient.vendorPrice == null
                ? null
                : {
                    source: "vendor" as const,
                    unitCost: ingredient.vendorPrice,
                    totalCost: ingredient.vendorPrice * quantity,
                  },
              craftUnitCost == null || craftTotalCost == null
                ? null
                : {
                    source: "craft" as const,
                    unitCost: craftUnitCost,
                    totalCost: craftTotalCost,
                  },
            ].filter(
              (option): option is NonNullable<typeof option> => option !== null,
            );
            const selected = options.sort(
              (a, b) => a.totalCost - b.totalCost,
            )[0];
            const selectedStock =
              selected?.source === "market"
                ? {
                    coverage: stockCoverage,
                    available: marketHasEnoughStock,
                    bottleneck: marketBottleneck,
                  }
                : selected?.source === "vendor"
                  ? { coverage: null, available: true, bottleneck: null }
                  : selected?.source === "craft"
                    ? {
                        coverage: craftCoverage,
                        available: craftRequirementsAvailable,
                        bottleneck: craftBottleneck,
                      }
                    : { coverage: null, available: null, bottleneck: null };

            return {
              itemId: ingredient.itemId,
              itemName: ingredient.itemName,
              quantity,
              equivalence,
              selected: false,
              selectedSource: selected?.source ?? "unavailable",
              selectedUnitCost: selected?.unitCost ?? null,
              selectedTotalCost: selected?.totalCost ?? null,
              marketPrice,
              marketTotalCost:
                marketPrice == null ? null : marketPrice * quantity,
              listedStock,
              marketStockCoverage: stockCoverage,
              marketHasEnoughStock,
              buyOrders: marketAvailable ? (market!.buyOrders ?? null) : null,
              averageDailySales: dailySales(market),
              fourteenDaySales: marketAvailable
                ? (market!.fourteenDayVolume ?? null)
                : null,
              stockCoverage: selectedStock.coverage,
              hasEnoughStock: selectedStock.available,
              marketSource: market?.source ?? "unavailable",
              marketUpdatedAt: market?.updatedAt ?? null,
              vendorPrice: ingredient.vendorPrice ?? null,
              craftUnitCost,
              craftTotalCost,
              craftRecipeId,
              craftRequirementsAvailable,
              craftResult,
              bottleneck: selectedStock.bottleneck,
            };
          },
        );

        const selectedIndex = evaluated.reduce(
          (best, entry, index, values) =>
            (entry.selectedTotalCost ?? Number.POSITIVE_INFINITY) <
            (values[best]?.selectedTotalCost ?? Number.POSITIVE_INFINITY)
              ? index
              : best,
          0,
        );
        evaluated[selectedIndex].selected = true;
        const selected = evaluated[selectedIndex];
        const { bottleneck, ...selectedQuote } = selected;
        ingredientBottlenecks.set(selected.itemId, bottleneck);
        const alternatives = evaluated.map(
          ({ bottleneck: _bottleneck, ...entry }) => entry,
        );

        return {
          itemId: selected.itemId,
          itemName: selected.itemName,
          quantity: selected.quantity,
          unitCost: selected.selectedUnitCost,
          totalCost: selected.selectedTotalCost,
          source: selected.selectedSource,
          recipeId: selected.craftRecipeId,
          marketPrice: selected.marketPrice,
          marketTotalCost: selected.marketTotalCost,
          listedStock: selected.listedStock,
          marketStockCoverage: selected.marketStockCoverage,
          marketHasEnoughStock: selected.marketHasEnoughStock,
          buyOrders: selected.buyOrders,
          averageDailySales: selected.averageDailySales,
          fourteenDaySales: selected.fourteenDaySales,
          stockCoverage: selected.stockCoverage,
          hasEnoughStock: selected.hasEnoughStock,
          marketSource: selected.marketSource,
          marketUpdatedAt: selected.marketUpdatedAt,
          vendorPrice: selected.vendorPrice,
          craftUnitCost: selected.craftUnitCost,
          craftTotalCost: selected.craftTotalCost,
          craftRecipeId: selected.craftRecipeId,
          craftRequirementsAvailable: selected.craftRequirementsAvailable,
          craftResult: selected.craftResult,
          alternatives: alternatives.map((entry) =>
            entry.itemId === selectedQuote.itemId
              ? { ...entry, selected: true }
              : entry,
          ),
        };
      },
    );

    const pricedIngredients = ingredients.filter(
      (entry) => entry.totalCost != null,
    ).length;
    const materialCost =
      pricedIngredients === ingredients.length
        ? ingredients.reduce((sum, entry) => sum + entry.totalCost!, 0)
        : null;
    for (const entry of ingredients) {
      if (entry.totalCost == null)
        issues.push(`Price unavailable for ${entry.itemName}.`);
      if (entry.hasEnoughStock === false) {
        issues.push(`Insufficient listed stock for ${entry.itemName}.`);
      }
    }

    const knownShortages = ingredients.filter(
      (entry) => entry.hasEnoughStock === false,
    );
    const unknownRequirements = ingredients.filter(
      (entry) => entry.hasEnoughStock == null,
    );
    const requirementsAvailable =
      knownShortages.length > 0
        ? false
        : unknownRequirements.length > 0
          ? null
          : true;
    const knownCoverages = ingredients
      .map((entry) => entry.stockCoverage)
      .filter((coverage): coverage is number => coverage != null);
    const requirementStockCoverage = knownCoverages.length
      ? Math.min(...knownCoverages)
      : null;
    const bottleneckCandidates = ingredients
      .map((entry) => ingredientBottlenecks.get(entry.itemId) ?? null)
      .filter((entry): entry is Bottleneck => entry !== null);
    const bottleneckRequirement =
      bottleneckCandidates.sort((a, b) => a.coverage - b.coverage)[0] ?? null;

    const outputs = [recipe.output, ...recipe.extraOutputs];
    let grossRevenue = 0;
    let pricedOutputs = 0;
    for (const output of outputs) {
      const market = markets.get(output.itemId);
      if (
        market &&
        market.source !== "unavailable" &&
        market.currentPrice > 0
      ) {
        grossRevenue +=
          expectedQuantity(output, recipe, assumptions, craftCount) *
          market.currentPrice;
        pricedOutputs++;
      } else {
        issues.push(`Output price unavailable for ${output.itemName}.`);
      }
    }

    const revenue = pricedOutputs === outputs.length ? grossRevenue : null;
    const netRevenue =
      revenue == null ? null : revenue * assumptions.saleMultiplier;
    const profitPerBatch =
      materialCost == null || netRevenue == null
        ? null
        : netRevenue - materialCost;
    const seconds =
      recipe.baseCraftSeconds ?? assumptions.craftSeconds[recipe.lifeSkill];
    const totalSeconds = seconds * craftCount;
    const profitPerHour =
      profitPerBatch == null || totalSeconds <= 0
        ? null
        : profitPerBatch * (3600 / totalSeconds);
    const outputMarket = markets.get(recipe.output.itemId);
    const averageDailySales = dailySales(outputMarket);
    const expectedOutput = expectedQuantity(
      recipe.output,
      recipe,
      assumptions,
      craftCount,
    );
    const estimatedDaysToSellBatch =
      averageDailySales != null && averageDailySales > 0
        ? expectedOutput / averageDailySales
        : null;
    const demandCapacityPerHour =
      averageDailySales == null ? null : averageDailySales / 24;
    const outputPerHour =
      totalSeconds > 0 ? expectedOutput * (3600 / totalSeconds) : 0;
    const realizableRatio =
      demandCapacityPerHour == null || outputPerHour <= 0
        ? null
        : Math.min(1, demandCapacityPerHour / outputPerHour);
    const realizableProfitPerHour =
      profitPerHour == null || realizableRatio == null
        ? null
        : profitPerHour * realizableRatio;

    return {
      recipe,
      craftCount,
      expectedOutputQuantity: expectedOutput,
      materialCost,
      grossRevenue: revenue,
      netRevenue,
      profitPerBatch,
      profitPerHour,
      realizableProfitPerHour,
      marginPercent:
        profitPerBatch == null || !materialCost
          ? null
          : (profitPerBatch / materialCost) * 100,
      demandScore: calculateDemandScore(outputMarket),
      liquidityScore: calculateLiquidityScore(outputMarket),
      outputPrice:
        outputMarket?.source === "unavailable"
          ? null
          : (outputMarket?.currentPrice ?? null),
      outputSellOrders:
        outputMarket?.source === "unavailable"
          ? null
          : (outputMarket?.sellOrders ?? null),
      outputBuyOrders:
        outputMarket?.source === "unavailable"
          ? null
          : (outputMarket?.buyOrders ?? null),
      averageDailySales,
      fourteenDaySales: outputMarket?.fourteenDayVolume ?? null,
      stockToDailySales:
        averageDailySales != null && averageDailySales > 0
          ? (outputMarket?.sellOrders ?? 0) / averageDailySales
          : null,
      estimatedDaysToSellBatch,
      marketUpdatedAt: outputMarket?.updatedAt ?? null,
      marketSource: outputMarket?.source ?? "unavailable",
      requirementsAvailable,
      requirementStockCoverage,
      insufficientRequirementCount: knownShortages.length,
      unavailableRequirementCount: unknownRequirements.length,
      bottleneckRequirement,
      priceCoverage:
        (pricedIngredients + pricedOutputs) /
        Math.max(1, ingredients.length + outputs.length),
      ingredients,
      issues,
    };
  }

  return roots.map((recipe) => evaluate(recipe, assumptions.batchSize));
}

export function calculateCraftGuide(
  recipes: CraftRecipe[],
  marketRows: MarketData[],
  assumptions: CraftAssumptions,
  recipeId: string,
): CraftProfitResult | null {
  const recipe = recipes.find((entry) => entry.id === recipeId);
  if (!recipe) return null;
  return calculateCraftProfits(recipes, marketRows, assumptions, true, [
    recipe,
  ])[0];
}

function expectedQuantity(
  output: RecipeOutput,
  recipe: CraftRecipe,
  assumptions: CraftAssumptions,
  craftCount: number,
): number {
  return expectedQuantityPerCraft(output, recipe, assumptions) * craftCount;
}

function expectedQuantityPerCraft(
  output: RecipeOutput,
  recipe: CraftRecipe,
  assumptions: CraftAssumptions,
): number {
  const multiplier =
    output.kind === "rare"
      ? assumptions.rareYield[recipe.lifeSkill]
      : output.kind === "byproduct"
        ? 1
        : assumptions.normalYield[recipe.lifeSkill];
  return output.quantity * multiplier;
}

function unavailable(recipe: CraftRecipe, issue: string): CraftProfitResult {
  return {
    recipe,
    craftCount: 0,
    expectedOutputQuantity: 0,
    materialCost: null,
    grossRevenue: null,
    netRevenue: null,
    profitPerBatch: null,
    profitPerHour: null,
    realizableProfitPerHour: null,
    marginPercent: null,
    demandScore: 0,
    liquidityScore: 0,
    outputPrice: null,
    outputSellOrders: null,
    outputBuyOrders: null,
    averageDailySales: null,
    fourteenDaySales: null,
    stockToDailySales: null,
    estimatedDaysToSellBatch: null,
    marketUpdatedAt: null,
    marketSource: "unavailable",
    requirementsAvailable: null,
    requirementStockCoverage: null,
    insufficientRequirementCount: 0,
    unavailableRequirementCount: 0,
    bottleneckRequirement: null,
    priceCoverage: 0,
    ingredients: [],
    issues: [issue],
  };
}

function dailySales(market?: MarketData): number | null {
  if (!market || market.source === "unavailable") return null;
  if (market.averageDailyVolume != null) return market.averageDailyVolume;
  if (market.fourteenDayVolume != null) return market.fourteenDayVolume / 14;
  return market.transactionVolume ?? null;
}
