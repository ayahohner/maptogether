import { describe, expect, it, vi } from "vitest";

const map = vi.hoisted(() => ({ dirty: false }));
vi.mock("./MapSingleton", () => ({ default: map }));
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof import("pixi.js")>();
  // Measuring text needs a canvas, which happy-dom lacks.
  class BitmapText extends pixi.Container {
    override get width() {
      return 50;
    }
    override get height() {
      return 16;
    }
  }
  return { ...pixi, BitmapText };
});

import { Container, Graphics } from "pixi.js";

import { clearSelection, replaceSelection } from "../../state/State";
import { Component } from "./Component";

/** Waits for valtio to notify subscribers. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

const marker = (component: Container) => component.children.at(-1) as Graphics;

describe("Component", () => {
  it("draws a component as a circle, and a pipeline as a square on its box", () => {
    const kettle = Component({ name: "Kettle", x: 40, y: 60 });
    expect(kettle.nodeKey).toBe("Kettle");
    expect(kettle.position).toMatchObject({ x: 40, y: 60 });
    expect(kettle.children).toHaveLength(3);

    const circle = vi.spyOn(Graphics.prototype, "circle");
    const rect = vi.spyOn(Graphics.prototype, "rect");
    const tea = Component({ name: "Tea", x: 40, y: 60, pipeline: [20, 80] });
    // The box, the label and its backing, then the marker.
    expect(tea.children).toHaveLength(4);
    expect(rect).toHaveBeenCalledWith(-5, -5, 10, 10);
    expect(circle).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("redraws its marker when its mode changes, and stops listening once removed", async () => {
    const kettle = Component({ name: "Kettle", x: 0, y: 0 });
    const redraw = vi.spyOn(marker(kettle), "stroke");
    map.dirty = false;

    replaceSelection(["Kettle"]);
    await settle();
    expect(redraw).toHaveBeenLastCalledWith(expect.objectContaining({ width: 2 }));
    expect(map.dirty).toBe(true);
    // Selecting another component leaves this one's mode, and marker, as they are.
    replaceSelection(["Kettle", "Power"]);
    await settle();
    expect(redraw).toHaveBeenCalledOnce();

    const parent = new Container();
    parent.addChild(kettle);
    parent.removeChild(kettle);
    expect(kettle.destroyed).toBe(true);
    clearSelection();
    await settle();
    expect(redraw).toHaveBeenCalledOnce();
  });
});
