import { proxy } from "valtio/vanilla";

import { DEFAULT_SETTINGS, type MapSettings } from "../model/model";

/** The map's `@map` settings, as last drawn. The axes, the page title and the export read them. */
export const mapSettings = proxy<MapSettings>(structuredClone(DEFAULT_SETTINGS));

/** Sets the settings, notifying only when one has changed. */
export const setMapSettings = (next: MapSettings) => {
  for (const key of ["title", "style", "evolution", "stages", "visibility"] as const) {
    if (JSON.stringify(mapSettings[key]) !== JSON.stringify(next[key]))
      Object.assign(mapSettings, { [key]: structuredClone(next[key]) });
  }
};
