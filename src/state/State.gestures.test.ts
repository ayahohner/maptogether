import { beforeEach, expect, it, vi } from "vitest";

// State pulls in Graph (which builds the Pixi map) and Editor (which opens a
// sync connection) at load; stand in for the parts these actions use.
const graph = vi.hoisted(() => ({
  filterNodes: vi.fn((): string[] => []),
  areNeighbors: vi.fn(() => false),
  getNodeAttribute: vi.fn(() => ({ x: 1, y: 2 })),
}));
const editor = vi.hoisted(() => ({ appendText: vi.fn(), replaceCoordinates: vi.fn() }));
const updateComponentPositionOffset = vi.hoisted(() => vi.fn());
vi.mock("./Graph", () => ({ graph, updateComponentPositionOffset }));
vi.mock("../editor/Editor", () => editor);

import {
  dragTo,
  followActiveTool,
  linkTo,
  pressCanvas,
  pressComponent,
  releaseDrag,
  replaceSelection,
  setInitialLinkTarget,
  state,
} from "./State";
import { holdLink, releaseHeld, setTool } from "./Tools";

const selected = () => [...state.selection.selectionItems];

beforeEach(() => {
  vi.clearAllMocks();
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

it("moves components once past the drag threshold, then commits on release", () => {
  pressComponent("A", { x: 0, y: 0 }, false);
  dragTo({ x: 1, y: 1 }, false);
  expect(state.translateDrag.isTranslating).toBe(false);
  dragTo({ x: 3, y: 0 }, false);
  expect(state.translateDrag.isTranslating).toBe(true);
  dragTo({ x: 5, y: 1 }, false);
  expect(updateComponentPositionOffset).toHaveBeenCalledWith("A", 2, 1);
  releaseDrag();
  expect(editor.replaceCoordinates).toHaveBeenCalledWith("A", 1, 2);
  expect(state.translateDrag.translationStartPoint).toBeUndefined();
});

it("draws a marquee once past the threshold, replacing or adding to the selection", () => {
  graph.filterNodes.mockReturnValue(["C"]);
  replaceSelection(["A"]);
  pressCanvas({ x: 0, y: 0 }, true);
  dragTo({ x: 1, y: 0 }, true);
  expect(state.selectDrag.isSelecting).toBe(false);
  dragTo({ x: 10, y: 10 }, true);
  expect(state.selectDrag.isSelecting).toBe(true);
  dragTo({ x: 20, y: 20 }, true);
  expect(selected()).toEqual(["A", "C"]);
  dragTo({ x: 30, y: 30 }, false);
  expect(selected()).toEqual(["C"]);
  releaseDrag();
  expect(state.selectDrag.isSelecting).toBe(false);
});

it("ignores drags without a press", () => {
  dragTo({ x: 30, y: 30 }, false);
  expect(state.selectDrag.isSelecting).toBe(false);
  expect(state.translateDrag.isTranslating).toBe(false);
});

it("links the first component picked to the second", () => {
  linkTo("Cup");
  expect(state.linking.initialLinkTarget).toBe("Cup");
  linkTo("Kettle");
  expect(editor.appendText).toHaveBeenCalledWith("\nCup.Kettle");
  expect(state.linking.initialLinkTarget).toBeUndefined();
});

it("starts over on empty canvas, the same component, or an existing link", () => {
  linkTo("Cup");
  linkTo(undefined);
  expect(state.linking.initialLinkTarget).toBeUndefined();
  linkTo("Cup");
  linkTo("Cup");
  graph.areNeighbors.mockReturnValue(true);
  linkTo("Cup");
  linkTo("Kettle");
  expect(editor.appendText).not.toHaveBeenCalled();
  expect(state.linking.initialLinkTarget).toBeUndefined();
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
