import { describe, expect, it, vi } from "vitest";

const map = vi.hoisted(() => ({ dirty: false }));
vi.mock("./MapSingleton", () => ({ default: map }));

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
    const redraw = vi.spyOn(line, "stroke");
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
    const redraw = vi.spyOn(line, "lineTo");
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
});
