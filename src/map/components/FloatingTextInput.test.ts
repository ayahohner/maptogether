import { beforeEach, expect, it, vi, type Mock } from "vitest";
import { FloatingTextInput } from "./FloatingTextInput";

let mount: HTMLElement;
let onSubmit: Mock<(value: string) => void>;

beforeEach(() => {
  document.body.innerHTML = `<div id="map"></div>`;
  mount = document.getElementById("map")!;
  onSubmit = vi.fn();
});

const fields = () => mount.querySelectorAll("input").length;
const press = (input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) =>
  input.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));

it("opens a focused, selected field beside the point", () => {
  const input = FloatingTextInput(mount, 100, 50, onSubmit, "Kettle");
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("Kettle");
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(6);
  expect(input.parentElement!.style.left).toBe("104px");
  expect(input.parentElement!.style.top).toBe("27px");
  expect(input.size).toBe(6);
});

it("submits on Enter, once", () => {
  const input = FloatingTextInput(mount, 0, 0, onSubmit);
  input.value = "Teapot";
  input.dispatchEvent(new Event("input"));
  expect(input.size).toBe(6);
  press(input, "Enter");
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Teapot");
  expect(fields()).toBe(0);
});

it("submits when it loses focus", () => {
  const input = FloatingTextInput(mount, 0, 0, onSubmit);
  input.value = "Teapot";
  input.blur();
  expect(onSubmit).toHaveBeenCalledWith("Teapot");
  expect(fields()).toBe(0);
});

it("cancels on Escape, and ignores an empty name", () => {
  const input = FloatingTextInput(mount, 0, 0, onSubmit);
  input.value = "Teapot";
  press(input, "Escape");
  FloatingTextInput(mount, 0, 0, onSubmit).blur();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(fields()).toBe(0);
});

it("doesn't submit on the Enter that ends input-method composition", () => {
  const input = FloatingTextInput(mount, 0, 0, onSubmit);
  input.value = "茶";
  press(input, "Enter", { isComposing: true });
  expect(onSubmit).not.toHaveBeenCalled();
  expect(fields()).toBe(1);
});

it("submits the name without spaces around it", () => {
  const input = FloatingTextInput(mount, 0, 0, onSubmit);
  input.value = "  Teapot ";
  press(input, "Enter");
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Teapot");
});

it("marks a name it can't take as you type, and stays open on Enter", () => {
  const problem = (name: string) => (name.includes(".") ? "No dots" : undefined);
  const input = FloatingTextInput(mount, 0, 0, onSubmit, "", problem);
  input.value = "Node.js";
  input.dispatchEvent(new Event("input"));
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.title).toBe("No dots");
  press(input, "Enter");
  expect(onSubmit).not.toHaveBeenCalled();
  expect(fields()).toBe(1);
  input.value = "Node";
  input.dispatchEvent(new Event("input"));
  expect(input.getAttribute("aria-invalid")).toBe("false");
  expect(input.title).toBe("");
});

it("drops a name it can't take when it loses focus", () => {
  const input = FloatingTextInput(mount, 0, 0, onSubmit, "", () => "No");
  input.value = "Node.js";
  input.blur();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(fields()).toBe(0);
});
