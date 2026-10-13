import { beforeEach, expect, it, vi } from "vitest";

// Graph draws with Pixi through these; record what they're asked to draw instead.
const map = vi.hoisted(() => ({
  graphContainer: { addChild: vi.fn(), removeChildren: vi.fn() },
  renderIndicator: { reset: vi.fn() },
  dirty: false,
  // Wardley coordinates (percent) map straight to pixels, with y pointing down.
  wardleyToRendererCoords: (x: number, y: number) => [x, 100 - y],
}));
const editor = vi.hoisted(() => ({
  showMapOutOfDate: vi.fn(),
  appendText: vi.fn(),
  replaceCoordinates: vi.fn(),
}));
vi.mock("../map/components/MapSingleton", () => ({ default: map }));
vi.mock("../editor/Editor", () => editor);
vi.mock("../map/components/Component", () => ({
  // Like a Pixi container, x and y read the position.
  Component: vi.fn((config: { x: number; y: number }) => {
    const position = { x: config.x, y: config.y };
    return {
      position,
      get x() {
        return position.x;
      },
      get y() {
        return position.y;
      },
    };
  }),
}));
vi.mock("../map/components/Line", () => ({
  Line: vi.fn((...ends: unknown[]) => ({ ends, updateLine: vi.fn() })),
}));

import { Component } from "../map/components/Component";
import { graph, rerenderGraph, updateComponentPosition } from "./Graph";
import { setEditorText } from "./State";

const draw = (text: string) => {
  setEditorText(text);
  rerenderGraph();
};

/** What each component was drawn with, by name. */
const drawn = () =>
  Object.fromEntries(
    vi.mocked(Component).mock.calls.map(([config]) => [
      config.name,
      { x: config.x, y: config.y, inPipeline: Boolean(config.parent) },
    ]),
  );

beforeEach(() => {
  vi.clearAllMocks();
});

it("draws each component at its evolution and visibility", () => {
  draw("Kettle [33, 50]\nPower");
  expect(drawn()).toEqual({
    Kettle: { x: 50, y: 67, inPipeline: false },
    Power: { x: 10, y: 90, inPipeline: false },
  });
  expect(editor.showMapOutOfDate).toHaveBeenCalledWith(false);
});

it("draws a pipeline's components on the pipeline's row", () => {
  draw("Tea [55, 73] {\n  Loose Leaf [20, 56]\n  Tea Bags\n}");
  expect(drawn()).toMatchObject({
    Tea: { x: 73, y: 45, inPipeline: false },
    "Loose Leaf": { x: 56, y: 45, inPipeline: true },
    "Tea Bags": { x: 10, y: 45, inPipeline: true },
  });
  const tea = vi.mocked(Component).mock.calls.find(([c]) => c.name === "Tea")![0];
  expect(tea.children).toHaveLength(2);
});

it("draws a pipeline nested in another without its components", () => {
  draw("Tea {\n  Leaf {\n    Stem\n  }\n}");
  const leaf = vi.mocked(Component).mock.calls.find(([c]) => c.name === "Leaf")![0];
  expect(leaf.children).toEqual([]);
});

it("draws links after every component, whichever comes first in the text", () => {
  draw("Kettle.Power\nKettle [33, 50]\nPower [10, 86]");
  expect(graph.edges().map((e) => graph.getEdgeAttribute(e, "nodeKey"))).toEqual([
    "Kettle->Power",
  ]);
});

it("skips links to undeclared components and repeated links", () => {
  draw("Kettle\nPower\nKettle.Power\nPower.Kettle\nKettle.Water");
  expect(graph.size).toBe(1);
});

it("leaves the last drawing and tints the editor when the text can't be read", () => {
  draw("Kettle [33, 50]");
  vi.clearAllMocks();
  draw(Array.from({ length: 60 }, () => "Bad [").join("\n"));
  expect(editor.showMapOutOfDate).toHaveBeenCalledWith(true);
  expect(Component).not.toHaveBeenCalled();
  expect(graph.order).toBe(1);
});

it("moves a component and the ends of its links", () => {
  draw("Kettle [33, 50]\nPower [10, 86]\nKettle.Power");
  updateComponentPosition("Kettle", 5, 6);
  const link = graph.getEdgeAttributes(graph.edges()[0]);
  expect(link.coordinates.start).toEqual({ x: 5, y: 6 });
  expect(link.component.updateLine).toHaveBeenCalledWith(5, 6, 86, 90);
});
