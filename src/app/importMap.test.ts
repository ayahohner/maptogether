import { expect, it, vi } from "vitest";
import { openImportedMap, takeImportedMap } from "./importMap";

const OWM = "component Kettle [0.43, 0.35]\ncomponent Power [0.1, 0.7]\nKettle->Power";
const CONVERTED = "Kettle [43, 35]\nPower [10, 70]\nKettle -- Power";

const target = (isNew: boolean, text: string) => ({
  isNew,
  text: () => text,
  replace: vi.fn(),
});

const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const room = (wantsImport: boolean) => ({ isNew: true, wantsDemo: false, wantsImport });

it("fills a new, empty map with the converted map", () => {
  const map = target(true, "\n");
  const openUrl = vi.fn();
  openImportedMap(OWM, map, memory(), openUrl);
  expect(map.replace).toHaveBeenCalledWith(CONVERTED);
  expect(openUrl).not.toHaveBeenCalled();
});

it("opens the converted map in a new tab instead of overwriting a map", () => {
  const map = target(true, "Tea [50, 50]");
  const storage = memory();
  const openUrl = vi.fn();
  openImportedMap(OWM, map, storage, openUrl);
  expect(map.replace).not.toHaveBeenCalled();
  expect(openUrl).toHaveBeenCalledWith("/?import");
  expect(takeImportedMap(room(true), storage)).toBe(CONVERTED);
  expect(takeImportedMap(room(true), storage)).toBeUndefined();
});

it("starts from an imported map only on an import visit", () => {
  const storage = memory();
  openImportedMap(OWM, target(false, ""), storage, vi.fn());
  expect(takeImportedMap(room(false), storage)).toBeUndefined();
  expect(takeImportedMap(room(true), storage)).toBe(CONVERTED);
});

it("opens new tabs with window.open by default", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  openImportedMap(OWM, target(false, ""), memory());
  expect(open).toHaveBeenCalledWith("/?import", "_blank");
  open.mockRestore();
});
