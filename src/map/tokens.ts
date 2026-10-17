/**
 * The map's semantic colour tokens: what each colour is for, not what it is
 * (docs/syntax/proposal-v2.md, "Types, styles and design tokens"). The canvas
 * and the SVG export both draw from these, so a style can later swap the set.
 * Meaning never rests on hue alone: the future is dashed as well as red, and
 * sourcing differs in lightness.
 */
import type { Style } from "../model/keys";

export const MAP_TOKENS = {
  /** Lines, outlines and labels. */
  ink: "#000000",
  /** Inside markers. */
  paper: "#ffffff",
  /** Behind the map, and behind labels so lines don't run through them. */
  canvas: "#f7f7f8",
  /** Fill that sets a symbol apart without competing with ink. */
  muted: "#e4e4e7",
  /** Where a component is going: `evolve`. */
  future: "#dc2626",
  /** Value, money or risk moving along a link: `flow`. */
  flow: "#2563eb",
  inertia: "#000000",
  "sourcing.build": "#d4d4d8",
  "sourcing.buy": "#a1a1aa",
  "sourcing.outsource": "#52525b",
  /** Interaction states, which the canvas draws and the export never does. */
  selected: "#9b5af9",
  targetable: "#059669",
  targeted: "#6ee7b7",
} as const;

export type Role = keyof typeof MAP_TOKENS;

/**
 * Each style's value for every role. `plain` is black on white, for print:
 * the future keeps its dashes and flow its label, so nothing rests on colour.
 */
export const STYLE_TOKENS: Record<Style, Record<Role, string>> = {
  wardley: MAP_TOKENS,
  plain: { ...MAP_TOKENS, canvas: MAP_TOKENS.paper, future: MAP_TOKENS.ink, flow: MAP_TOKENS.ink },
};

let style: Style = "wardley";

/** Sets the style the canvas draws in; returns whether it changed, so the map is drawn anew. */
export const setStyle = (next: Style) => {
  const changed = next !== style;
  style = next;
  return changed;
};

/** A token's colour in the canvas's style, as Pixi takes it. */
export const pixiColor = (role: Role) => Number.parseInt(STYLE_TOKENS[style][role].slice(1), 16);
