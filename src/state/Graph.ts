import Graph from "graphology";

import MapSingleton from "../map/components/MapSingleton";
import type { ComponentT, LineT } from "../map/components/types";

export type NodeAttributes = {
  type: "normal";
  nodeKey: string;
  coordinates: { x: number; y: number };
  component: ComponentT;
  mounted: boolean;
};

export type EdgeAttributes = {
  type: "edge";
  nodeKey: string;
  coordinates: {
    start: { x: number; y: number };
    stop: { x: number; y: number };
  };
  component: LineT;
  mounted: boolean;
};

export type GraphAttributes = {
  name?: string;
};

export type WardleyGraph = Graph<NodeAttributes, EdgeAttributes, GraphAttributes>;

/** The components and links on the map, with the Pixi objects that draw them (see drawMap.ts). */
export const graph: WardleyGraph = new Graph({ type: "undirected" });

export const updateComponentPosition = (nodeKey: string, x: number, y: number) => {
  const node = graph.getNodeAttributes(nodeKey);
  if (node) {
    node.component.position.x = x;
    node.component.position.y = y;
    node.coordinates.x = x;
    node.coordinates.y = y;
    MapSingleton.dirty = true;
    graph.forEachEdge(nodeKey, updateEdgePosition);
  }
};

export const updateComponentPositionOffset = (nodeKey: string, x: number, y: number) => {
  const node = graph.getNodeAttributes(nodeKey);
  if (node) {
    node.component.position.x += x;
    node.component.position.y += y;
    node.coordinates.x += x;
    node.coordinates.y += y;
    MapSingleton.dirty = true;
    graph.forEachEdge(nodeKey, updateEdgePosition);
  }
};

const updateEdgePosition = (
  _edge: string,
  attributes: EdgeAttributes,
  _source: string,
  _target: string,
  sourceAttributes: NodeAttributes,
  targetAttributes: NodeAttributes,
) => {
  attributes.coordinates.start.x = sourceAttributes.component.x;
  attributes.coordinates.start.y = sourceAttributes.component.y;
  attributes.coordinates.stop.x = targetAttributes.component.x;
  attributes.coordinates.stop.y = targetAttributes.component.y;

  attributes.component.updateLine(
    attributes.coordinates.start.x,
    attributes.coordinates.start.y,
    attributes.coordinates.stop.x,
    attributes.coordinates.stop.y,
  );
  MapSingleton.dirty = true;
};
