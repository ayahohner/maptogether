import { expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../model/model";
import { setMapSettings } from "../state/Settings";
import { fileName, initializeMapSettings } from "./mapSettings";

/** Waits for valtio to notify subscribers. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

it("names a file after the map's title, or the fallback", () => {
  expect(fileName("Tea Shop: 2026 / Q3", "map")).toBe("tea-shop-2026-q3");
  expect(fileName("Café", "map")).toBe("cafe");
  expect(fileName("!!", "map")).toBe("map");
  expect(fileName(undefined, "map")).toBe("map");
});

it("titles the page after the map and marks the map with its style", async () => {
  document.title = "MapTogether";
  const map = document.createElement("div");
  const stop = initializeMapSettings(map);
  expect(map.dataset.style).toBe("wardley");
  setMapSettings({ ...DEFAULT_SETTINGS, title: "Tea Shop", style: "plain" });
  await settle();
  expect(document.title).toBe("Tea Shop · MapTogether");
  expect(map.dataset.style).toBe("plain");
  setMapSettings(DEFAULT_SETTINGS);
  await settle();
  expect(document.title).toBe("MapTogether");
  stop();
});
