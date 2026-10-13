import { beforeEach, expect, it, vi } from "vitest";

// drawMap draws with Pixi through these; record what they're asked to draw instead.
const map = vi.hoisted(() => ({
  graphContainer: { addChild: vi.fn() },
  renderIndicator: { reset: vi.fn() },
  dirty: false,
  // Wardley coordinates (percent) map straight to pixels, with y pointing down.
  wardleyToRendererCoords: (x: number, y: number) => [x, 100 - y],
}));
vi.mock("./components/MapSingleton", () => ({ default: map }));
vi.mock("./components/Component", () => ({
  // Like a Pixi container, x and y read the position.
  Component: vi.fn((config: { x: number; y: number }) => {
    const position = {
      x: config.x,
      y: config.y,
      set(x: number, y: number) {
        Object.assign(position, { x, y });
      },
    };
    return {
      position,
      removeFromParent: vi.fn(),
      get x() {
        return position.x;
      },
      get y() {
        return position.y;
      },
    };
  }),
}));
vi.mock("./components/Line", () => ({
  Line: vi.fn((...ends: unknown[]) => ({ ends, updateLine: vi.fn(), removeFromParent: vi.fn() })),
}));

import { graph } from "../state/Graph";
import { Component } from "./components/Component";
import { drawMap } from "./drawMap";

/** What each component was drawn with, by name. */
const drawn = () =>
  Object.fromEntries(
    vi
      .mocked(Component)
      .mock.calls.map(([config]) => [
        config.name,
        { x: config.x, y: config.y, inPipeline: config.inPipeline },
      ]),
  );

beforeEach(() => {
  graph.clear();
  vi.clearAllMocks();
});

const component = (name: string) => graph.getNodeAttribute(name, "component");
const link = () => graph.getEdgeAttributes(graph.edges()[0]).component;

it("draws each component at its evolution and visibility", () => {
  drawMap("Kettle [33, 50]\nPower");
  expect(drawn()).toEqual({
    Kettle: { x: 50, y: 67, inPipeline: false },
    Power: { x: 10, y: 90, inPipeline: false },
  });
});

it("draws a pipeline's components on the pipeline's row", () => {
  drawMap("Tea [55, 73] {\n  Loose Leaf [20, 56]\n  Tea Bags\n}");
  expect(drawn()).toMatchObject({
    Tea: { x: 73, y: 45, inPipeline: false },
    "Loose Leaf": { x: 56, y: 45, inPipeline: true },
    "Tea Bags": { x: 10, y: 45, inPipeline: true },
  });
  const tea = vi.mocked(Component).mock.calls.find(([c]) => c.name === "Tea")![0];
  expect(tea.pipeline).toEqual([56, 10]);
});

it("draws a pipeline nested in another without its components", () => {
  drawMap("Tea {\n  Leaf {\n    Stem\n  }\n}");
  const leaf = vi.mocked(Component).mock.calls.find(([c]) => c.name === "Leaf")![0];
  expect(leaf.pipeline).toEqual([]);
});

it("draws links after every component, whichever comes first in the text", () => {
  drawMap("Kettle.Power\nKettle [33, 50]\nPower [10, 86]");
  expect(graph.edges().map((e: string) => graph.getEdgeAttribute(e, "nodeKey"))).toEqual([
    "Kettle->Power",
  ]);
});

it("draws a component written twice once, where it is first written", () => {
  drawMap("Kettle [33, 50]\nKettle [80, 80]");
  expect(Component).toHaveBeenCalledTimes(1);
  expect(graph.getNodeAttribute("Kettle", "coordinates")).toEqual({ x: 50, y: 67 });
});

it("skips links to undeclared components, to the component itself, and repeated links", () => {
  drawMap("Kettle\nPower\nKettle.Power\nPower.Kettle\nKettle.Water\nKettle.Kettle");
  expect(graph.size).toBe(1);
});

it("leaves the last drawing, and returns false, when the text can't be read", () => {
  expect(drawMap("Kettle [33, 50]")).toBe(true);
  vi.clearAllMocks();
  expect(drawMap(Array.from({ length: 60 }, () => "Bad [").join("\n"))).toBe(false);
  expect(Component).not.toHaveBeenCalled();
  expect(graph.order).toBe(1);
});

it("keeps what is unchanged, moves what moved with its links, and removes what went", () => {
  drawMap("Kettle [33, 50]\nPower [10, 86]\nKettle.Power");
  const [kettle, power, line] = [component("Kettle"), component("Power"), link()];
  vi.clearAllMocks();

  drawMap("Kettle [40, 60]\nPower [10, 86]\nKettle.Power");
  expect(Component).not.toHaveBeenCalled();
  expect([component("Kettle"), component("Power"), link()]).toEqual([kettle, power, line]);
  expect(kettle.position).toMatchObject({ x: 60, y: 60 });
  expect(line.updateLine).toHaveBeenCalledWith(60, 60, 86, 90);

  drawMap("Kettle [40, 60]");
  expect(power.removeFromParent).toHaveBeenCalled();
  expect(line.removeFromParent).toHaveBeenCalled();
  expect([graph.order, graph.size]).toEqual([1, 0]);
});

it("draws a pipeline anew when its components change", () => {
  drawMap("Tea [55, 73] {\n  Leaf [20, 56]\n}");
  const [tea, leaf] = [component("Tea"), component("Leaf")];
  vi.clearAllMocks();
  drawMap("Tea [55, 73] {\n  Leaf [20, 30]\n}");
  expect(tea.removeFromParent).toHaveBeenCalled();
  expect(component("Leaf")).toBe(leaf);
  expect(drawn()).toEqual({ Tea: { x: 73, y: 45, inPipeline: false } });
});

it("draws a pipeline anew when it moves, so its box still spans its components", () => {
  drawMap("Tea [55, 73] {\n  Leaf [20, 56]\n}");
  const [tea, leaf] = [component("Tea"), component("Leaf")];
  vi.clearAllMocks();
  drawMap("Tea [55, 40] {\n  Leaf [20, 56]\n}");
  expect(tea.removeFromParent).toHaveBeenCalled();
  expect(drawn()).toEqual({ Tea: { x: 40, y: 45, inPipeline: false } });
  expect(component("Leaf")).toBe(leaf);
});

it("keeps a pipeline when one of its components moves inside its box", () => {
  drawMap("Tea [55, 50] {\n  Leaf [20, 20]\n  Bag [20, 60]\n  Cup [20, 80]\n}");
  const tea = component("Tea");
  vi.clearAllMocks();
  drawMap("Tea [55, 50] {\n  Leaf [20, 20]\n  Bag [20, 70]\n  Cup [20, 80]\n}");
  expect(Component).not.toHaveBeenCalled();
  expect(component("Tea")).toBe(tea);
  expect(component("Bag").position.x).toBe(70);
});

it("replaces a link written the other way round", () => {
  drawMap("Kettle\nPower\nKettle.Power");
  const line = link();
  drawMap("Kettle\nPower\nPower.Kettle");
  expect(line.removeFromParent).toHaveBeenCalled();
  expect(graph.getEdgeAttribute(graph.edges()[0], "nodeKey")).toBe("Power->Kettle");
});
