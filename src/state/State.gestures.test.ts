import { beforeEach, expect, it, vi } from "vitest";

// Graph holds the map's Pixi objects; stand in for the parts these actions use.
const graph = vi.hoisted(() => ({
  hasNode: vi.fn(() => true),
  // Calls back like graphology: (node, attributes).
  filterNodes: vi.fn((test: (key: string, node: unknown) => boolean) =>
    Object.entries(nodes)
      .filter(([key, coordinates]) => test(key, { coordinates }))
      .map(([key]) => key),
  ),
  areNeighbors: vi.fn(() => false),
  getNodeAttribute: vi.fn(() => ({ x: 1, y: 2 })),
  // Calls back like graphology: (edge, attributes, source, target, sourceAttributes, targetAttributes).
  mapEdges: vi.fn((fn: (...args: any[]) => unknown) =>
    links.map(([key, start, stop]) =>
      fn(
        key,
        { nodeKey: key },
        "",
        "",
        { component: { position: start } },
        { component: { position: stop } },
      ),
    ),
  ),
}));
/** Components on the map, by key. */
let nodes: Record<string, { x: number; y: number }> = {};
/** Links on the map: key, start and end. */
let links: [string, { x: number; y: number }, { x: number; y: number }][] = [];
const updateComponentPositionOffset = vi.hoisted(() => vi.fn());
vi.mock("./Graph", () => ({ graph, updateComponentPositionOffset }));

import {
  dragTo,
  followActiveTool,
  linkTo,
  hasSelection,
  pressCanvas,
  pressComponent,
  pressEdge,
  releaseDrag,
  renameInSelection,
  replaceSelection,
  setInitialLinkTarget,
  state,
  xorSelection,
} from "./State";
import { holdLink, releaseHeld, setTool } from "./Tools";

const selected = () => [...state.selection.selectionItems];
const selectedLinks = () => [...state.selection.edgeItems];

beforeEach(() => {
  vi.clearAllMocks();
  nodes = {};
  links = [];
  releaseDrag();
  replaceSelection([]);
  setTool("select");
  releaseHeld();
  followActiveTool();
});

it("clears the selection and starts a marquee on empty canvas", () => {
  replaceSelection(["A"]);
  pressCanvas({ x: 1, y: 1 }, false);
  expect(selected()).toEqual([]);
  expect(state.selectDrag.selectionStartPoint).toEqual({ x: 1, y: 1 });
});

it("keeps the selection when adding to it", () => {
  replaceSelection(["A"]);
  pressCanvas({ x: 1, y: 1 }, true);
  expect(selected()).toEqual(["A"]);
});

it("selects a component and starts a move", () => {
  replaceSelection(["B"]);
  pressComponent("A", { x: 1, y: 1 }, false);
  expect(selected()).toEqual(["A"]);
  expect(state.translateDrag.translationStartPoint).toEqual({ x: 1, y: 1 });
});

it("keeps a selection that already includes the component, to move it all", () => {
  replaceSelection(["A", "B"]);
  pressComponent("A", { x: 1, y: 1 }, false);
  expect(selected()).toEqual(["A", "B"]);
});

it("toggles a component when adding", () => {
  replaceSelection(["A", "B"]);
  pressComponent("A", { x: 1, y: 1 }, true);
  expect(selected()).toEqual(["B"]);
  expect(state.translateDrag.translationStartPoint).toBeUndefined();
});

it("moves components from the press once past the drag threshold, and returns them on release", () => {
  pressComponent("A", { x: 0, y: 0 }, false);
  dragTo({ x: 1, y: 1 }, false);
  expect(state.translateDrag.isTranslating).toBe(false);
  expect(updateComponentPositionOffset).not.toHaveBeenCalled();
  dragTo({ x: 3, y: 0 }, false);
  expect(state.translateDrag.isTranslating).toBe(true);
  expect(updateComponentPositionOffset).toHaveBeenLastCalledWith("A", 3, 0);
  dragTo({ x: 5, y: 1 }, false);
  expect(updateComponentPositionOffset).toHaveBeenLastCalledWith("A", 2, 1);
  expect(releaseDrag()).toEqual([{ name: "A", x: 1, y: 2 }]);
  expect(state.translateDrag.translationStartPoint).toBeUndefined();
});

it("draws a marquee once past the threshold, adding the components inside it", () => {
  nodes = { C: { x: 15, y: 5 }, D: { x: 25, y: 25 } };
  replaceSelection(["A"]);
  pressCanvas({ x: 0, y: 0 }, true);
  dragTo({ x: 1, y: 0 }, true);
  expect(state.selectDrag.isSelecting).toBe(false);
  dragTo({ x: 10, y: 10 }, true);
  expect(state.selectDrag.isSelecting).toBe(true);
  dragTo({ x: 20, y: 20 }, true);
  expect(selected()).toEqual(["A", "C"]);
  releaseDrag();
  expect(state.selectDrag.isSelecting).toBe(false);
});

it("replaces the selection with what a marquee holds, dragged in any direction", () => {
  nodes = { C: { x: 15, y: 5 }, D: { x: 25, y: 25 } };
  replaceSelection(["A"]);
  pressCanvas({ x: 30, y: 30 }, true);
  dragTo({ x: 20, y: 20 }, false);
  dragTo({ x: 10, y: 0 }, false);
  expect(selected()).toEqual(["C", "D"]);
  dragTo({ x: 20, y: 20 }, false);
  expect(selected()).toEqual(["D"]);
  releaseDrag();
  expect(state.selectDrag.isSelecting).toBe(false);
});

it("selects a link on its own, or toggles it when adding, then can draw a marquee", () => {
  replaceSelection(["A"], ["B->C"]);
  pressEdge("A->B", { x: 1, y: 1 }, false);
  expect([selected(), selectedLinks()]).toEqual([[], ["A->B"]]);
  pressEdge("B->C", { x: 1, y: 1 }, true);
  pressEdge("A->B", { x: 1, y: 1 }, true);
  expect(selectedLinks()).toEqual(["B->C"]);
  expect(state.selectDrag.selectionStartPoint).toEqual({ x: 1, y: 1 });
});

it("marquee-selects links more than half inside it", () => {
  links = [
    ["A->B", { x: 0, y: 5 }, { x: 100, y: 5 }],
    ["B->C", { x: 0, y: 50 }, { x: 100, y: 50 }],
  ];
  pressCanvas({ x: -10, y: 0 }, false);
  dragTo({ x: 40, y: 60 }, false);
  dragTo({ x: 50, y: 60 }, false);
  expect(selectedLinks()).toEqual([]);
  dragTo({ x: 51, y: 10 }, false);
  expect(selectedLinks()).toEqual(["A->B"]);
  dragTo({ x: 60, y: 60 }, true);
  expect(selectedLinks()).toEqual(["A->B", "B->C"]);
});

it("keeps a renamed component selected under its new name", () => {
  replaceSelection(["Cup", "Tea"]);
  renameInSelection("Cup", "Mug");
  renameInSelection("Kettle", "Urn");
  expect(selected().sort()).toEqual(["Mug", "Tea"]);
});

it("counts links as a selection, and clears them with components", () => {
  expect(hasSelection()).toBe(false);
  xorSelection([], ["A->B"]);
  expect(hasSelection()).toBe(true);
  pressCanvas({ x: 0, y: 0 }, false);
  expect(hasSelection()).toBe(false);
});

it("ignores drags without a press", () => {
  dragTo({ x: 30, y: 30 }, false);
  expect(state.selectDrag.isSelecting).toBe(false);
  expect(state.translateDrag.isTranslating).toBe(false);
});

it("returns a link from the first component picked to the second", () => {
  expect(linkTo("Cup")).toBeUndefined();
  expect(state.linking.initialLinkTarget).toBe("Cup");
  expect(linkTo("Kettle")).toEqual({ from: "Cup", to: "Kettle" });
  expect(state.linking.initialLinkTarget).toBeUndefined();
});

it("starts over on empty canvas, the same component, or an existing link", () => {
  linkTo("Cup");
  expect(linkTo(undefined)).toBeUndefined();
  expect(state.linking.initialLinkTarget).toBeUndefined();
  linkTo("Cup");
  expect(linkTo("Cup")).toBeUndefined();
  graph.areNeighbors.mockReturnValueOnce(true);
  linkTo("Cup");
  expect(linkTo("Kettle")).toBeUndefined();
  expect(state.linking.initialLinkTarget).toBeUndefined();
});

it("takes the next pick as the source once the first has left the map", () => {
  linkTo("Cup");
  graph.hasNode.mockReturnValueOnce(false);
  expect(linkTo("Kettle")).toBeUndefined();
  expect(state.linking.initialLinkTarget).toBe("Kettle");
});

it("turns link mode on and off with the active tool, forgetting a half-made link", () => {
  holdLink(true);
  expect(state.linking.isLinkModeEnabled).toBe(true);
  setInitialLinkTarget("Cup");
  setTool("link"); // still linking: keep the source
  expect(state.linking.initialLinkTarget).toBe("Cup");
  releaseHeld();
  setTool("select");
  expect(state.linking.isLinkModeEnabled).toBe(false);
  expect(state.linking.initialLinkTarget).toBeUndefined();
});
