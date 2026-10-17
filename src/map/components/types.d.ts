import type { Container, Graphics } from "pixi.js";

/** A component's drawing: its marker, label and, for a pipeline, its box. */
export type ComponentT = Container & {
  nodeKey: string;
  /** For a pipeline, redraws its box around its components at `childXs` (px). */
  fitPipe: (childXs: number[]) => void;
  /** Whether a screen point is on its label. */
  onLabel: (screen: { x: number; y: number }) => boolean;
  /** Moves its label by (x, y) px; returns where the label now is, from the component. */
  moveLabelBy: (x: number, y: number) => { x: number; y: number };
};

export type LineT = Container & {
  nodeKey: string;
  /** The line itself, without its label. */
  line: Graphics;
  /** Moves the line's ends. */
  updateLine: (ax: number, ay: number, bx: number, by: number) => void;
};
