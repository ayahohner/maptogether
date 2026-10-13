import type { Container, Graphics } from "pixi.js";

/** A component's drawing: its marker, label and, for a pipeline, its box. */
export type ComponentT = Container & {
  nodeKey: string;
  /** For a pipeline, redraws its box around its components at `childXs` (px). */
  fitPipe: (childXs: number[]) => void;
};

export type LineT = Graphics & {
  nodeKey: string;
  /** Moves the line's ends. */
  updateLine: (ax: number, ay: number, bx: number, by: number) => void;
};
