import { type ComponentConfig, layoutComponent } from "../map/components/componentLayout";
import type { NodeAttributes, WardleyGraph } from "../state/Graph";
import type { ExportScene } from "./mapSvg";

/**
 * A component's config, at where it is drawn now. A pipeline's box spans its
 * components where they are drawn now too, as the canvas redraws it during a
 * drag, before the text is parsed again (or while it can't be).
 */
const drawnConfig = (graph: WardleyGraph, node: NodeAttributes): ComponentConfig => {
  const config = { ...node.config, ...node.coordinates };
  if (!config.pipeline?.length) return config;
  const inside = graph.filterNodes((_name, child) => child.config.inPipeline === config.name);
  const pipeline = inside.map((name) => graph.getNodeAttribute(name, "coordinates").x);
  return { ...config, pipeline };
};

/** Where a component's marker is drawn: a pipeline's components sit lower than their row. */
const markerAt = (node: NodeAttributes): [number, number] => {
  const { x, y } = node.coordinates;
  return [x, layoutComponent({ ...node.config, x, y }).y];
};

/**
 * What the map shows, read from the graph the canvas draws. Components are
 * ordered as the canvas stacks them: pipelines' components in front.
 */
export const sceneFromGraph = (
  graph: WardleyGraph,
  size: { width: number; height: number },
): ExportScene => {
  const components = graph
    .mapNodes((_name, node) => drawnConfig(graph, node))
    .sort((a, b) => layoutComponent(a).zIndex - layoutComponent(b).zIndex);
  const links = graph.mapEdges(
    (_edge, _link, _a, _b, a, b) =>
      [...markerAt(a), ...markerAt(b)] as ExportScene["links"][number],
  );
  return { width: size.width, height: size.height, components, links };
};
