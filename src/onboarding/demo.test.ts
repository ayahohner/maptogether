import { expect, it, vi } from "vitest";
import { demoMapText, openDemoMap } from "./demo";

const target = (isNew: boolean, text: string) => ({
  isNew,
  text: () => text,
  replace: vi.fn(),
});

it("fills a new, empty map with the demo", () => {
  const map = target(true, "  \n");
  const openUrl = vi.fn();
  openDemoMap(map, openUrl);
  expect(map.replace).toHaveBeenCalledWith(demoMapText);
  expect(openUrl).not.toHaveBeenCalled();
});

it.each([
  ["a shared map", false, ""],
  ["a map with components", true, "Tea [50, 50]"],
])("opens the demo as a new map instead of overwriting %s", (_, isNew, text) => {
  const map = target(isNew, text);
  const openUrl = vi.fn();
  openDemoMap(map, openUrl);
  expect(map.replace).not.toHaveBeenCalled();
  expect(openUrl).toHaveBeenCalledWith("/?demo");
});

it("opens new tabs with window.open by default", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  openDemoMap(target(false, ""));
  expect(open).toHaveBeenCalledWith("/?demo", "_blank");
  open.mockRestore();
});

it("is the tea shop map", () => {
  expect(demoMapText).toContain("Cup of Tea");
});
