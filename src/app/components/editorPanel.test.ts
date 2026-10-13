import { describe, expect, it } from "vitest";
import {
  dragTo,
  fitToWindow,
  initialPanel,
  isCollapsed,
  release,
  toggle,
  type PanelLimits,
} from "./editorPanel";

const desktop: PanelLimits = { defaultWidth: 400, maxWidth: 1000, snapWidth: 48, mobile: false };
const phone: PanelLimits = { defaultWidth: 380, maxWidth: 360, snapWidth: 48, mobile: true };

/** Drag from the current width to `width`, then let go. */
const dragAndRelease = (state = initialPanel(desktop), width: number, limits = desktop) =>
  release(dragTo(state, width, limits), limits);

describe("on desktop", () => {
  it("starts open at the default width", () => {
    expect(initialPanel(desktop)).toEqual({ width: 400, lastOpenWidth: 400 });
  });

  it("collapses on click and reopens at the default width", () => {
    const collapsed = toggle(initialPanel(desktop), desktop);
    expect(isCollapsed(collapsed)).toBe(true);
    expect(toggle(collapsed, desktop).width).toBe(400);
  });

  it("reopens at the last width it was dragged to", () => {
    const dragged = dragAndRelease(undefined, 620);
    expect(dragged.width).toBe(620);
    expect(toggle(toggle(dragged, desktop), desktop).width).toBe(620);
  });

  it("snaps closed near the edge, then reopens at the default width", () => {
    const snapped = dragAndRelease(undefined, 30);
    expect(snapped.width).toBe(0);
    expect(toggle(snapped, desktop).width).toBe(400);
  });

  it("can be dragged open from collapsed", () => {
    const collapsed = toggle(initialPanel(desktop), desktop);
    expect(dragAndRelease(collapsed, 250)).toEqual({ width: 250, lastOpenWidth: 250 });
  });

  it("stays within the available width", () => {
    expect(dragTo(initialPanel(desktop), 5000, desktop).width).toBe(1000);
    expect(dragTo(initialPanel(desktop), -20, desktop).width).toBe(0);
  });

  it("shrinks to fit a smaller window", () => {
    const wide = dragAndRelease(undefined, 900);
    expect(fitToWindow(wide, { ...desktop, maxWidth: 700 }).width).toBe(700);
    expect(fitToWindow(wide, desktop)).toBe(wide);
  });
});

describe("on phones", () => {
  it("starts collapsed so the map has the screen", () => {
    expect(isCollapsed(initialPanel(phone))).toBe(true);
  });

  it("toggles between collapsed and fully open on tap", () => {
    const open = toggle(initialPanel(phone), phone);
    expect(open.width).toBe(360);
    expect(isCollapsed(toggle(open, phone))).toBe(true);
  });

  it("still resizes by dragging", () => {
    const open = toggle(initialPanel(phone), phone);
    expect(dragAndRelease(open, 200, phone).width).toBe(200);
  });
});
