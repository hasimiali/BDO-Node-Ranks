import { describe, expect, it } from "vitest";
import { calculateCycleTime, calculateCyclesPerDay } from "./cycle.js";
import { calculateDemandScore } from "./demand.js";
import { calculateLiquidityScore } from "./liquidity.js";
import { calculateOverallScore } from "./score.js";
import { calculateExpectedYield } from "./yield.js";
import { calculateRealizableValue, calculateSilverPerCP, calculateSilverPerDay, calculateTheoreticalValue } from "./profitability.js";
import type { MarketData, WorkerNode, WorkerPreset } from "../shared/models.js";

const worker: WorkerPreset = { id: "artisan-goblin", name: "Artisan Goblin", workSpeed: 150, movementSpeed: 7.5, luck: 0, endurance: 0 };
const node: WorkerNode = {
  id: 1,
  name: "Test Node",
  region: "Balenos",
  type: "Mining",
  productionCategory: "Ore/Mineral",
  cpCost: 2,
  workload: 200,
  distance: 450,
  products: [],
  source: "test",
  confidence: "estimated"
};

const market: MarketData = {
  itemId: 1,
  currentPrice: 1000,
  buyOrders: 5000,
  sellOrders: 100,
  transactionVolume: 100000,
  updatedAt: new Date().toISOString(),
  source: "real"
};

describe("cycle calculations", () => {
  it("calculates cycle time with workload and travel", () => {
    const result = calculateCycleTime(node, worker);
    expect(result.workMinutes).toBe(20);
    expect(result.travelMinutes).toBe(2);
    expect(result.cycleTimeMinutes).toBe(22);
  });

  it("marks missing workload incomplete", () => {
    const result = calculateCycleTime({ ...node, workload: null }, worker);
    expect(result.cycleTimeMinutes).toBeNull();
    expect(result.issues).toContain("Workload missing");
  });

  it("calculates cycles per day", () => {
    expect(calculateCyclesPerDay(60)).toBe(24);
  });
});

describe("yield and profitability", () => {
  it("calculates expected yield", () => {
    expect(calculateExpectedYield(2.5, 10)).toBe(25);
  });

  it("calculates theoretical and realizable value", () => {
    expect(calculateTheoreticalValue(25, 1000)).toBe(25000);
    expect(calculateRealizableValue(25000, 0.82)).toBe(20500);
  });

  it("handles missing market price", () => {
    expect(calculateTheoreticalValue(25, undefined)).toBeNull();
  });

  it("handles zero CP", () => {
    expect(calculateSilverPerCP(1000, 0)).toBeNull();
  });

  it("sums silver per day", () => {
    expect(calculateSilverPerDay([100, null, 50])).toBe(150);
  });
});

describe("market scoring", () => {
  it("scores demand and liquidity", () => {
    expect(calculateDemandScore(market)).toBeGreaterThan(50);
    expect(calculateLiquidityScore(market)).toBeGreaterThan(40);
  });

  it("penalizes unavailable market", () => {
    expect(calculateDemandScore()).toBe(0);
    expect(calculateLiquidityScore()).toBe(0);
  });

  it("penalizes extreme sell pressure", () => {
    expect(calculateLiquidityScore({ ...market, buyOrders: 0, sellOrders: 100000, transactionVolume: 0 })).toBeLessThan(20);
  });
});

describe("overall score", () => {
  it("combines weighted scores", () => {
    expect(calculateOverallScore({ profitabilityScore: 100, silverPerCpScore: 50, demandScore: 25, liquidityScore: 10, weights: { profitability: 0.4, silverPerCp: 0.3, demand: 0.2, liquidity: 0.1 } })).toBe(61);
  });
});
