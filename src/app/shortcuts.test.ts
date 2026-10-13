import { beforeEach, expect, it, vi } from "vitest";
import { activeTool, releaseHeld, setTool, tools } from "../state/Tools";
import {
  bindEditShortcuts,
  bindToolShortcuts,
  editShortcut,
  isEditable,
  LINK_KEY,
  onKeyDown,
  onKeyUp,
} from "./shortcuts";

beforeEach(() => {
  setTool("select");
  releaseHeld();
  document.body.innerHTML = `<input id="field"><div id="code" contenteditable="true"></div><button id="btn"></button>`;
});

const key = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

it("switches tools with single keys", () => {
  bindToolShortcuts();
  for (const [k, tool] of [
    ["c", "component"],
    ["L", "link"],
    ["h", "hand"],
    ["v", "select"],
  ]) {
    key(k);
    expect(tools.tool).toBe(tool);
  }
  key("c");
  key("Escape");
  expect(tools.tool).toBe("select");
});

it("ignores shortcuts while typing or with modifiers", () => {
  bindToolShortcuts();
  key("c", document.getElementById("field")!);
  key("c", document.getElementById("code")!);
  key("c", document.body, { altKey: true });
  expect(tools.tool).toBe("select");
});

it("links while the link key is held, even while typing", () => {
  bindToolShortcuts();
  key(LINK_KEY, document.getElementById("code")!);
  expect(activeTool()).toBe("link");
  window.dispatchEvent(new KeyboardEvent("keyup", { key: LINK_KEY }));
  expect(activeTool()).toBe("select");
});

it("pans while space is held, without scrolling the page", () => {
  bindToolShortcuts();
  expect(key(" ").defaultPrevented).toBe(true);
  expect(activeTool()).toBe("hand");
  onKeyUp(new KeyboardEvent("keyup", { key: " " }));
  expect(activeTool()).toBe("select");
});

it("leaves space to a focused button", () => {
  const event = new KeyboardEvent("keydown", { key: " ", cancelable: true });
  Object.defineProperty(event, "target", { value: document.getElementById("btn") });
  onKeyDown(event);
  expect(event.defaultPrevented).toBe(false);
  expect(activeTool()).toBe("select");
});

it("lets go of held keys when the window loses focus", () => {
  bindToolShortcuts();
  key(" ");
  window.dispatchEvent(new Event("blur"));
  expect(activeTool()).toBe("select");
});

it("counts text fields as editable, but not buttons or nothing", () => {
  expect(isEditable(document.getElementById("field"))).toBe(true);
  expect(isEditable(document.getElementById("btn"))).toBe(false);
  expect(isEditable(null)).toBe(false);
});

// happy-dom reports a platform other than Apple's, so mod is Ctrl.
const press = (init: KeyboardEventInit, target: Element = document.body) => {
  const event = new KeyboardEvent("keydown", { bubbles: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  return editShortcut(event);
};

it("reads undo, redo and delete from key presses", () => {
  expect(press({ key: "z", ctrlKey: true })).toBe("undo");
  expect(press({ key: "Z", ctrlKey: true, shiftKey: true })).toBe("redo");
  expect(press({ key: "y", ctrlKey: true })).toBe("redo");
  expect(press({ key: "Delete" })).toBe("deleteSelection");
  expect(press({ key: "Backspace" })).toBe("deleteSelection");
});

it("leaves edit keys to text fields, and to other modifiers", () => {
  expect(press({ key: "z", ctrlKey: true }, document.getElementById("code")!)).toBeUndefined();
  expect(press({ key: "Backspace" }, document.getElementById("field")!)).toBeUndefined();
  expect(press({ key: "z", ctrlKey: true, altKey: true })).toBeUndefined();
  expect(press({ key: "z", metaKey: true })).toBeUndefined();
  expect(press({ key: "z" })).toBeUndefined();
});

it("calls the edit for a shortcut, in place of the browser's own", () => {
  const actions = { undo: vi.fn(), redo: vi.fn(), deleteSelection: vi.fn() };
  bindEditShortcuts(actions);
  expect(key("z", document.body, { ctrlKey: true }).defaultPrevented).toBe(true);
  expect(key("x", document.body, { ctrlKey: true }).defaultPrevented).toBe(false);
  expect(actions.undo).toHaveBeenCalledTimes(1);
});
