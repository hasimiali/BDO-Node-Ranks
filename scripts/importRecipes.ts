import fs from "node:fs/promises";
import path from "node:path";
import type { CraftRecipe, LifeSkill } from "../src/shared/models.js";

const baseUrl = process.env.BDOLYTICS_BASE_URL ?? "https://bdolytics.com";
const inputPath = process.argv[2];
const importedAt = new Date().toISOString();

interface SourceRecipe {
  recipeKey: string;
  productItemId: number;
  lifeskillType: LifeSkill;
  processingType?: string;
  processingTime?: number;
  minProc: number;
  maxProc: number;
  ingredients: Array<{ type: "item"; itemId: number; quantity: number } | { type: "group"; groupId: number; quantity: number }>;
  rareProc?: { itemId: number; minProc: number; maxProc: number; procChance: number | null };
}
interface MaterialGroup { groupId: number; items: Array<{ itemId: number; value: number }>; }
interface Metadata { id: number; name?: string; vendorPrice?: number | null; }

const recipes = inputPath ? await readNormalized(inputPath) : await importOnline();
validate(recipes);
await fs.writeFile(path.resolve("src/data/recipes.json"), JSON.stringify(recipes, null, 2) + "\n");
const counts = Object.fromEntries((["cooking", "alchemy", "processing"] as LifeSkill[]).map((skill) => [skill, recipes.filter((recipe) => recipe.lifeSkill === skill).length]));
console.log(`Imported ${recipes.length} recipes (${counts.cooking} cooking, ${counts.alchemy} alchemy, ${counts.processing} processing).`);

async function importOnline(): Promise<CraftRecipe[]> {
  const [sourceRecipes, groups, metadata] = await Promise.all([
    trpc<SourceRecipe[]>("calculator.getCraftingRecipes"),
    trpc<MaterialGroup[]>("calculator.getMaterialGroups"),
    trpc<Record<string, Metadata>>("calculator.getCraftingItemMetadata", { language: "en" }),
  ]);
  const groupMap = new Map(groups.map((group) => [group.groupId, group]));
  const itemName = (id: number) => metadata[String(id)]?.name?.trim() || `Item ${id}`;
  return sourceRecipes.map((recipe): CraftRecipe => ({
    id: recipe.recipeKey,
    name: itemName(recipe.productItemId),
    lifeSkill: recipe.lifeskillType,
    method: humanize(recipe.processingType ?? recipe.lifeskillType),
    output: { itemId: recipe.productItemId, itemName: itemName(recipe.productItemId), quantity: average(recipe.minProc, recipe.maxProc) },
    extraOutputs: recipe.rareProc ? [{ itemId: recipe.rareProc.itemId, itemName: itemName(recipe.rareProc.itemId), quantity: average(recipe.rareProc.minProc, recipe.rareProc.maxProc) * (recipe.rareProc.procChance ?? 1), kind: "rare" }] : [],
    ingredients: recipe.ingredients.map((ingredient) => ({
      quantity: ingredient.quantity,
      alternatives: ingredient.type === "item"
        ? [{ itemId: ingredient.itemId, itemName: itemName(ingredient.itemId), vendorPrice: metadata[String(ingredient.itemId)]?.vendorPrice ?? undefined }]
        : (groupMap.get(ingredient.groupId)?.items ?? []).map((item) => ({ itemId: item.itemId, itemName: itemName(item.itemId), equivalence: item.value, vendorPrice: metadata[String(item.itemId)]?.vendorPrice ?? undefined })),
    })),
    baseCraftSeconds: recipe.processingTime,
    source: { provider: "BDOLytics", url: `${baseUrl}/en/NA/${recipe.lifeskillType}/${encodeURIComponent(recipe.recipeKey)}`, importedAt },
    confidence: "high",
  }));
}

async function trpc<T>(procedure: string, input?: unknown): Promise<T> {
  const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  const response = await fetch(`${baseUrl}/api/trpc/${procedure}${query}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`BDOLytics ${procedure} returned ${response.status}`);
  const body = await response.json() as { result?: { data?: T }; error?: { message?: string } };
  if (body.result?.data === undefined) throw new Error(body.error?.message ?? `BDOLytics ${procedure} returned no data`);
  return body.result.data;
}

async function readNormalized(file: string): Promise<CraftRecipe[]> { return JSON.parse(await fs.readFile(path.resolve(file), "utf8")) as CraftRecipe[]; }
function average(min: number, max: number) { return (Number(min) + Number(max)) / 2; }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function validate(values: CraftRecipe[]) {
  const ids = new Set<string>();
  for (const recipe of values) {
    if (!recipe.id || ids.has(recipe.id)) throw new Error(`Invalid or duplicate recipe ID: ${recipe.id}`);
    ids.add(recipe.id);
    if (!recipe.output?.itemId || !recipe.ingredients.length) throw new Error(`Recipe ${recipe.id} needs an output and ingredients.`);
    if (!recipe.source?.url || !recipe.source.importedAt) throw new Error(`Recipe ${recipe.id} needs source metadata.`);
    for (const group of recipe.ingredients) if (!(group.quantity > 0) || !group.alternatives.length) throw new Error(`Recipe ${recipe.id} has an invalid ingredient group.`);
  }
}
