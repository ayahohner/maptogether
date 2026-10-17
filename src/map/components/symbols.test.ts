import { describe, expect, it } from "vitest";

import { decorations, markerShapes, type Shape } from "./symbols";

const kinds = (shapes: Shape[]) => shapes.map((s) => s.kind);
const at = { x: 100, y: 50 };

describe("markerShapes", () => {
  it("draws each type's symbol, with the border for the mode", () => {
    const [component] = markerShapes({ name: "A", ...at }, "default");
    expect(component).toMatchObject({
      kind: "circle",
      r: 6,
      fill: "paper",
      stroke: { role: "ink", width: 1, inside: true },
    });
    expect(markerShapes({ name: "A", ...at, symbol: "user" }, "selected")[0]).toMatchObject({
      fill: "ink",
      stroke: { role: "selected", width: 2 },
    });
    const market = markerShapes({ name: "A", ...at, symbol: "market" }, "default");
    expect(kinds(market)).toEqual(["circle", "line", "line", "line", "circle", "circle", "circle"]);
    expect(market[0]).toMatchObject({ r: 9 });
    expect(markerShapes({ name: "A", ...at, symbol: "ecosystem" }, "default")).toMatchObject([
      { r: 9, fill: "muted" },
      { r: 4.5, fill: "paper" },
    ]);
    expect(kinds(markerShapes({ name: "A", ...at, symbol: "submap" }, "default"))).toEqual([
      "circle",
      "rect",
    ]);
  });

  it("draws a pipeline as a square, whatever its type", () => {
    expect(markerShapes({ name: "A", ...at, symbol: "market", pipeline: [] }, "targeted")).toEqual([
      {
        kind: "rect",
        x: -5.5,
        y: -5.5,
        width: 11,
        height: 11,
        fill: "paper",
        stroke: { role: "targeted", width: 2, inside: true },
      },
    ]);
  });
});

describe("decorations", () => {
  it("draws nothing extra for a plain component", () => {
    expect(decorations({ name: "A", ...at })).toEqual({ behind: [], front: [], texts: [] });
  });

  it("puts a sourcing circle behind, and the inertia bar beside it", () => {
    const { behind, front } = decorations({
      name: "A",
      ...at,
      sourcing: "outsource",
      inertia: true,
    });
    expect(behind).toEqual([
      { kind: "circle", x: 0, y: 0, r: 14, fill: "sourcing.outsource", stroke: undefined },
    ]);
    expect(front).toEqual([{ kind: "rect", x: 18, y: -12, width: 5, height: 24, fill: "inertia" }]);
  });

  it("draws the future: its sourcing, a dashed arrow to its circle, and its label", () => {
    const { behind, front, texts } = decorations({
      name: "Kettle",
      ...at,
      evolve: { x: 160, sourcing: "buy" },
    });
    expect(behind).toEqual([
      { kind: "circle", x: 60, y: 0, r: 14, fill: "sourcing.buy", stroke: undefined },
    ]);
    const dashes = front.filter((s) => s.kind === "line");
    expect(dashes[0]).toMatchObject({ points: [8, 0, 12, 0], stroke: { role: "future" } });
    expect(front.find((s) => s.kind === "polygon")).toMatchObject({
      points: [44, 0, 37, -3.5, 37, 3.5],
    });
    expect(front.at(-1)).toMatchObject({ kind: "circle", x: 60, r: 6, stroke: { role: "future" } });
    expect(texts).toEqual([{ x: 77, y: -16, text: "Kettle", fill: "future" }]);
  });

  it("points the arrow back for a component expected to move left, and skips it when too close", () => {
    const back = decorations({ name: "A", ...at, inertia: true, evolve: { x: 40, label: "Old" } });
    expect(back.front.find((s) => s.kind === "polygon")).toMatchObject({
      points: [-52, 0, -45, -3.5, -45, 3.5],
    });
    expect(back.texts[0].text).toBe("Old");
    const near = decorations({ name: "A", ...at, evolve: { x: 110 } });
    expect(kinds(near.front)).toEqual(["circle"]);
    expect(decorations({ name: "A", ...at, evolve: { x: 100 } }).front).toEqual([]);
  });
});
