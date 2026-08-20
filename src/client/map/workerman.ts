export const WORKERMAN_EXTENT = {
  minX: -67 * 2 * 12800,
  minY: -71 * 2 * 12800,
  maxX: 58 * 2 * 12800,
  maxY: 35 * 2 * 12800,
} as const;

export const WORKERMAN_VIEW = {
  initialZoom: -8,
  minZoom: -12,
  maxZoom: -5,
  zoomOffset: 14,
  tileSize: 200,
} as const;

export interface GamePosition {
  x: number;
  z: number;
}

export function gameToMapPosition(position: GamePosition): [number, number] {
  return [-position.z, position.x];
}

export function gameToCartesianPosition(position: GamePosition): [number, number] {
  return [position.x, -position.z];
}

export function boundsForPositions(positions: GamePosition[]) {
  if (!positions.length) return null;
  const points = positions.map(gameToMapPosition);
  return {
    minY: Math.min(...points.map(([y]) => y)),
    minX: Math.min(...points.map(([, x]) => x)),
    maxY: Math.max(...points.map(([y]) => y)),
    maxX: Math.max(...points.map(([, x]) => x)),
  };
}

export function isRemoteProductionNode(
  node: Pick<WorkerNode, "productionCategory">,
): boolean {
  return (
    /^Fish Drying Yard(?: \d+)?$/i.test(node.productionCategory) ||
    /^Chiro's .+ Workshop$/i.test(node.productionCategory)
  );
}

export function nodeMatchesMapScope(
  node: Pick<WorkerNode, "productionCategory">,
  scope: MapScope,
): boolean {
  if (scope === "all") return true;
  return scope === "remote"
    ? isRemoteProductionNode(node)
    : !isRemoteProductionNode(node);
}

export function scopeForNode(
  node: Pick<WorkerNode, "productionCategory">,
): Exclude<MapScope, "all"> {
  return isRemoteProductionNode(node) ? "remote" : "mainland";
}

export function largestPositionCluster<T extends { position?: GamePosition }>(
  values: T[],
  maxDistance = 150_000,
): T[] {
  const positioned = values.filter(
    (value): value is T & { position: GamePosition } => Boolean(value.position),
  );
  const remaining = new Set(positioned.map((_, index) => index));
  let largest: number[] = [];
  while (remaining.size) {
    const seed = remaining.values().next().value as number;
    const queue = [seed];
    const cluster: number[] = [];
    remaining.delete(seed);
    while (queue.length) {
      const index = queue.pop()!;
      cluster.push(index);
      for (const candidate of [...remaining]) {
        const dx = positioned[index].position.x - positioned[candidate].position.x;
        const dz = positioned[index].position.z - positioned[candidate].position.z;
        if (Math.hypot(dx, dz) <= maxDistance) {
          remaining.delete(candidate);
          queue.push(candidate);
        }
      }
    }
    if (cluster.length > largest.length) largest = cluster;
  }
  return largest.sort((a, b) => a - b).map((index) => positioned[index]);
}

export function markerRadiusForZoom(
  zoom: number,
  kind: "normal" | "top" | "selected",
): number {
  const detail = zoom >= -7 ? 2 : zoom >= -9 ? 1 : 0;
  const base = kind === "selected" ? 6 : kind === "top" ? 4 : 2;
  return base + detail;
}

export function explorationIconSize(
  node: {
    kind: number;
    cpCost: number;
    isPlantzone?: boolean;
    isTown?: boolean;
  },
  selected = false,
  background = false,
): number {
  if (selected) return 82;
  if (background) return node.isPlantzone ? 22 : 30;
  const isTown =
    node.isTown === true ||
    (node.kind > 0 && node.kind < 3 && node.cpCost === 0);
  if (isTown) return 68;
  if (node.isPlantzone) return 30;
  return 52;
}

export function explorationIconScaleForZoom(zoom: number): number {
  if (zoom <= -11) return 0.65;
  if (zoom <= -10) return 0.8;
  if (zoom <= -8) return 1;
  if (zoom <= -7) return 1.15;
  if (zoom <= -6) return 1.35;
  return 1.6;
}

export function parentConnectionForNode(
  node: Pick<WorkerNode, "id" | "position" | "parentNode">,
) {
  if (!node.position || !node.parentNode) return null;
  return {
    productionId: node.id,
    parentId: node.parentNode.id,
    parentName: node.parentNode.name,
    start: gameToCartesianPosition(node.parentNode.position),
    end: gameToCartesianPosition(node.position),
  };
}

export interface WorkermanViewState {
  target: [number, number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export function fitOrthographicView(
  positions: GamePosition[],
  viewport: { width: number; height: number },
  options: { padding?: number; maxZoom?: number } = {},
): WorkermanViewState {
  const padding = options.padding ?? 48;
  const maxZoom = options.maxZoom ?? -7;
  if (!positions.length) {
    return {
      target: [0, 0, 0],
      zoom: WORKERMAN_VIEW.initialZoom,
      minZoom: WORKERMAN_VIEW.minZoom,
      maxZoom: WORKERMAN_VIEW.maxZoom,
    };
  }
  const points = positions.map(gameToCartesianPosition);
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  const worldWidth = Math.max(1, maxX - minX);
  const worldHeight = Math.max(1, maxY - minY);
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = Math.max(
    WORKERMAN_VIEW.minZoom,
    Math.min(
      WORKERMAN_VIEW.maxZoom,
      maxZoom,
      Math.log2(Math.min(availableWidth / worldWidth, availableHeight / worldHeight)),
    ),
  );
  return {
    target: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
    zoom,
    minZoom: WORKERMAN_VIEW.minZoom,
    maxZoom: WORKERMAN_VIEW.maxZoom,
  };
}
import type { WorkerNode } from "../../shared/models";

export type MapScope = "mainland" | "remote" | "all";
