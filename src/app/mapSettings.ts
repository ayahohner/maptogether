import { subscribe } from "valtio/vanilla";

import { mapSettings } from "../state/Settings";

/** A title as a file name: lower case, with runs of anything but letters and digits as one dash. */
export const fileName = (title: string | undefined, fallback: string) => {
  const slug = (title ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
};

/**
 * Keeps the page in step with `@map`: the tab is titled after the map, and
 * the map's background follows its style (map.css).
 */
export const initializeMapSettings = (map: HTMLElement) => {
  const pageTitle = document.title;
  const apply = () => {
    document.title = mapSettings.title ? `${mapSettings.title} · MapTogether` : pageTitle;
    map.dataset.style = mapSettings.style;
  };
  apply();
  return subscribe(mapSettings, apply);
};
