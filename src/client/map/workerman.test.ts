import { describe, expect, it } from "vitest";
import {
  WORKERMAN_EXTENT,
  boundsForPositions,
  gameToMapPosition,
  gameToCartesianPosition,
  fitOrthographicView,
  explorationIconSize,
  explorationIconScaleForZoom,
  isRemoteProductionNode,
  largestPositionCluster,
  markerRadiusForZoom,
  nodeMatchesMapScope,
  parentConnectionForNode,
  scopeForNode,
} from "./workerman";

describe("Workerman map coordinates", () => {
  it("converts game X/Z into Leaflet Y/X without mirroring markers", () => {
    expect(gameToMapPosition({ x: 100, z: 250 })).toEqual([-250, 100]);
    expect(gameToMapPosition({ x: -10, z: -20 })).toEqual([20, -10]);
  });

  it("converts game X/Z into Workerman Cartesian X/-Z", () => {
    expect(gameToCartesianPosition({ x: 100, z: 250 })).toEqual([100, -250]);
  });

  it("classifies mainland and remote production categories", () => {
    const mainland = { productionCategory: "Potato Farming" };
    const fishing = { productionCategory: "Fish Drying Yard 2" };
    const workshop = { productionCategory: "Chiro's Cannon Workshop" };
    expect(isRemoteProductionNode(mainland)).toBe(false);
    expect(isRemoteProductionNode(fishing)).toBe(true);
    expect(isRemoteProductionNode(workshop)).toBe(true);
    expect(nodeMatchesMapScope(mainland, "mainland")).toBe(true);
    expect(nodeMatchesMapScope(fishing, "remote")).toBe(true);
    expect(nodeMatchesMapScope(fishing, "all")).toBe(true);
    expect(scopeForNode(workshop)).toBe("remote");
  });

  it("returns the largest connected position cluster", () => {
    const values = [
      { id: 1, position: { x: 0, z: 0 } },
      { id: 2, position: { x: 50, z: 0 } },
      { id: 3, position: { x: 100, z: 0 } },
      { id: 4, position: { x: 1000, z: 1000 } },
    ];
    expect(largestPositionCluster(values, 100).map((value) => value.id)).toEqual([
      1, 2, 3,
    ]);
    expect(largestPositionCluster([], 100)).toEqual([]);
  });

  it("reduces marker weight at world overview zoom", () => {
    expect(markerRadiusForZoom(-12, "normal")).toBe(2);
    expect(markerRadiusForZoom(-8, "normal")).toBe(3);
    expect(markerRadiusForZoom(-5, "normal")).toBe(4);
    expect(markerRadiusForZoom(-12, "selected")).toBe(6);
    expect(markerRadiusForZoom(-5, "selected")).toBe(8);
  });

  it("makes towns larger than regular exploration nodes", () => {
    expect(explorationIconSize({ kind: 0, cpCost: 1 })).toBe(52);
    expect(
      explorationIconSize({ kind: 4, cpCost: 1, isPlantzone: true }),
    ).toBe(30);
    expect(explorationIconSize({ kind: 2, cpCost: 0 })).toBe(68);
    expect(explorationIconSize({ kind: 1, cpCost: 0 })).toBe(68);
    expect(explorationIconSize({ kind: 2, cpCost: 1 })).toBe(52);
    expect(explorationIconSize({ kind: 0, cpCost: 1 }, true)).toBe(82);
    expect(explorationIconSize({ kind: 9, cpCost: 1 }, false, true)).toBe(
      30,
    );
    expect(
      explorationIconSize(
        { kind: 4, cpCost: 1, isPlantzone: true },
        false,
        true,
      ),
    ).toBe(22);
  });

  it("scales exploration icons up as the map zooms in", () => {
    expect(explorationIconScaleForZoom(-12)).toBe(0.65);
    expect(explorationIconScaleForZoom(-10)).toBe(0.8);
    expect(explorationIconScaleForZoom(-8)).toBe(1);
    expect(explorationIconScaleForZoom(-7)).toBe(1.15);
    expect(explorationIconScaleForZoom(-6)).toBe(1.35);
    expect(explorationIconScaleForZoom(-5)).toBe(1.6);
  });

  it("connects a production node to its Workerman parent node", () => {
    expect(
      parentConnectionForNode({
        id: 131,
        position: { x: 12011.9, y: -4261.05, z: 61621.5 },
        parentNode: {
          id: 21,
          name: "Bartali Farm",
          kind: 5,
          cpCost: 1,
          position: { x: 11684.6, y: -4390.19, z: 56102.5 },
        },
      }),
    ).toEqual({
      productionId: 131,
      parentId: 21,
      parentName: "Bartali Farm",
      start: [11684.6, -56102.5],
      end: [12011.9, -61621.5],
    });
    expect(parentConnectionForNode({ id: 1 })).toBeNull();
  });

  it("fits Cartesian bounds into an orthographic viewport", () => {
    const view = fitOrthographicView(
      [
        { x: -100, z: -50 },
        { x: 100, z: 50 },
      ],
      { width: 400, height: 300 },
      { padding: 50, maxZoom: 2 },
    );
    expect(view.target).toEqual([0, 0, 0]);
    expect(view.zoom).toBe(-5);
    expect(fitOrthographicView([], { width: 400, height: 300 }).zoom).toBe(-8);
  });

  it("uses the exact Workerman extent", () => {
    expect(WORKERMAN_EXTENT).toEqual({
      minX: -1_715_200,
      minY: -1_817_600,
      maxX: 1_484_800,
      maxY: 896_000,
    });
  });

  it("calculates bounds from visible node positions", () => {
    expect(
      boundsForPositions([
        { x: 100, z: 250 },
        { x: -50, z: -30 },
      ]),
    ).toEqual({ minY: -250, minX: -50, maxY: 30, maxX: 100 });
    expect(boundsForPositions([])).toBeNull();
  });
});
