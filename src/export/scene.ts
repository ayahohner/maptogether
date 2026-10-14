import { layoutComponent } from "../map/components/componentLayout";
import type { NodeAttributes, WardleyGraph } from "../state/Graph";
import type { ExportScene } from "./mapSvg";

/** A component's config, at where it is drawn now. */
const drawnConfig = (node: NodeAttributes) => ({ ...node.config, ...node.coordinates });

/** Where a component's marker is drawn: a pipeline's components sit lower than their row. */
const markerAt = (node: NodeAttributes): [number, number] => {
  const config = drawnConfig(node);
  return [config.x, layoutComponent(config).y];
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
    .mapNodes((_name, node) => drawnConfig(node))
    .sort((a, b) => layoutComponent(a).zIndex - layoutComponent(b).zIndex);
  const links = graph.mapEdges(
    (_edge, _link, _a, _b, a, b) =>
      [...markerAt(a), ...markerAt(b)] as ExportScene["links"][number],
  );
  return { width: size.width, height: size.height, components, links };
};
