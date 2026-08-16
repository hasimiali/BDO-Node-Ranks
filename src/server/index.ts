import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createMarketProvider } from "./market/index.js";
import { JsonItemRepository, JsonNodeRepository } from "./repositories/JsonRepository.js";
import { RankingService } from "./services/rankingService.js";
import { getDataBundle, writeDataBundle } from "./repositories/JsonRepository.js";
import { validateDataBundle } from "../shared/validation.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const nodeRepository = new JsonNodeRepository();
const itemRepository = new JsonItemRepository();
const marketRegions = new Set(["NA", "EU", "ASIA", "MENA", "JP", "KR", "TW", "SA", "RU", "CEU", "CNA", "CAS"]);
const marketProviders = new Map<string, ReturnType<typeof createMarketProvider>>();

function marketProviderFor(value: unknown) {
  const requested = String(value ?? process.env.BDO_MARKET_REGION ?? "ASIA").toUpperCase();
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

app.get("/api/rankings", async (req, res, next) => {
  try {
    res.json(await new RankingService(marketProviderFor(req.query.region), nodeRepository).getRankings());
  } catch (error) {
    next(error);
  }
});

app.get("/api/rankings/:id", async (req, res, next) => {
  try {
    const ranking = await new RankingService(marketProviderFor(req.query.region), nodeRepository).getNodeRanking(Number(req.params.id));
    if (!ranking) return res.status(404).json({ error: "Node not found" });
    res.json(ranking);
  } catch (error) {
    next(error);
  }
});

app.get("/api/items/:id/market", async (req, res, next) => {
  try {
    res.json(await marketProviderFor(req.query.region).getItemMarketData(Number(req.params.id)));
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
  res.json({ provider: marketProvider.name, region: marketProvider.region, available: true, updatedAt: new Date().toISOString(), message: "Unofficial market provider. Failures return unavailable/stale data." });
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
    const hasErrors = validation.issues.some((issue) => issue.severity === "error");
    if (hasErrors) return res.status(400).json(validation);
    await writeDataBundle(req.body);
    res.json(validation);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`BDO Node Optimizer API listening on http://localhost:${port}`);
});
