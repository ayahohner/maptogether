import { nanoid } from "./utilities/NanoId";

/** `/?demo` opens a new map filled with the demo map. */
export const DEMO_QUERY = "demo";

export interface Room {
  /** The map id: the URL path. */
  id: string;
  /** True when this visit created the map (the URL had no map id). */
  isNew: boolean;
  /** True when a new map should start from the demo map. */
  wantsDemo: boolean;
}

/**
 * Reads the map id from the URL; on `/` creates a new map and moves the URL
 * to it (dropping any query, such as `?demo`).
 */
export function resolveRoom(
  location: Pick<Location, "pathname" | "search">,
  replaceUrl: (path: string) => void,
  makeId: () => string = () => nanoid(8),
): Room {
  const existing = location.pathname.replace("/", "");
  if (existing) return { id: existing, isNew: false, wantsDemo: false };
  const id = makeId();
  replaceUrl(`/${id}`);
  const wantsDemo = new URLSearchParams(location.search).has(DEMO_QUERY);
  return { id, isNew: true, wantsDemo };
}
