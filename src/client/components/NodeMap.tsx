import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import DeckGL from "@deck.gl/react";
import {
  COORDINATE_SYSTEM,
  OrthographicView,
  type PickingInfo,
  type ViewStateChangeParameters,
} from "@deck.gl/core";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, IconLayer, LineLayer } from "@deck.gl/layers";
import { Focus, LocateFixed, Minus, Plus } from "lucide-react";
import type { MapNetwork, MapNetworkNode, NodeRanking } from "../../shared/models";
import {
  WORKERMAN_EXTENT,
  WORKERMAN_VIEW,
  fitOrthographicView,
  explorationIconSize,
  explorationIconScaleForZoom,
  gameToCartesianPosition,
  largestPositionCluster,
  parentConnectionForNode,
  type MapScope,
  type WorkermanViewState,
} from "../map/workerman";
import { formatSilver } from "../format";

const MAP_STORAGE_KEY = "bdo-profit-lab-map-view";

export interface NodeMapHandle {
  fitVisible: () => void;
  centerNode: (ranking: NodeRanking) => void;
}

interface NodeMapProps {
  rankings: NodeRanking[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  scope: MapScope;
  network: MapNetwork | null;
}

interface ParentMapNode {
  id: number;
  name: string;
  kind: number;
  cpCost: number;
  position: [number, number];
  productionIds: number[];
}

interface NetworkConnection {
  sourceId: number;
  targetId: number;
  start: [number, number];
  end: [number, number];
  selected: boolean;
}

interface ProductionConnection {
  productionId: number;
  parentId: number;
  parentName: string;
  start: [number, number];
  end: [number, number];
}

function defaultViewState(): WorkermanViewState {
  return {
    target: [0, 0, 0],
    zoom: WORKERMAN_VIEW.initialZoom,
    minZoom: -12,
    maxZoom: WORKERMAN_VIEW.maxZoom,
  };
}

function storedViewState(): WorkermanViewState | null {
  try {
    const stored = JSON.parse(localStorage.getItem(MAP_STORAGE_KEY) ?? "null") as
      | { target?: unknown; zoom?: unknown }
      | null;
    if (
      stored &&
      Array.isArray(stored.target) &&
      stored.target.length >= 2 &&
      stored.target.every(Number.isFinite) &&
      Number.isFinite(stored.zoom)
    ) {
      return {
        target: [Number(stored.target[0]), Number(stored.target[1]), 0],
        zoom: Math.max(-12, Math.min(WORKERMAN_VIEW.maxZoom, Number(stored.zoom))),
        minZoom: -12,
        maxZoom: WORKERMAN_VIEW.maxZoom,
      };
    }
  } catch {
    // Camera persistence is optional.
  }
  return null;
}

export const NodeMap = forwardRef<NodeMapHandle, NodeMapProps>(function NodeMap(
  { rankings, selectedId, onSelect, scope, network },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const restoredCamera = useRef(Boolean(storedViewState()));
  const fittedContext = useRef<string | null>(null);
  const [viewState, setViewState] = useState<WorkermanViewState>(
    () => storedViewState() ?? defaultViewState(),
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rankingKey = rankings.map((ranking) => ranking.node.id).join(",");

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function fitRankings(primaryCluster = false) {
    const entries = rankings.map((ranking) => ({
      ranking,
      position: ranking.node.position,
    }));
    const values = primaryCluster ? largestPositionCluster(entries) : entries;
    const positions = values.flatMap((entry) =>
      entry.position ? [entry.position] : [],
    );
    setViewState(
      fitOrthographicView(positions, size, {
        padding: size.width < 640 ? 20 : 48,
        maxZoom: primaryCluster ? -8 : -7,
      }),
    );
  }

  useEffect(() => {
    if (size.width <= 1 || size.height <= 1) return;
    const context = `${scope}:${rankingKey}`;
    if (fittedContext.current === context) return;
    fittedContext.current = context;
    if (restoredCamera.current) {
      restoredCamera.current = false;
      return;
    }
    fitRankings(scope === "mainland");
  }, [rankingKey, scope, size.width, size.height]);

  useEffect(() => {
    try {
      localStorage.setItem(
        MAP_STORAGE_KEY,
        JSON.stringify({ target: viewState.target, zoom: viewState.zoom }),
      );
    } catch {
      // Camera persistence is optional.
    }
  }, [viewState]);

  useImperativeHandle(
    ref,
    () => ({
      fitVisible: () => fitRankings(false),
      centerNode: (ranking) => {
        if (!ranking.node.position) return;
        const [x, y] = gameToCartesianPosition(ranking.node.position);
        setViewState((current) => ({
          ...current,
          target: [x, y, 0],
          zoom: Math.max(current.zoom, -7),
        }));
      },
    }),
    [rankingKey, size.width, size.height],
  );

  const layers = useMemo(() => {
    const tiles = new TileLayer({
      id: "workerman-tiles",
      data: "https://shrddr.github.io/maptiles/{z}/{x}_{y}.webp",
      minZoom: 0,
      maxZoom: 7,
      tileSize: 256 * 12800,
      zoomOffset: 14,
      extent: [
        WORKERMAN_EXTENT.minX,
        WORKERMAN_EXTENT.minY,
        WORKERMAN_EXTENT.maxX,
        WORKERMAN_EXTENT.maxY,
      ],
      refinementStrategy: "best-available",
      maxRequests: 8,
      onTileError: () => undefined,
      renderSubLayers: (props: any) => {
        const { left, bottom, right, top } = props.tile.bbox;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [left, bottom, right, top],
        });
      },
    });

    const parentById = new Map<number, ParentMapNode>();
    const connections: ProductionConnection[] = [];
    for (const ranking of rankings) {
      const parent = ranking.node.parentNode;
      const productionPosition = ranking.node.position;
      if (!parent || !productionPosition) continue;
      const parentPosition = gameToCartesianPosition(parent.position);
      const existing = parentById.get(parent.id);
      if (existing) existing.productionIds.push(ranking.node.id);
      else {
        parentById.set(parent.id, {
          id: parent.id,
          name: parent.name,
          kind: parent.kind,
          cpCost: parent.cpCost,
          position: parentPosition,
          productionIds: [ranking.node.id],
        });
      }
      const connection = parentConnectionForNode(ranking.node);
      if (connection) connections.push(connection);
    }

    const selectedRanking = rankings.find((ranking) => ranking.node.id === selectedId);
    const selectedParentId = selectedRanking?.node.parentNode?.id ?? null;
    const networkNodeById = new Map((network?.nodes ?? []).map((node) => [node.id, node]));
    const networkConnections: NetworkConnection[] = network
      ? network.edges.flatMap((edge) => {
          const source = networkNodeById.get(edge.sourceId);
          const target = networkNodeById.get(edge.targetId);
          if (!source || !target) return [];
          return [{
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            start: [source.position.x, -source.position.z] as [number, number],
            end: [target.position.x, -target.position.z] as [number, number],
            selected:
              (edge.sourceId === selectedId && edge.targetId === selectedParentId) ||
              (edge.targetId === selectedId && edge.sourceId === selectedParentId),
          }];
        })
      : connections.map((connection) => ({
          sourceId: connection.parentId,
          targetId: connection.productionId,
          start: connection.start,
          end: connection.end,
          selected: connection.productionId === selectedId,
        }));

    const connectionLines = new LineLayer<NetworkConnection>({
      id: "workerman-network-connections",
      data: networkConnections,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getSourcePosition: (connection) => connection.start,
      getTargetPosition: (connection) => connection.end,
      getColor: (connection) =>
        connection.selected
          ? [245, 158, 11, 255]
          : [172, 172, 172, viewState.zoom <= -10 ? 75 : 130],
      getWidth: (connection) => (connection.selected ? 4 : 1.25),
      widthUnits: "pixels",
      widthMinPixels: 1,
      pickable: true,
      updateTriggers: {
        getColor: [selectedId, selectedParentId, viewState.zoom],
        getWidth: [selectedId, selectedParentId],
      },
    });

    const iconData: Array<MapNetworkNode | ParentMapNode> = network?.nodes ?? [...parentById.values()];
    const parents = new IconLayer<MapNetworkNode | ParentMapNode>({
      id: "workerman-exploration-nodes",
      data: iconData,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      pickable: true,
      getPosition: (node) =>
        Array.isArray((node as ParentMapNode).position)
          ? (node as ParentMapNode).position
          : [(node as MapNetworkNode).position.x, -(node as MapNetworkNode).position.z],
      getIcon: (node) => ({
        url: `https://shrddr.github.io/workerman/data/icons/node/${node.id === selectedParentId || node.id === selectedId ? "highlighted/" : ""}${node.kind}.png`,
        width: 256,
        height: 256,
        anchorX: 128,
        anchorY: 128,
      }),
      getSize: (node) =>
        (node.id === selectedId
          ? 46
          : explorationIconSize(
              node,
              node.id === selectedParentId,
              node.id !== selectedParentId,
            )) * explorationIconScaleForZoom(viewState.zoom),
      sizeUnits: "pixels",
      sizeMinPixels: 14,
      sizeMaxPixels: 132,
      updateTriggers: {
        getIcon: [selectedParentId, selectedId],
        getSize: [selectedParentId, selectedId, viewState.zoom],
      },
      onClick: (info: PickingInfo<MapNetworkNode | ParentMapNode>) => {
        if (!info.object) return;
        const nodeId = info.object.id;
        const directProduction = rankings.find((ranking) => ranking.node.id === nodeId);
        if (directProduction) {
          onSelect(directProduction.node.id);
          return;
        }
        const child = rankings.find((ranking) => ranking.node.parentNode?.id === nodeId);
        if (child) onSelect(child.node.id);
      },
    });

    return [tiles, connectionLines, parents];
  }, [rankings, selectedId, viewState.zoom, onSelect, network]);

  const selected = rankings.find((ranking) => ranking.node.id === selectedId);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-zinc-950">
      <DeckGL
        views={new OrthographicView({ id: "workerman-map", controller: true })}
        viewState={viewState as any}
        controller={{ doubleClickZoom: false }}
        layers={layers}
        onViewStateChange={(event: ViewStateChangeParameters<any>) => {
          const next = event.viewState;
          setViewState({
            target: [next.target[0], next.target[1], 0],
            zoom: next.zoom,
            minZoom: -12,
            maxZoom: WORKERMAN_VIEW.maxZoom,
          });
        }}
        getTooltip={(info: PickingInfo<any>) => {
          const object = info.object;
          if (!object) return null;
          if ("kind" in object && "cpCost" in object && !("node" in object)) {
            const ranking = rankings.find((entry) => entry.node.id === object.id);
            if (ranking) {
              return {
                html: `<strong>${escapeHtml(ranking.node.name)}</strong><br/>Rank #${ranking.rank ?? "Unranked"}<br/>${escapeHtml(formatSilver(ranking.realizableSilverPerDay))} / day${ranking.node.parentNode ? `<br/>Parent: ${escapeHtml(ranking.node.parentNode.name)}` : ""}`,
                className: "workerman-deck-tooltip",
              };
            }
            const visibleChildren = rankings.filter(
              (ranking) => ranking.node.parentNode?.id === object.id,
            ).length;
            return {
              html: `<strong>${escapeHtml(object.name)}</strong><br/>Exploration node · ${object.cpCost} CP${visibleChildren ? `<br/>${visibleChildren} visible production ${visibleChildren === 1 ? "node" : "nodes"}` : ""}`,
              className: "workerman-deck-tooltip",
            };
          }
          if ("sourceId" in object && "targetId" in object) {
            const nodeById = mapNetworkNodesById(network);
            const source = nodeById.get(object.sourceId);
            const target = nodeById.get(object.targetId);
            return {
              html: `<strong>Connection</strong>${source && target ? `<br/>${escapeHtml(source.name)} &harr; ${escapeHtml(target.name)}` : ""}`,
              className: "workerman-deck-tooltip",
            };
          }
          return null;
        }}
        style={{ background: "#09090b" }}
      />
      <div className="pointer-events-auto absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border bg-background shadow-md">
        <MapControl
          label="Zoom in"
          onClick={() =>
            setViewState((current) => ({
              ...current,
              zoom: Math.min(current.maxZoom, current.zoom + 1),
            }))
          }
        >
          <Plus />
        </MapControl>
        <MapControl
          label="Zoom out"
          onClick={() =>
            setViewState((current) => ({
              ...current,
              zoom: Math.max(current.minZoom, current.zoom - 1),
            }))
          }
        >
          <Minus />
        </MapControl>
        <MapControl label="Fit current scope" onClick={() => fitRankings(false)}>
          <Focus />
        </MapControl>
        <MapControl
          label="Center selected node"
          disabled={!selected?.node.position}
          onClick={() => selected && refCenter(selected)}
        >
          <LocateFixed />
        </MapControl>
      </div>
    </div>
  );

  function refCenter(ranking: NodeRanking) {
    if (!ranking.node.position) return;
    const [x, y] = gameToCartesianPosition(ranking.node.position);
    setViewState((current) => ({
      ...current,
      target: [x, y, 0],
      zoom: Math.max(current.zoom, -7),
    }));
  }
});

function MapControl({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center border-b text-foreground last:border-b-0 hover:bg-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mapNetworkNodesById(network: MapNetwork | null) {
  return new Map((network?.nodes ?? []).map((node) => [node.id, node]));
}
