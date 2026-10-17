import { describe, expect, it, vi } from "vitest";

const map = vi.hoisted(() => ({ dirty: false }));
vi.mock("./MapSingleton", () => ({ default: map }));
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof import("pixi.js")>();
  // Measuring text needs a canvas, which happy-dom lacks.
  class BitmapText extends pixi.Container {
    override get width() {
      return 30;
    }
    override get height() {
      return 16;
    }
  }
  return { ...pixi, BitmapText };
});

import { Container } from "pixi.js";

import { clearSelection, replaceSelection } from "../../state/State";
import { Line } from "./Line";

/** Waits for valtio to notify subscribers. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe("Line", () => {
  it("is keyed by its link and drawn behind components", () => {
    const line = Line(0, 0, 10, 10, "A->B");
    expect(line.nodeKey).toBe("A->B");
    expect(line.zIndex).toBe(-1);
  });

  it("redraws when its link is selected or deselected", async () => {
    const line = Line(0, 0, 10, 10, "A->B");
    const redraw = vi.spyOn(line.line, "stroke");
    replaceSelection([], ["A->B"]);
    await settle();
    expect(redraw).toHaveBeenLastCalledWith(expect.objectContaining({ width: 2.5 }));
    expect(map.dirty).toBe(true);
    replaceSelection(["A"]);
    await settle();
    expect(redraw).toHaveBeenLastCalledWith(expect.objectContaining({ width: 1 }));
    replaceSelection(["B"]);
    await settle();
    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it("follows its components, and stops listening once removed", async () => {
    const line = Line(0, 0, 10, 10, "A->B");
    const redraw = vi.spyOn(line.line, "lineTo");
    line.updateLine(5, 5, 20, 30);
    expect(redraw).toHaveBeenCalledWith(20, 30);
    const parent = new Container();
    parent.addChild(line);
    parent.removeChild(line);
    replaceSelection([], ["A->B"]);
    await settle();
    expect(redraw).toHaveBeenCalledOnce();
    clearSelection();
  });

  it("draws its style: thick for a constraint, the flow colour for flow", async () => {
    const line = Line(0, 0, 10, 10, "A->B", { constraint: true, flow: true });
    const redraw = vi.spyOn(line.line, "stroke");
    replaceSelection([], ["A->B"]);
    await settle();
    // Selected, a constraint stays thick.
    expect(redraw).toHaveBeenLastCalledWith(expect.objectContaining({ width: 3, color: 0x9b5af9 }));
    replaceSelection([]);
    await settle();
    expect(redraw).toHaveBeenLastCalledWith(expect.objectContaining({ width: 3, color: 0x2563eb }));
  });

  it("labels the link above its middle, and moves the label with it", () => {
    const line = Line(0, 0, 100, 40, "A->B", { constraint: false, flow: false, label: "pays" });
    const label = line.children.at(-1)!;
    expect(label.position).toMatchObject({ x: 54, y: 0 });
    line.updateLine(0, 0, 200, 40);
    expect(label.position).toMatchObject({ x: 104, y: 0 });
  });
});
