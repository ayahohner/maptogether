import { beforeEach, expect, it, vi } from "vitest";

const editor = vi.hoisted(() => ({ appendText: vi.fn(), renameComponent: vi.fn() }));
const graph = vi.hoisted(() => ({ hasNode: vi.fn((name: string) => name === "Kettle") }));
const store = vi.hoisted(() => ({
  clearSelection: vi.fn(),
  dragTo: vi.fn(),
  linkTo: vi.fn(),
  pressCanvas: vi.fn(),
  pressComponent: vi.fn(),
  pressEdge: vi.fn(),
  releaseDrag: vi.fn(),
  // One link, from (0, 100) to (200, 100) in world coordinates.
  edgeSegments: vi.fn(() => [
    { key: "Kettle->Power", start: { x: 0, y: 100 }, stop: { x: 200, y: 100 } },
  ]),
  replaceSelection: vi.fn(),
}));
vi.mock("../editor/Editor", () => editor);
vi.mock("../state/Graph", () => ({ graph }));
vi.mock("../state/State", () => store);

import { canvasActions, mapCoordinates, type MapView } from "./canvasActions";
import { setTool, tools } from "../state/Tools";
import { resetView, viewport } from "./viewport";

let map: MapView;

beforeEach(() => {
  vi.clearAllMocks();
  resetView();
  setTool("select");
  document.body.innerHTML = `<div id="map"></div>`;
  map = {
    element: document.getElementById("map")!,
    components: () => [
      { nodeKey: "Kettle", getBounds: () => ({ x: 0, y: 0, width: 10, height: 10 }) },
    ],
    size: () => ({ width: 400, height: 200 }),
  };
});

const field = () => map.element.querySelector("input")!;
const submit = (name: string) => {
  field().value = name;
  field().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
};

it("gives map coordinates for a screen point, undoing pan and zoom", () => {
  expect(mapCoordinates(map, { x: 100, y: 50 })).toBe("[75, 25]");
  Object.assign(viewport, { x: 100, y: 0, scale: 2 });
  expect(mapCoordinates(map, { x: 300, y: 200 })).toBe("[50, 25]");
});

it("keeps new components on the map", () => {
  expect(mapCoordinates(map, { x: -50, y: 500 })).toBe("[0, 0]");
});

it("reports the tool and the component under a point", () => {
  const actions = canvasActions(map);
  setTool("link");
  expect(actions.tool()).toBe("link");
  expect(actions.hit({ x: 5, y: 5 })).toBe("Kettle");
  expect(actions.hit({ x: 50, y: 5 })).toBeUndefined();
});

it("presses and drags in world coordinates", () => {
  const actions = canvasActions(map);
  Object.assign(viewport, { x: 10, y: 0, scale: 2 });
  actions.press("Kettle", { x: 30, y: 4 }, true);
  expect(store.pressComponent).toHaveBeenCalledWith("Kettle", { x: 10, y: 2 }, true);
  actions.press(undefined, { x: 30, y: 4 }, false);
  expect(store.pressCanvas).toHaveBeenCalledWith({ x: 10, y: 2 }, false);
  actions.drag({ x: 50, y: 4 }, false);
  expect(store.dragTo).toHaveBeenCalledWith({ x: 20, y: 2 }, false);
  actions.release();
  expect(store.releaseDrag).toHaveBeenCalled();
});

it("presses a link near the pointer, allowing for zoom", () => {
  const actions = canvasActions(map);
  actions.press(undefined, { x: 50, y: 105 }, true);
  expect(store.pressEdge).toHaveBeenCalledWith("Kettle->Power", { x: 50, y: 105 }, true);
  actions.press(undefined, { x: 50, y: 108 }, false);
  expect(store.pressCanvas).toHaveBeenCalledWith({ x: 50, y: 108 }, false);
  Object.assign(viewport, { scale: 0.5 });
  actions.press(undefined, { x: 25, y: 52 }, false);
  expect(store.pressEdge).toHaveBeenLastCalledWith("Kettle->Power", { x: 50, y: 104 }, false);
});

it("selects one component, a link or nothing on a tap, and links", () => {
  const actions = canvasActions(map);
  actions.select("Kettle", { x: 5, y: 5 }, true);
  expect(store.replaceSelection).toHaveBeenCalledWith(["Kettle"]);
  actions.select(undefined, { x: 50, y: 112 }, true);
  expect(store.replaceSelection).toHaveBeenLastCalledWith([], ["Kettle->Power"]);
  actions.select(undefined, { x: 50, y: 112 }, false);
  expect(store.clearSelection).toHaveBeenCalled();
  actions.link("Kettle");
  expect(store.linkTo).toHaveBeenCalledWith("Kettle");
});

it("names a new component where the canvas was pressed", () => {
  canvasActions(map).edit(undefined, { x: 100, y: 50 });
  submit("Teapot");
  expect(editor.appendText).toHaveBeenCalledWith("\nTeapot [75, 25]");
});

it("won't create a second component with the same name", () => {
  canvasActions(map).edit(undefined, { x: 100, y: 50 });
  submit("Kettle");
  expect(editor.appendText).not.toHaveBeenCalled();
});

it("renames a component, unless the name is taken", () => {
  const actions = canvasActions(map);
  actions.edit("Kettle", { x: 5, y: 5 });
  expect(field().value).toBe("Kettle");
  submit("Urn");
  expect(editor.renameComponent).toHaveBeenCalledWith("Kettle", "Urn");
  actions.edit("Urn", { x: 5, y: 5 });
  submit("Kettle");
  expect(editor.renameComponent).toHaveBeenCalledOnce();
});

it("places a component with the component tool, then goes back to select", () => {
  setTool("component");
  canvasActions(map).place({ x: 100, y: 50 });
  expect(tools.tool).toBe("select");
  submit("Teapot");
  expect(editor.appendText).toHaveBeenCalledWith("\nTeapot [75, 25]");
});

it("pans, zooms and vibrates on pick-up", () => {
  const vibrate = vi.fn();
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  const actions = canvasActions(map);
  actions.pan(5, 6);
  expect(viewport).toMatchObject({ x: 5, y: 6 });
  actions.zoom({ x: 5, y: 6 }, 2);
  expect(viewport.scale).toBe(2);
  actions.pickedUp();
  expect(vibrate).toHaveBeenCalledWith(10);
});
