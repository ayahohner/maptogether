import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { HelpLauncher, tokenClass } from "./HelpLauncher";
import { closeHelp, openHelp, ui } from "../state/Ui";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<HelpLauncher />));
});

afterEach(async () => {
  await act(async () => closeHelp());
  await act(async () => root.unmount());
  host.remove();
});

const fab = () => host.querySelector<HTMLButtonElement>(".help-fab")!;
const panel = () => document.getElementById("help-panel");
const button = (text: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text))!;

it("opens and closes from the floating button", async () => {
  expect(panel()).toBeNull();
  await act(async () => fab().click());
  expect(panel()).not.toBeNull();
  expect(fab().getAttribute("aria-label")).toBe("Close help");
  await act(async () => fab().click());
  expect(ui.help.open).toBe(false);
});

it("separates canvas controls from editor syntax", async () => {
  await act(async () => openHelp("canvas"));
  expect(panel()!.textContent).toContain("Add a component");
  await act(async () => button("Code editor").click());
  expect(ui.help.topic).toBe("code");
  expect(panel()!.textContent).toContain("Pipeline");
  expect(panel()!.textContent).toContain("Kettle [33, 50]");
});

it("switches between mouse and touch instructions", async () => {
  await act(async () => openHelp("canvas"));
  expect(panel()!.textContent).toContain("Double-click the canvas");
  await act(async () => button("Show touch gestures").click());
  expect(panel()!.textContent).toContain("Double-tap the canvas");
  await act(async () => button("Show mouse and keyboard").click());
  expect(panel()!.textContent).toContain("Double-click the canvas");
});

it("closes on Escape and on a press outside", async () => {
  await act(async () => openHelp());
  await act(async () => panel()!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  expect(ui.help.open).toBe(true);
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(ui.help.open).toBe(false);
  await act(async () => openHelp());
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })));
  await act(async () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  expect(ui.help.open).toBe(false);
});

it.each([
  ["// note", "text-ink-subtle italic"],
  ["42", "text-accent"],
  ["-3.5", "text-accent"],
  ["[", "text-ink-subtle"],
  ["Kettle ", undefined],
])("colours %j", (token, expected) => {
  expect(tokenClass(token)).toBe(expected);
});
