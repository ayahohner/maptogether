import { afterEach, expect, it, vi } from "vitest";
import { initializeAbout, isFirstVisit, openAbout } from "./about";

const storage = (value: string | null = null) => {
  const data = new Map<string, string>();
  if (value !== null) data.set("shouldShowHelp", value);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, v: string) => void data.set(key, v),
  };
};

const mount = () => {
  document.body.innerHTML = `<dialog id="about"><form method="dialog">
    <button type="button" data-action="demo">Demo</button>
    <button value="start">Start</button></form></dialog>`;
  return document.getElementById("about") as HTMLDialogElement;
};

afterEach(() => {
  document.body.innerHTML = "";
});

it("welcomes first-time visitors and remembers when they dismiss it", () => {
  const dialog = mount();
  const store = storage();
  initializeAbout(dialog, { storage: store, isNewMap: true, onDemo: vi.fn() });
  expect(dialog.open).toBe(true);
  expect(dialog.dataset.map).toBe("new");
  dialog.close();
  expect(isFirstVisit(store)).toBe(false);
});

it("stays closed for returning visitors until opened from the menu", () => {
  const dialog = mount();
  initializeAbout(dialog, { storage: storage("false"), isNewMap: false, onDemo: vi.fn() });
  expect(dialog.open).toBe(false);
  expect(dialog.dataset.map).toBe("shared");
  openAbout();
  expect(dialog.open).toBe(true);
});

it("closes and loads the demo map", () => {
  const dialog = mount();
  const onDemo = vi.fn();
  initializeAbout(dialog, { storage: storage(), isNewMap: true, onDemo });
  dialog.querySelector<HTMLButtonElement>("[data-action=demo]")!.click();
  expect(dialog.open).toBe(false);
  expect(onDemo).toHaveBeenCalledOnce();
});

it("closes when the backdrop is clicked", () => {
  const dialog = mount();
  initializeAbout(dialog, { storage: storage(), isNewMap: true, onDemo: vi.fn() });
  dialog.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(dialog.open).toBe(false);
  dialog.showModal();
  dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(dialog.open).toBe(false);
});
