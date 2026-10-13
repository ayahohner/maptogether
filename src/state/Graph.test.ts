import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../map/components/MapSingleton", () => ({ default: { dirty: false } }));

import type { ComponentConfig } from "../map/components/componentLayout";
import type { ComponentT } from "../map/components/types";
import { graph, moveComponentsBy } from "./Graph";

/** Puts a component on the map, drawn by a stand-in that records its box. */
const add = (config: ComponentConfig) => {
  const position = { x: config.x, y: config.y };
  const component = {
    position,
    get x() {
      return position.x;
    },
    fitPipe: vi.fn(),
  } as unknown as ComponentT;
  const { name, x, y } = config;
  graph.addNode(name, { nodeKey: name, coordinates: { x, y }, config, component });
};

const at = (name: string) => graph.getNodeAttribute(name, "coordinates");
const fitPipe = (name: string) => graph.getNodeAttribute(name, "component").fitPipe;

beforeEach(() => {
  graph.clear();
  add({ name: "Tea", x: 50, y: 40, pipeline: [20, 80] });
  add({ name: "Leaf", x: 20, y: 40, inPipeline: "Tea" });
  add({ name: "Bag", x: 80, y: 40, inPipeline: "Tea" });
  add({ name: "Kettle", x: 10, y: 10 });
});

it("carries a dragged pipeline's components to its row, and redraws its box around them", () => {
  moveComponentsBy(["Tea"], -30, 15);
  expect([at("Tea"), at("Leaf"), at("Bag"), at("Kettle")]).toEqual([
    { x: 20, y: 55 },
    { x: 20, y: 55 },
    { x: 80, y: 55 },
    { x: 10, y: 10 },
  ]);
  expect(graph.getNodeAttribute("Bag", "component").position).toEqual({ x: 80, y: 55 });
  expect(fitPipe("Tea")).toHaveBeenCalledWith([20, 80]);
});

it("redraws a pipeline's box as one of its components is dragged, leaving the rest", () => {
  moveComponentsBy(["Bag"], 10, 0);
  expect([at("Tea"), at("Leaf"), at("Bag")]).toEqual([
    { x: 50, y: 40 },
    { x: 20, y: 40 },
    { x: 90, y: 40 },
  ]);
  expect(fitPipe("Tea")).toHaveBeenCalledWith([20, 90]);
});

it("moves a component dragged with its pipeline once, and skips components gone from the map", () => {
  moveComponentsBy(["Tea", "Leaf", "Gone"], 5, 5);
  expect([at("Leaf"), at("Bag")]).toEqual([
    { x: 25, y: 45 },
    { x: 80, y: 45 },
  ]);
  expect(fitPipe("Tea")).toHaveBeenCalledOnce();
});
