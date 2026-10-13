import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../state/Graph", () => ({}));
vi.mock("../editor/Editor", () => ({}));

import { initializeCanvasControls } from "./canvasControls";
import { setTool } from "../state/Tools";
import { resetView, viewport } from "./viewport";

const editor = { undo: vi.fn(), redo: vi.fn(), deleteSelection: vi.fn() };
let element: HTMLElement;
let canvas: HTMLCanvasElement;

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  resetView();
  setTool("select");
  document.body.innerHTML = `<div id="map"><canvas></canvas></div>`;
  element = document.getElementById("map")!;
  canvas = element.querySelector("canvas")!;
  Object.defineProperties(element, { clientWidth: { value: 400 }, clientHeight: { value: 200 } });
  const map = { element, components: () => [], size: () => ({ width: 400, height: 200 }) };
  await act(async () => initializeCanvasControls(canvas, map, editor));
});

afterEach(() => {
  document.body.replaceChildren();
});

it("shows the active tool on the map, for cursors", async () => {
  expect(element.dataset.tool).toBe("select");
  await act(async () => setTool("hand"));
  expect(element.dataset.tool).toBe("hand");
});

it("adds the toolbar, wired to the editor and the view", async () => {
  const controls = element.querySelector(".map-controls")!;
  await act(async () => controls.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click());
  expect(editor.undo).toHaveBeenCalled();
  await act(async () =>
    controls.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click(),
  );
  expect(viewport).toMatchObject({ scale: 1.25, x: -50, y: -25 });
  await act(async () => controls.querySelector<HTMLButtonElement>(".map-zoom-level")!.click());
  expect(viewport.scale).toBe(1);
});

it("turns canvas presses into gestures", () => {
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  const down = new PointerEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    cancelable: true,
  });
  canvas.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  canvas.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, pointerType: "touch", clientX: 40 }),
  );
  expect(viewport.x).toBe(40);
});
