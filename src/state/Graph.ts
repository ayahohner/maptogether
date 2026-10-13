import Graph from "graphology";

import MapSingleton from "../map/components/MapSingleton";
import type { ComponentConfig } from "../map/components/componentLayout";
import type { ComponentT, LineT } from "../map/components/types";

export type NodeAttributes = {
  nodeKey: string;
  /** Where the component is (px), from the text or as dragged. */
  coordinates: { x: number; y: number };
  /** What the component was drawn from. */
  config: ComponentConfig;
  component: ComponentT;
};

export type EdgeAttributes = {
  /** "needer->needed", as the link is first written. */
  nodeKey: string;
  component: LineT;
};

export type WardleyGraph = Graph<NodeAttributes, EdgeAttributes>;

/** The components and links on the map, with the Pixi objects that draw them (see drawMap.ts). */
export const graph: WardleyGraph = new Graph({ type: "undirected" });

/** Moves a component by (x, y) px. A selected component may have left the map since. */
export const updateComponentPositionOffset = (nodeKey: string, x: number, y: number) => {
  if (!graph.hasNode(nodeKey)) return;
  const node = graph.getNodeAttributes(nodeKey);
  node.component.position.x += x;
  node.component.position.y += y;
  node.coordinates.x += x;
  node.coordinates.y += y;
  redrawLinks(nodeKey);
};

/** Moves the ends of a component's links to where the component is drawn. */
export const redrawLinks = (nodeKey: string) => {
  graph.forEachEdge(nodeKey, (_edge, link, _source, _target, source, target) => {
    link.component.updateLine(
      source.component.x,
      source.component.y,
      target.component.x,
      target.component.y,
    );
  });
  MapSingleton.dirty = true;
};
