import type { Room } from "../app/room";
import { initializeAbout } from "./about";
import { demoMapText, openDemoMap } from "./demo";

export interface MapText {
  text: () => string;
  replace: (text: string) => void;
}

/**
 * Starts a `/?demo` map from the demo, shows the welcome on a first visit, and
 * returns the "open the demo map" action for the menu.
 */
export function initializeOnboarding(
  room: Room,
  map: MapText,
  dialog: HTMLDialogElement,
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  const openDemo = () => openDemoMap({ isNew: room.isNew, ...map });
  if (room.wantsDemo) map.replace(demoMapText);
  initializeAbout(dialog, { storage, isNewMap: room.isNew && !room.wantsDemo, onDemo: openDemo });
  return openDemo;
}
