import { beforeEach, expect, it, vi } from "vitest";
import {
  applyView,
  MAX_SCALE,
  MIN_SCALE,
  panView,
  resetView,
  toWorld,
  viewport,
  zoomAt,
  zoomCentered,
  zoomView,
} from "./viewport";

beforeEach(resetView);

it("converts screen points to world points", () => {
  expect(toWorld({ x: 10, y: 20, scale: 2 }, { x: 30, y: 60 })).toEqual({ x: 10, y: 20 });
});

it("zooms around a fixed screen point", () => {
  const view = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 100, y: 50 }, 2);
  expect(view).toEqual({ x: -100, y: -50, scale: 2 });
  // The world point under the cursor stays under it.
  expect(toWorld(view, { x: 100, y: 50 })).toEqual({ x: 100, y: 50 });
});

it("keeps the zoom within limits", () => {
  expect(zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100).scale).toBe(MAX_SCALE);
  expect(zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 0.001).scale).toBe(MIN_SCALE);
});

it("pans, zooms and resets the shared view", () => {
  panView(5, -5);
  expect(viewport).toMatchObject({ x: 5, y: -5, scale: 1 });
  zoomView({ x: 5, y: -5 }, 2);
  expect(viewport).toMatchObject({ x: 5, y: -5, scale: 2 });
  resetView();
  expect(viewport).toMatchObject({ x: 0, y: 0, scale: 1 });
});

it("zooms around the middle of an element", () => {
  const el = document.createElement("div");
  Object.defineProperties(el, { clientWidth: { value: 200 }, clientHeight: { value: 100 } });
  zoomCentered(el, 2);
  expect(viewport).toMatchObject({ x: -100, y: -50, scale: 2 });
});

it("applies the view to the world container and the overlays", () => {
  const world = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
  const el = document.createElement("div");
  applyView(world, el, { x: 3, y: 4, scale: 1.5 });
  expect(world.position.set).toHaveBeenCalledWith(3, 4);
  expect(world.scale.set).toHaveBeenCalledWith(1.5);
  expect(el.style.getPropertyValue("--view")).toBe("translate(3px, 4px) scale(1.5)");
  expect(el.style.getPropertyValue("--zoom")).toBe("1.5");
});
