import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createMarketProvider } from "./market/index.js";
import {
  JsonItemRepository,
  JsonNodeRepository,
  JsonRecipeRepository,
} from "./repositories/JsonRepository.js";
import { RankingService } from "./services/rankingService.js";
import {
  getDataBundle,
  getMapNetwork,
  writeDataBundle,
} from "./repositories/JsonRepository.js";
import { validateDataBundle } from "../shared/validation.js";
import {
  calculateCraftGuide,
  calculateCraftProfits,
} from "../calculations/crafting.js";
import type { CraftAssumptions, Item, LifeSkill } from "../shared/models.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const nodeRepository = new JsonNodeRepository();
const itemRepository = new JsonItemRepository();
const recipeRepository = new JsonRecipeRepository();
const marketRegions = new Set([
  "NA",
  "EU",
  "ASIA",
  "MENA",
  "JP",
  "KR",
  "TW",
  "SA",
  "RU",
  "CEU",
  "CNA",
  "CAS",
]);
const marketProviders = new Map<
  string,
  ReturnType<typeof createMarketProvider>
>();

function marketProviderFor(value: unknown) {
  const requested = String(
    value ?? process.env.BDO_MARKET_REGION ?? "ASIA",
  ).toUpperCase();
  const region = marketRegions.has(requested) ? requested : "ASIA";
  let provider = marketProviders.get(region);
  if (!provider) {
    provider = createMarketProvider(region);
    marketProviders.set(region, provider);
  }
  return provider;
}

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/nodes", async (_req, res, next) => {
  try {
    res.json(await nodeRepository.getAll());
  } catch (error) {
    next(error);
  }
});

app.get("/api/nodes/:id", async (req, res, next) => {
  try {
    const node = await nodeRepository.getById(Number(req.params.id));
    if (!node) return res.status(404).json({ error: "Node not found" });
    res.json(node);
  } catch (error) {
    next(error);
  }
});

app.get("/api/map/network", async (_req, res, next) => {
  try {
    res.json(await getMapNetwork());
  } catch (error) {
    next(error);
  }
});

app.get("/api/rankings", async (req, res, next) => {
  try {
    res.json(
      await new RankingService(
        marketProviderFor(req.query.region),
        nodeRepository,
      ).getRankings(),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/rankings/:id", async (req, res, next) => {
  try {
    const ranking = await new RankingService(
      marketProviderFor(req.query.region),
      nodeRepository,
    ).getNodeRanking(Number(req.params.id));
    if (!ranking) return res.status(404).json({ error: "Node not found" });
    res.json(ranking);
  } catch (error) {
    next(error);
  }
});

app.get("/api/items/:id/market", async (req, res, next) => {
  try {
    res.json(
      await marketProviderFor(req.query.region).getItemMarketData(
        Number(req.params.id),
      ),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/items/search", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "")
      .trim()
      .toLocaleLowerCase();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    if (!query) return res.json([]);
    const [items, recipes] = await Promise.all([
      itemRepository.getAll(),
      recipeRepository.getAll(),
    ]);
    const merged = new Map<number, Item>(items.map((item) => [item.id, item]));
    for (const recipe of recipes) {
      const recipeItems = [
        recipe.output,
        ...recipe.extraOutputs,
        ...recipe.ingredients.flatMap((group) => group.alternatives),
      ];
      for (const item of recipeItems)
        if (!merged.has(item.itemId))
          merged.set(item.itemId, {
            id: item.itemId,
            name: item.itemName,
            category: "Crafting",
            source: recipe.source.provider,
            confidence: recipe.confidence,
          });
    }
    const numericId = Number(query);
    const results = [...merged.values()]
      .filter(
        (item) =>
          item.name.toLocaleLowerCase().includes(query) ||
          (Number.isFinite(numericId) && item.id === numericId),
      )
      .sort(
        (a, b) =>
          searchPriority(a, query, numericId) -
            searchPriority(b, query, numericId) || a.name.localeCompare(b.name),
      )
      .slice(0, limit)
      .map((item) => ({
        ...item,
        producedByRecipeCount: recipes.filter(
          (recipe) =>
            recipe.output.itemId === item.id ||
            recipe.extraOutputs.some((output) => output.itemId === item.id),
        ).length,
        usedByRecipeCount: recipes.filter((recipe) =>
          recipe.ingredients.some((group) =>
            group.alternatives.some((entry) => entry.itemId === item.id),
          ),
        ).length,
      }));
    res.json(results);
  } catch (error) {
    next(error);
  }
});

app.post("/api/market/items", async (req, res, next) => {
  try {
    const ids: number[] = [
      ...new Set<number>(
        (Array.isArray(req.body.itemIds) ? req.body.itemIds : [])
          .map((value: unknown) => Number(value))
          .filter((id: number) => Number.isInteger(id) && id > 0),
      ),
    ].slice(0, 200);
    const provider = marketProviderFor(req.body.region);
    const rows = provider.getItemsMarketData
      ? await provider.getItemsMarketData(ids)
      : await Promise.all(ids.map((id) => provider.getItemMarketData(id)));
    res.json({
      region: provider.region,
      items: Object.fromEntries(rows.map((row) => [row.itemId, row])),
      unavailableItemIds: rows
        .filter((row) => row.source === "unavailable")
        .map((row) => row.itemId),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/recipes", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "")
      .trim()
      .toLocaleLowerCase();
    const skill = String(req.query.lifeSkill ?? "");
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const recipes = (await recipeRepository.getAll())
      .filter(
        (recipe) =>
          (!query ||
            `${recipe.name} ${recipe.ingredients.flatMap((group) => group.alternatives.map((item) => item.itemName)).join(" ")}`
              .toLocaleLowerCase()
              .includes(query)) &&
          (!skill || recipe.lifeSkill === skill),
      )
      .slice(0, limit);
    res.json(recipes);
  } catch (error) {
    next(error);
  }
});

app.get("/api/recipes/:id", async (req, res, next) => {
  try {
    const recipe = await recipeRepository.getById(req.params.id);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

app.post("/api/crafting/rank", async (req, res, next) => {
  try {
    const recipes = await recipeRepository.getAll();
    const requestedSkills = new Set<LifeSkill>(
      Array.isArray(req.body.lifeSkills)
        ? req.body.lifeSkills
        : ["cooking", "alchemy", "processing"],
    );
    const filtered = recipes.filter((recipe) =>
      requestedSkills.has(recipe.lifeSkill),
    );
    const ids = [
      ...new Set(
        filtered.flatMap((recipe) => [
          recipe.output.itemId,
          ...recipe.extraOutputs.map((output) => output.itemId),
          ...recipe.ingredients.flatMap((group) =>
            group.alternatives
              .filter((item) => !item.vendorPrice)
              .map((item) => item.itemId),
          ),
        ]),
      ),
    ];
    const provider = marketProviderFor(req.body.region);
    const marketRows = provider.getItemsMarketData
      ? await provider.getItemsMarketData(ids)
      : await Promise.all(ids.map((id) => provider.getItemMarketData(id)));
    const assumptions = normalizeCraftAssumptions(req.body.assumptions);
    res.json(calculateCraftProfits(filtered, marketRows, assumptions));
  } catch (error) {
    next(error);
  }
});

app.post("/api/crafting/guide/:recipeId", async (req, res, next) => {
  try {
    const recipes = await recipeRepository.getAll();
    const recipe = recipes.find((entry) => entry.id === req.params.recipeId);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    const ids = [
      ...new Set(
        recipes.flatMap((entry) => [
          entry.output.itemId,
          ...entry.extraOutputs.map((output) => output.itemId),
          ...entry.ingredients.flatMap((group) =>
            group.alternatives
              .filter((item) => !item.vendorPrice)
              .map((item) => item.itemId),
          ),
        ]),
      ),
    ];
    const provider = marketProviderFor(req.body.region);
    const marketRows = provider.getItemsMarketData
      ? await provider.getItemsMarketData(ids)
      : await Promise.all(ids.map((id) => provider.getItemMarketData(id)));
    const guide = calculateCraftGuide(
      recipes,
      marketRows,
      normalizeCraftAssumptions(req.body.assumptions),
      recipe.id,
    );
    res.json(guide);
  } catch (error) {
    next(error);
  }
});

app.get("/api/items", async (_req, res, next) => {
  try {
    res.json(await itemRepository.getAll());
  } catch (error) {
    next(error);
  }
});

app.get("/api/items/:id", async (req, res, next) => {
  try {
    const item = await itemRepository.getById(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.get("/api/market/status", (req, res) => {
  const marketProvider = marketProviderFor(req.query.region);
  res.json({
    provider: marketProvider.name,
    region: marketProvider.region,
    available: true,
    updatedAt: new Date().toISOString(),
    message:
      "Unofficial market provider. Failures return unavailable/stale data.",
  });
});

app.get("/api/data/export", async (_req, res, next) => {
  try {
    res.json(await getDataBundle());
  } catch (error) {
    next(error);
  }
});

app.get("/api/data/validate", async (_req, res, next) => {
  try {
    res.json(validateDataBundle(await getDataBundle()));
  } catch (error) {
    next(error);
  }
});

app.post("/api/data/validate", (req, res) => {
  res.json(validateDataBundle(req.body));
});

app.post("/api/data/import", async (req, res, next) => {
  try {
    const validation = validateDataBundle(req.body);
    const hasErrors = validation.issues.some(
      (issue) => issue.severity === "error",
    );
    if (hasErrors) return res.status(400).json(validation);
    await writeDataBundle(req.body);
    res.json(validation);
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  },
);

app.listen(port, () => {
  console.log(`BDO Profit Lab API listening on http://localhost:${port}`);
});

function searchPriority(item: Item, query: string, numericId: number): number {
  if (item.id === numericId) return 0;
  const name = item.name.toLocaleLowerCase();
  if (name === query) return 1;
  if (name.startsWith(query)) return 2;
  return 3;
}

function normalizeCraftAssumptions(
  value: Partial<CraftAssumptions> | undefined,
): CraftAssumptions {
  const skills: LifeSkill[] = ["cooking", "alchemy", "processing"];
  const record = (
    input: Partial<Record<LifeSkill, number>> | undefined,
    fallback: number,
  ) =>
    Object.fromEntries(
      skills.map((skill) => [
        skill,
        Number.isFinite(input?.[skill]) ? Number(input![skill]) : fallback,
      ]),
    ) as Record<LifeSkill, number>;
  return {
    mastery: record(value?.mastery, 0),
    craftSeconds: record(value?.craftSeconds, 2),
    saleMultiplier: Math.min(
      1,
      Math.max(0, Number(value?.saleMultiplier) || 0.845),
    ),
    batchSize: Math.min(100000, Math.max(1, Number(value?.batchSize) || 1)),
    recursiveCrafting: value?.recursiveCrafting !== false,
    maxCraftDepth: Math.min(10, Math.max(0, Number(value?.maxCraftDepth) || 5)),
    normalYield: record(value?.normalYield, 2.5),
    rareYield: record(value?.rareYield, 0.3),
  };
}
