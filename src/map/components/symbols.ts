/**
 * What a component looks like, as plain shapes relative to it, in tokens
 * rather than colours. The canvas (Component.tsx) and the SVG export
 * (mapSvg.ts) both draw these, so the two can't drift apart.
 */
import type { MapSymbol } from "../../model/model";
import type { Role } from "../tokens";
import {
  BORDERS,
  type ComponentConfig,
  futureOf,
  INERTIA,
  type InteractionMode,
  markerRadius,
  reachOf,
  squareHalfSide,
} from "./componentLayout";

export interface Stroke {
  role: Role;
  width: number;
  /** Drawn inside the shape's edge, as markers' borders are, so a thicker one doesn't grow it. */
  inside?: boolean;
}

export type Shape =
  | { kind: "circle"; x: number; y: number; r: number; fill?: Role; stroke?: Stroke }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill?: Role;
      stroke?: Stroke;
    }
  | { kind: "line"; points: [number, number, number, number]; stroke: Stroke }
  | { kind: "polygon"; points: number[]; fill: Role };

/** Text whose box's top left is at `x, y`. */
export interface TextShape {
  x: number;
  y: number;
  text: string;
  fill: Role;
}

/** The parts of a component other than its marker and label. */
export interface Decorations {
  /** Drawn behind the label and the marker. */
  behind: Shape[];
  /** Drawn in front of the label, behind the marker. */
  front: Shape[];
  texts: TextShape[];
}

const circle = (r: number, fill: Role, stroke?: Stroke, x = 0, y = 0): Shape => ({
  kind: "circle",
  x,
  y,
  r,
  fill,
  stroke,
});

/** A market: three parties trading, in a circle (as OnlineWardleyMaps draws it). */
const marketParts = (): Shape[] => {
  const corners = [-90, 30, 150].map((degrees) => {
    const angle = (degrees * Math.PI) / 180;
    return [4.5 * Math.cos(angle), 4.5 * Math.sin(angle)] as const;
  });
  const ink = { role: "ink" as const, width: 1 };
  return [
    ...corners.map(([x1, y1], i): Shape => {
      const [x2, y2] = corners[(i + 1) % corners.length];
      return { kind: "line", points: [x1, y1, x2, y2], stroke: ink };
    }),
    ...corners.map(([x, y]) => circle(1.8, "ink", undefined, x, y)),
  ];
};

/** What sets each symbol apart inside its outline. */
const INSIDE: Record<MapSymbol, () => Shape[]> = {
  component: () => [],
  user: () => [],
  market: marketParts,
  ecosystem: () => [circle(4.5, "paper", { role: "ink", width: 1 })],
  submap: () => [{ kind: "rect", x: -2.5, y: -2.5, width: 5, height: 5, fill: "ink" }],
};

/** Each symbol's fill: a user's is solid, an ecosystem's shaded. */
const FILL: Record<MapSymbol, Role> = {
  component: "paper",
  user: "ink",
  market: "paper",
  ecosystem: "muted",
  submap: "paper",
};

/** The marker: a symbol's shape with a border for the mode, or a pipeline's square. */
export const markerShapes = (config: ComponentConfig, mode: InteractionMode): Shape[] => {
  const border = { ...BORDERS[mode], inside: true };
  if (config.pipeline) {
    const half = squareHalfSide(mode);
    return [
      {
        kind: "rect",
        x: -half,
        y: -half,
        width: 2 * half,
        height: 2 * half,
        fill: "paper",
        stroke: border,
      },
    ];
  }
  const symbol = config.symbol ?? "component";
  return [circle(markerRadius(config), FILL[symbol], border), ...INSIDE[symbol]()];
};

const DASH = 4;
const GAP = 3;
const ARROW = { length: 7, half: 3.5 };

/** A dashed line from `from` to `to` along y = 0. */
const dashes = (from: number, to: number, stroke: Stroke): Shape[] => {
  const sign = Math.sign(to - from);
  const shapes: Shape[] = [];
  for (let at = from; (to - at) * sign > 0; at += sign * (DASH + GAP)) {
    const end = sign > 0 ? Math.min(at + DASH, to) : Math.max(at - DASH, to);
    shapes.push({ kind: "line", points: [at, 0, end, 0], stroke });
  }
  return shapes;
};

/** The red dashed arrow from a component to its future, if there's room for one. */
const arrow = (from: number, dx: number, reach: number): Shape[] => {
  const sign = Math.sign(dx);
  const [start, tip] = [sign * (from + 2), dx - sign * (reach + 2)];
  if ((tip - start) * sign < ARROW.length + DASH) return [];
  const base = tip - sign * ARROW.length;
  const head: Shape = {
    kind: "polygon",
    points: [tip, 0, base, -ARROW.half, base, ARROW.half],
    fill: "future",
  };
  return [...dashes(start, base, { role: "future", width: 1 }), head];
};

const sourcingCircle = (reach: number, sourcing: string, x = 0): Shape =>
  circle(reach, `sourcing.${sourcing}` as Role, undefined, x);

/** The future: its sourcing, the arrow to it, its circle, and its label in red. */
const futureParts = (config: ComponentConfig, parts: Decorations) => {
  const future = futureOf(config);
  if (!future || future.dx === 0) return;
  const { dx, radius, reach } = future;
  const { circle: around, right } = reachOf(config);
  const evolve = config.evolve!;
  if (evolve.sourcing) parts.behind.push(sourcingCircle(reach, evolve.sourcing, dx));
  parts.front.push(
    ...arrow(dx > 0 ? right : around, dx, reach),
    circle(radius, "paper", { role: "future", width: 1, inside: true }, dx),
  );
  const text = evolve.label ?? config.label ?? config.name;
  parts.texts.push({ x: dx + reach + 3, y: -16, text, fill: "future" });
};

/** Sourcing circles, the inertia bar, and the future. */
export const decorations = (config: ComponentConfig): Decorations => {
  const parts: Decorations = { behind: [], front: [], texts: [] };
  const reach = reachOf(config);
  if (config.sourcing) parts.behind.push(sourcingCircle(reach.circle, config.sourcing));
  if (reach.bar !== undefined) {
    const { width, height } = INERTIA;
    parts.front.push({
      kind: "rect",
      x: reach.bar,
      y: -height / 2,
      width,
      height,
      fill: "inertia",
    });
  }
  futureParts(config, parts);
  return parts;
};
