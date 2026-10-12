import { expect, it } from "vitest";
import { hitComponent, type Hittable } from "./hitTest";

const box = (nodeKey: string | undefined, x: number, extra: Partial<Hittable> = {}): Hittable => ({
  nodeKey,
  getBounds: () => ({ x, y: 0, width: 10, height: 10 }),
  ...extra,
});

it("finds the component under the point", () => {
  expect(hitComponent([box("A", 0), box("B", 20)], { x: 25, y: 5 })).toBe("B");
});

it("misses empty canvas", () => {
  expect(hitComponent([box("A", 0)], { x: 50, y: 5 })).toBeUndefined();
});

it("prefers the higher zIndex, then the one painted last", () => {
  const children = [box("low", 0), box("high", 0, { zIndex: 1 }), box("later", 0)];
  expect(hitComponent(children, { x: 5, y: 5 })).toBe("high");
  expect(hitComponent([box("first", 0), box("last", 0)], { x: 5, y: 5 })).toBe("last");
});

it("ignores connection lines and unnamed children", () => {
  const children = [box("A", 0), box("A->B", 0, { updateLine: () => {} }), box(undefined, 0)];
  expect(hitComponent(children, { x: 5, y: 5 })).toBe("A");
});
