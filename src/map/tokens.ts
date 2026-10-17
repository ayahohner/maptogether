/**
 * The map's semantic colour tokens: what each colour is for, not what it is
 * (docs/syntax/proposal-v2.md, "Types, styles and design tokens"). The canvas
 * and the SVG export both draw from these, so a style can later swap the set.
 * Meaning never rests on hue alone: the future is dashed as well as red, and
 * sourcing differs in lightness.
 */
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

/** A token's colour as Pixi takes it. */
export const pixiColor = (role: Role) => Number.parseInt(MAP_TOKENS[role].slice(1), 16);
