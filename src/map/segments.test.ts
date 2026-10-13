import { describe, expect, it } from "vitest";

import { contains, distanceToSegment, fractionInside, hitSegment, rectBetween } from "./segments";

const a = { x: 0, y: 0 };
const b = { x: 100, y: 0 };

describe("contains", () => {
  const rect = rectBetween({ x: 10, y: 40 }, { x: 0, y: 20 });

  it("includes points inside and on the edge", () => {
    expect(contains(rect, { x: 5, y: 30 })).toBe(true);
    expect(contains(rect, { x: 10, y: 20 })).toBe(true);
  });

  it.each([
    ["left", { x: -1, y: 30 }],
    ["right", { x: 11, y: 30 }],
    ["above", { x: 5, y: 19 }],
    ["below", { x: 5, y: 41 }],
  ])("excludes a point to the %s", (_, p) => {
    expect(contains(rect, p)).toBe(false);
  });
});

describe("distanceToSegment", () => {
  it("measures to the nearest point on the segment", () => {
    expect(distanceToSegment({ x: 50, y: 5 }, a, b)).toBe(5);
    expect(distanceToSegment({ x: -3, y: 4 }, a, b)).toBe(5);
    expect(distanceToSegment({ x: 103, y: -4 }, a, b)).toBe(5);
  });

  it("treats a zero-length segment as a point", () => {
    expect(distanceToSegment({ x: 3, y: 4 }, a, a)).toBe(5);
  });
});

describe("hitSegment", () => {
  const segments = [
    { key: "A->B", start: a, stop: b },
    { key: "A->C", start: a, stop: { x: 0, y: 100 } },
  ];

  it("finds the nearest segment within reach", () => {
    expect(hitSegment(segments, { x: 50, y: 4 }, 6)).toBe("A->B");
    expect(hitSegment(segments, { x: 2, y: 50 }, 6)).toBe("A->C");
    expect(hitSegment(segments, { x: 3, y: 2 }, 6)).toBe("A->B");
  });

  it("finds nothing out of reach", () => {
    expect(hitSegment(segments, { x: 50, y: 50 }, 6)).toBeUndefined();
  });
});

describe("fractionInside", () => {
  it("is 1 for a segment wholly inside and 0 for one outside", () => {
    expect(fractionInside(a, b, rectBetween({ x: -10, y: -10 }, { x: 110, y: 10 }))).toBe(1);
    expect(fractionInside(a, b, rectBetween({ x: -10, y: 5 }, { x: 110, y: 10 }))).toBe(0);
    expect(fractionInside(a, b, rectBetween({ x: 200, y: -10 }, { x: 300, y: 10 }))).toBe(0);
  });

  it("measures the part a rectangle cuts out", () => {
    expect(fractionInside(a, b, rectBetween({ x: 40, y: -10 }, { x: 70, y: 10 }))).toBeCloseTo(0.3);
    expect(fractionInside(b, a, rectBetween({ x: 40, y: -10 }, { x: 70, y: 10 }))).toBeCloseTo(0.3);
    const diagonal = fractionInside(
      a,
      { x: 100, y: 100 },
      rectBetween({ x: 0, y: 0 }, { x: 60, y: 200 }),
    );
    expect(diagonal).toBeCloseTo(0.6);
  });
});
