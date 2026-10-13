import { nanoid } from "./utilities/NanoId";

/** `/?demo` opens a new map filled with the demo map. */
export const DEMO_QUERY = "demo";

export interface Room {
  /** The map id: the URL path. Unset until a new map is created. */
  id?: string;
  /** True when this visit started a new map (the URL had no map id). */
  isNew: boolean;
  /** True when a new map should start from the demo map. */
  wantsDemo: boolean;
}

/**
 * Reads the map id from the URL. `/` is a draft: it has no id, URL or relay
 * connection until someone edits it or shares it (see `mapLifecycle`), so
 * visits that only look, including crawlers, create nothing.
 */
export function resolveRoom(location: Pick<Location, "pathname" | "search">): Room {
  const existing = location.pathname.replace("/", "");
  if (existing) return { id: existing, isNew: false, wantsDemo: false };
  return { isNew: true, wantsDemo: new URLSearchParams(location.search).has(DEMO_QUERY) };
}

export interface LifecycleHooks {
  /** Starts loading, saving and sharing the map with this id. */
  connect: (id: string) => void;
  /** Moves the page URL to the new map, and the like. */
  created: (path: string) => void;
  makeId?: () => string;
}

export interface MapLifecycle {
  /** Creates the map if it is still a draft; returns its URL path. */
  create: () => string;
  /** Marks text the visitor didn't write (the demo), so it doesn't create the map. */
  setUnedited: (text: string) => void;
  /** Call on every text change: the first real edit creates the map. */
  textChanged: (text: () => string) => void;
}

/** Connects an existing map now and a draft once it is edited or shared. */
export function mapLifecycle(room: Room, hooks: LifecycleHooks): MapLifecycle {
  const { makeId = () => nanoid(8) } = hooks;
  let unedited = "";
  const create = () => {
    if (!room.id) {
      room.id = makeId();
      hooks.created(`/${room.id}`);
      hooks.connect(room.id);
    }
    return `/${room.id}`;
  };
  if (room.id) hooks.connect(room.id);
  return {
    create,
    setUnedited: (text) => {
      unedited = text;
    },
    textChanged: (text) => {
      if (room.id) return;
      const now = text();
      if (now.trim() && now !== unedited) create();
    },
  };
}
