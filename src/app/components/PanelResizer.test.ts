import { beforeEach, expect, it, vi, type Mock } from "vitest";
import { initializePanelResizer, panelLimits } from "./PanelResizer";
import type { PanelLimits } from "./editorPanel";

const limits: PanelLimits = { defaultWidth: 400, maxWidth: 1000, snapWidth: 48, mobile: false };
let panel: HTMLElement;
let divider: HTMLElement;
let onResize: Mock<() => void>;

beforeEach(() => {
  document.body.innerHTML = `<main><div id="resize"></div><div id="editorContainer"></div></main>`;
  panel = document.getElementById("editorContainer")!;
  divider = document.getElementById("resize")!;
  onResize = vi.fn();
});

const pointer = (type: string, clientX: number) =>
  divider.dispatchEvent(new PointerEvent(type, { clientX, pointerId: 1, bubbles: true }));
const key = (k: string) =>
  divider.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const width = () => panel.style.getPropertyValue("--editor-width");

it("applies the initial width and notifies the map", () => {
  initializePanelResizer(panel, divider, onResize, () => limits);
  expect(width()).toBe("400px");
  expect(panel.inert).toBe(false);
  expect(divider.getAttribute("aria-valuenow")).toBe("400");
  expect(onResize).toHaveBeenCalled();
});

it("collapses on click and hides the editor from focus", () => {
  initializePanelResizer(panel, divider, onResize, () => limits);
  pointer("pointerdown", 500);
  pointer("pointermove", 501);
  pointer("pointerup", 501);
  expect(width()).toBe("0px");
  expect(panel.inert).toBe(true);
});

it("resizes by dragging, and keeps the width to reopen at", () => {
  const resizer = initializePanelResizer(panel, divider, onResize, () => limits);
  pointer("pointerdown", 500);
  pointer("pointermove", 400);
  expect(divider.classList.contains("dragging")).toBe(true);
  expect(width()).toBe("500px");
  pointer("pointerup", 400);
  expect(divider.classList.contains("dragging")).toBe(false);
  expect(resizer.state()).toEqual({ width: 500, lastOpenWidth: 500 });
});

it("ignores moves without a press and cancelled clicks", () => {
  const resizer = initializePanelResizer(panel, divider, onResize, () => limits);
  pointer("pointermove", 100);
  pointer("pointerup", 100);
  pointer("pointerdown", 500);
  pointer("pointercancel", 500);
  expect(resizer.state().width).toBe(400);
});

it("toggles with Enter or Space and resizes with the arrow keys", () => {
  const resizer = initializePanelResizer(panel, divider, onResize, () => limits);
  key("ArrowLeft");
  expect(resizer.state().width).toBe(424);
  key("ArrowRight");
  expect(resizer.state().width).toBe(400);
  key("Enter");
  expect(resizer.state().width).toBe(0);
  key(" ");
  expect(resizer.state().width).toBe(400);
  key("a");
  expect(resizer.state().width).toBe(400);
});

it("fits the panel to a smaller window", () => {
  let current = limits;
  const resizer = initializePanelResizer(panel, divider, onResize, () => current);
  current = { ...limits, maxWidth: 300 };
  window.dispatchEvent(new Event("resize"));
  expect(resizer.state().width).toBe(300);
});

it("derives limits from the layout", () => {
  const main = panel.parentElement!;
  Object.defineProperty(main, "clientWidth", { value: 1400, configurable: true });
  Object.defineProperty(divider, "offsetWidth", { value: 10 });
  expect(panelLimits(main, divider)).toEqual({
    defaultWidth: 417,
    maxWidth: 1230,
    snapWidth: 48,
    mobile: false,
  });
  const matchMedia = vi
    .spyOn(window, "matchMedia")
    .mockReturnValue({ matches: true } as MediaQueryList);
  Object.defineProperty(main, "clientWidth", { value: 390 });
  expect(panelLimits(main, divider)).toEqual({
    defaultWidth: 380,
    maxWidth: 380,
    snapWidth: 48,
    mobile: true,
  });
  matchMedia.mockRestore();
});
