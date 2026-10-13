import { beforeAll, describe, expect, it, vi } from "vitest";

// The map fills #map; the media query reports pixel density changes.
const density = vi.hoisted(() => {
  document.body.innerHTML = '<div id="map"></div>';
  const queries: EventTarget[] = [];
  window.matchMedia = vi.fn(() => {
    const query = new EventTarget();
    queries.push(query);
    return query as MediaQueryList;
  });
  return { change: () => queries.at(-1)!.dispatchEvent(new Event("change")), queries };
});

/** Runs the map's ticker callback, as Pixi does each frame. */
const frame = vi.hoisted(() => ({ tick: () => {} }));

vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof import("pixi.js")>();
  // Rendering needs WebGL, which happy-dom lacks.
  class Application {
    stage = new pixi.Container();
    screen = { width: 200, height: 100 };
    ticker = {
      add: (tick: () => void) => Object.assign(frame, { tick }),
      remove: () => {},
    };
    renderer = { resize: vi.fn() };
    render = vi.fn();
    async init() {}
  }
  return { ...pixi, Application, BitmapFont: { install: vi.fn() } };
});

import { viewport } from "../viewport";
import map from "./MapSingleton";

/** Waits for valtio to notify subscribers. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

beforeAll(() => map.ready);

describe("MapSingleton", () => {
  it("converts map percentages to pixels and back", () => {
    expect(map.wardleyToRendererCoords(25, 40)).toEqual([50, 60]);
    expect(map.rendererToWardleyCoords(50, 60)).toEqual(["25.0", "40.0"]);
  });

  it("renders on a tick only when something has changed, such as the view", async () => {
    frame.tick();
    expect(map.render).not.toHaveBeenCalled();
    viewport.x = 30;
    await settle();
    expect(map.world.x).toBe(30);
    frame.tick();
    frame.tick();
    expect(map.render).toHaveBeenCalledOnce();
  });

  it("fits the canvas to #map, and to the screen's pixel density as it changes", () => {
    map.fitToParent();
    expect(map.renderer.resize).toHaveBeenLastCalledWith(0, 0);
    density.change();
    expect(map.renderer.resize).toHaveBeenLastCalledWith(0, 0, devicePixelRatio);
    expect(map.dirty).toBe(true);
    // Each change arms a query for the next.
    expect(density.queries).toHaveLength(2);
  });
});
