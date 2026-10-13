import type { StateT } from "../../state/State";

export interface ComponentConfig {
  /** Position in pixels. */
  x: number;
  y: number;
  name: string;
  /** Set for a component inside a pipeline. */
  inPipeline?: boolean;
  /** Set for a pipeline: the x of each component it holds. */
  pipeline?: number[];
}

/** How a component's marker is drawn, from what is being done on the canvas. */
export type InteractionMode = "default" | "selected" | "targetable" | "targeted";

/** Marker border for each interaction mode. */
export const BORDERS: Record<InteractionMode, { width: number; color: number }> = {
  default: { width: 1, color: 0x000000 },
  selected: { width: 2, color: 0x9b5af9 },
  targetable: { width: 2, color: 0x059669 },
  targeted: { width: 2, color: 0x6ee7b7 },
};

/**
 * Half the side of a pipeline's square marker. The border is drawn inside the
 * square, so the square grows with a thicker border to keep its inside the same.
 */
export const squareHalfSide = (mode: InteractionMode) => (mode === "default" ? 5 : 5.5);

export const modeOf = (state: StateT, name: string): InteractionMode => {
  if (state.linking.isLinkModeEnabled) {
    return state.linking.initialLinkTarget === name ? "targeted" : "targetable";
  }
  return state.selection.selectionItems.has(name) ? "selected" : "default";
};

/** Space between a pipeline's box and its outermost components. */
const PIPE_PADDING = 10;

/** A pipeline's box, from the pipeline's x and its components' x, relative to the pipeline. */
export const pipelineBox = (x: number, childXs: number[]) => {
  const left = Math.min(x, ...childXs);
  const right = Math.max(x, ...childXs);
  return { offset: left - x - PIPE_PADDING, width: right - left + 2 * PIPE_PADDING };
};

/**
 * Where a component's parts go. A pipeline's components sit lower, inside its
 * box and in front of it, with labels at an angle so neighbours don't overlap.
 */
export const layoutComponent = ({ x, y, inPipeline, pipeline }: ComponentConfig) => {
  const pipe = pipeline?.length ? pipelineBox(x, pipeline) : undefined;
  if (inPipeline) {
    return { y: y + 12, zIndex: 1, pipe, label: { x: 9, y: 10, rotation: Math.PI / 6 } };
  }
  return { y, zIndex: 0, pipe, label: { x: 9, y: pipe ? -18 : -16, rotation: 0 } };
};
