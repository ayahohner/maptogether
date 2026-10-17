import { beforeEach, expect, it, vi } from "vitest";
import { initializeOnboarding } from "./index";
import { demoMapText } from "./demo";

const dialog = () => {
  document.body.innerHTML = `<dialog id="about"></dialog>`;
  return document.getElementById("about") as HTMLDialogElement;
};
const storage = () => ({ getItem: () => "false", setItem: vi.fn() });
let text = "";
const map = {
  text: () => text,
  replace: vi.fn((t: string) => {
    text = t;
  }),
};

beforeEach(() => {
  text = "";
  map.replace.mockClear();
});

it("fills a `/?demo` map with the demo and treats it as shared", () => {
  const about = dialog();
  initializeOnboarding(
    { id: "a", isNew: true, wantsDemo: true, wantsImport: false },
    map,
    about,
    storage(),
  );
  expect(map.replace).toHaveBeenCalledWith(demoMapText);
  expect(about.dataset.map).toBe("shared");
});

it("returns an action that loads the demo into a new, empty map", () => {
  const about = dialog();
  const openDemo = initializeOnboarding(
    { id: "a", isNew: true, wantsDemo: false, wantsImport: false },
    map,
    about,
    storage(),
  );
  expect(about.dataset.map).toBe("new");
  expect(map.replace).not.toHaveBeenCalled();
  openDemo();
  expect(text).toBe(demoMapText);
});
