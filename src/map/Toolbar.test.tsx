import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../state/Graph", () => ({}));
vi.mock("../editor/Editor", () => ({}));

import { MapControls, toolHint } from "./Toolbar";
import { replaceSelection, setInitialLinkTarget } from "../state/State";
import { holdLink, releaseHeld, setTool, tools } from "../state/Tools";
import { MAX_SCALE, resetView, viewport } from "./viewport";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const props = {
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onDelete: vi.fn(),
  onZoom: vi.fn(),
  onResetZoom: vi.fn(),
};

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  setTool("select");
  releaseHeld();
  resetView();
  replaceSelection([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MapControls {...props} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

const button = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
const pressed = () =>
  [...host.querySelectorAll('[aria-pressed="true"]')].map((b) => b.getAttribute("aria-label"));
const click = (el: HTMLElement) => act(async () => el.click());
const update = (fn: () => void) => act(async () => fn());

it("shows the tools with select active, and their shortcuts", () => {
  expect(host.querySelector('[role="toolbar"]')).not.toBeNull();
  expect(pressed()).toEqual(["Select"]);
  expect(button("Link")!.textContent).toContain("L");
});

it("picks a tool on click", async () => {
  await click(button("Component")!);
  expect(tools.tool).toBe("component");
  expect(pressed()).toEqual(["Component"]);
});

it("highlights the link tool while the link key is held", async () => {
  await update(() => holdLink(true));
  expect(pressed()).toEqual(["Link"]);
});

it("runs undo and redo, and offers delete only with a selection", async () => {
  await click(button("Undo")!);
  await click(button("Redo")!);
  expect(props.onUndo).toHaveBeenCalled();
  expect(props.onRedo).toHaveBeenCalled();
  expect(button("Delete")).toBeNull();
  await update(() => replaceSelection(["Kettle"]));
  await click(button("Delete")!);
  expect(props.onDelete).toHaveBeenCalled();
});

it("zooms in, out and back, showing the zoom level", async () => {
  await click(button("Zoom in")!);
  await click(button("Zoom out")!);
  expect(props.onZoom.mock.calls).toEqual([[1.25], [0.8]]);
  await update(() => (viewport.scale = 1.5));
  const level = host.querySelector<HTMLButtonElement>(".map-zoom-level")!;
  expect(level.textContent).toBe("150%");
  await click(level);
  expect(props.onResetZoom).toHaveBeenCalled();
  await update(() => (viewport.scale = MAX_SCALE));
  expect(button("Zoom in")!.disabled).toBe(true);
});

it("keeps focus where it was when a control is clicked", () => {
  const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  button("Undo")!.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
});

it("explains what to do next with the link and component tools", async () => {
  const hint = () => host.querySelector<HTMLElement>('[role="status"]')!;
  expect(hint().hidden).toBe(true);
  await update(() => setTool("link"));
  expect(hint().textContent).toBe("Choose a component, then the one it needs");
  await update(() => setInitialLinkTarget("Cup"));
  expect(hint().textContent).toBe("Now choose the component Cup needs");
});

it("has hints only for the link and component tools", () => {
  expect(toolHint("component", undefined)).toBe("Choose where the new component goes");
  expect(toolHint("select", "Cup")).toBeUndefined();
  expect(toolHint("hand", undefined)).toBeUndefined();
});
