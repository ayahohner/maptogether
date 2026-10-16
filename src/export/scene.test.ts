import Graph from "graphology";
import { expect, it } from "vitest";
import type { ComponentConfig } from "../map/components/componentLayout";
import type { WardleyGraph } from "../state/Graph";
import { sceneFromGraph } from "./scene";

/** A graph like drawMap's, without the Pixi objects, which a scene doesn't read. */
const graphOf = (configs: ComponentConfig[], links: [string, string][]) => {
  const graph = new Graph({ type: "undirected" }) as unknown as WardleyGraph;
  for (const config of configs) {
    graph.addNode(config.name, {
      nodeKey: config.name,
      coordinates: { x: config.x, y: config.y },
      config,
      component: {} as never,
    });
  }
  for (const [a, b] of links)
    graph.addEdge(a, b, { nodeKey: `${a}->${b}`, component: {} as never });
  return graph;
};

const size = { width: 800, height: 600 };

it("puts pipelines' components in front, as the canvas stacks them", () => {
  const graph = graphOf(
    [
      { name: "Tea", x: 300, y: 200, pipeline: [250] },
      { name: "Loose Leaf", x: 250, y: 200, inPipeline: "Tea" },
      { name: "Kettle", x: 100, y: 400 },
    ],
    [],
  );
  const scene = sceneFromGraph(graph, size);
  expect(scene.width).toBe(800);
  expect(scene.height).toBe(600);
  expect(scene.components.map((c) => c.name)).toEqual(["Tea", "Kettle", "Loose Leaf"]);
});

it("draws each link between its components' markers", () => {
  const graph = graphOf(
    [
      { name: "Tea", x: 300, y: 200, pipeline: [250] },
      { name: "Loose Leaf", x: 250, y: 200, inPipeline: "Tea" },
      { name: "Cup", x: 500, y: 100 },
    ],
    [
      ["Cup", "Tea"],
      ["Cup", "Loose Leaf"],
    ],
  );
  expect(sceneFromGraph(graph, size).links).toEqual([
    [500, 100, 300, 200],
    // A pipeline's component sits 12 px below the row.
    [500, 100, 250, 212],
  ]);
});

it("places components where they are drawn now, as after a drag", () => {
  const graph = graphOf([{ name: "Cup", x: 500, y: 100 }], []);
  graph.getNodeAttributes("Cup").coordinates = { x: 520, y: 90 };
  expect(sceneFromGraph(graph, size).components[0]).toMatchObject({ x: 520, y: 90 });
});

it("boxes a pipeline around its components where they are drawn now", () => {
  const graph = graphOf(
    [
      { name: "Tea", x: 300, y: 200, pipeline: [250, 350] },
      { name: "Loose Leaf", x: 250, y: 200, inPipeline: "Tea" },
      { name: "Bags", x: 350, y: 200, inPipeline: "Tea" },
    ],
    [],
  );
  // Dragged on the canvas, before the text is parsed again (or while it can't be).
  graph.getNodeAttributes("Bags").coordinates = { x: 420, y: 200 };
  const tea = sceneFromGraph(graph, size).components.find((c) => c.name === "Tea");
  expect(tea?.pipeline).toEqual([250, 420]);
});

it("leaves a pipeline nested in another without a box, as the canvas draws it", () => {
  const graph = graphOf(
    [
      { name: "Tea", x: 300, y: 200, pipeline: [250] },
      { name: "Leaf", x: 250, y: 200, inPipeline: "Tea", pipeline: [] },
      { name: "Stem", x: 260, y: 200, inPipeline: "Leaf" },
    ],
    [],
  );
  const leaf = sceneFromGraph(graph, size).components.find((c) => c.name === "Leaf");
  expect(leaf?.pipeline).toEqual([]);
});
