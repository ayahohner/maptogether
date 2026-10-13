import teaShop from "../../examples/tea-shop.twm?raw";
import { DEMO_QUERY } from "../app/room";

export const demoMapText = teaShop;

export interface DemoTarget {
  /** True when this visit created the map, so nobody else has edited it. */
  isNew: boolean;
  text: () => string;
  replace: (text: string) => void;
}

/**
 * Shows the demo map without ever overwriting someone's work: a new, empty
 * map is filled in place; otherwise the demo opens as a new map in a new tab.
 */
export function openDemoMap(
  target: DemoTarget,
  openUrl: (url: string) => void = (url) => window.open(url, "_blank"),
) {
  if (target.isNew && !target.text().trim()) target.replace(demoMapText);
  else openUrl(`/?${DEMO_QUERY}`);
}
