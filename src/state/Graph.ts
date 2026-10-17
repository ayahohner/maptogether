import Graph from "graphology";

import MapSingleton from "../map/components/MapSingleton";
import type { ComponentConfig } from "../map/components/componentLayout";
import type { LinkStyle } from "../map/components/symbols";
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
  /** What the link was drawn from. */
  style: LinkStyle;
  component: LineT;
};

export type WardleyGraph = Graph<NodeAttributes, EdgeAttributes>;

/** The components and links on the map, with the Pixi objects that draw them (see drawMap.ts). */
export const graph: WardleyGraph = new Graph({ type: "undirected" });

/** A link's two components, needer first, from its key; undefined if it's left the map. */
export const linkEnds = (key: string): [string, string] | undefined => {
  const edge = graph.findEdge((_edge, link) => link.nodeKey === key);
  return edge === undefined ? undefined : [graph.source(edge), graph.target(edge)];
};

/**
 * Moves components by (x, y) px, as a drag does: a pipeline's components keep
 * to its row as it moves, and its box keeps around them. A selected component
 * may have left the map since.
 */
export const moveComponentsBy = (names: Iterable<string>, x: number, y: number) => {
  const moving = new Set([...names].filter((name) => graph.hasNode(name)));
  const pipelines = new Set<string>();
  for (const name of moving) {
    moveComponentBy(name, x, y);
    pipelines.add(graph.getNodeAttribute(name, "config").inPipeline ?? name);
  }
  for (const pipeline of pipelines) fitPipeline(pipeline, moving.has(pipeline) ? y : 0, moving);
};

/** Moves those of a pipeline's components that aren't moving already by `y` px, and redraws its box around them. */
const fitPipeline = (pipeline: string, y: number, moving: Set<string>) => {
  if (!graph.hasNode(pipeline) || !graph.getNodeAttribute(pipeline, "config").pipeline) return;
  const inside = graph.filterNodes((_name, node) => node.config.inPipeline === pipeline);
  for (const name of inside) if (!moving.has(name)) moveComponentBy(name, 0, y);
  const childXs = inside.map((name) => graph.getNodeAttribute(name, "component").x);
  graph.getNodeAttribute(pipeline, "component").fitPipe(childXs);
};

const moveComponentBy = (nodeKey: string, x: number, y: number) => {
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
