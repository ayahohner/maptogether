import { Container } from "pixi.js";
import { it, expect, describe, vi } from "vitest";

// State.ts pulls in Graph.ts -> MapSingleton.tsx (constructs a Pixi
// Application at module level) and Editor.ts (touches window.heap and opens
// a multiplayer sync provider at module level). None of that is needed here.
vi.mock("./Graph", () => ({}));
vi.mock("../editor/Editor", () => ({}));

import { state, setInitialLinkTarget, startPotentialSelect } from "./State";

/**
 * Regression test for the Command-link freeze (2026-09-26):
 * the app used to store a live Pixi Container in valtio state
 * (state.linking.initialLinkTarget). Valtio's proxy() initialization
 * recursively walks a stored object's own properties and replaces object
 * values with Proxies ON THE REAL OBJECT, so the live scene graph got
 * corrupted (container.parent / children became Proxies) and every native
 * call through them (canvas.addEventListener, WebGPU commands, …) threw
 * "TypeError: Illegal invocation" — freezing the map.
 * State must only ever hold plain data (node keys, {x,y} pairs), never
 * Pixi class instances.
 */
describe("valtio state holds plain data, not Pixi objects", () => {
  it("stores the link source as its node key", () => {
    setInitialLinkTarget("MyComponent");
    expect(state.linking.initialLinkTarget).toBe("MyComponent");
    setInitialLinkTarget(undefined);
    expect(state.linking.initialLinkTarget).toBeUndefined();
  });

  // Checked by tsc, not at run time.
  it("doesn't accept a Pixi container as the link source", () => {
    const component = new Container();
    // @ts-expect-error - live Pixi objects must never enter valtio state
    setInitialLinkTarget(component);
    // Runtime cleanup in case a future signature change lets this through.
    setInitialLinkTarget(undefined);
  });

  it("stores drag points as plain objects", () => {
    startPotentialSelect({ x: 10, y: 20 });
    const p = state.selectDrag.selectionStartPoint;
    expect(p).toEqual({ x: 10, y: 20 });
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype);
  });
});
