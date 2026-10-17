import { importOwm } from "../import/owm";
import { IMPORT_QUERY, type Room } from "./room";

/** Where a map waits for the new tab that opens it. */
const IMPORT_KEY = "maptogether:import";

export interface ImportTarget {
  /** True when this visit created the map, so nobody else has edited it. */
  isNew: boolean;
  text: () => string;
  replace: (text: string) => void;
}

/**
 * Opens OnlineWardleyMaps text, converted, as a new map. A new, empty map is
 * filled in place; otherwise the map opens in a new tab, which picks it up
 * from storage, so it never overwrites someone's work.
 */
export function openImportedMap(
  owm: string,
  target: ImportTarget,
  storage: Pick<Storage, "setItem">,
  openUrl: (url: string) => void = (url) => window.open(url, "_blank"),
) {
  const { text } = importOwm(owm);
  if (target.isNew && !target.text().trim()) return target.replace(text);
  storage.setItem(IMPORT_KEY, text);
  openUrl(`/?${IMPORT_QUERY}`);
}

/** The imported map a `/?import` visit should start from, taken so a reload doesn't repeat it. */
export function takeImportedMap(room: Room, storage: Pick<Storage, "getItem" | "removeItem">) {
  if (!room.wantsImport) return;
  const text = storage.getItem(IMPORT_KEY);
  storage.removeItem(IMPORT_KEY);
  return text ?? undefined;
}
