import { beforeEach, expect, it } from "vitest";
import { activeTool, releaseHeld, setTool, tools } from "../state/Tools";
import { bindToolShortcuts, isEditable, LINK_KEY, onKeyDown, onKeyUp } from "./shortcuts";

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

it("knows which targets are editable", () => {
  expect(isEditable(document.getElementById("field"))).toBe(true);
  expect(isEditable(document.getElementById("btn"))).toBe(false);
  expect(isEditable(null)).toBe(false);
});
