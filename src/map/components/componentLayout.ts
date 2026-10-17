import type { Sourcing } from "../../model/keys";
import type { MapSymbol } from "../../model/model";
import type { StateT } from "../../state/State";
import type { Role } from "../tokens";

export interface ComponentConfig {
  /** Position in pixels. */
  x: number;
  y: number;
  name: string;
  /** Its symbol; a plain component's circle if not given. */
  symbol?: MapSymbol;
  /** The text drawn for it, if not its name. */
  label?: string;
  /** Where its label sits (px from it), once placed. */
  labelOffset?: { x: number; y: number };
  sourcing?: Sourcing;
  inertia?: boolean;
  /** Where it's going: `x` in pixels, and how it differs there. */
  evolve?: { x: number; label?: string; sourcing?: Sourcing };
  /** Set for a component inside a pipeline: the pipeline's name. */
  inPipeline?: string;
  /** Set for a pipeline: the x of each component it holds. */
  pipeline?: number[];
}

/** How a component's marker is drawn, from what is being done on the canvas. */
export type InteractionMode = "default" | "selected" | "targetable" | "targeted";

/** Marker border for each interaction mode. */
export const BORDERS: Record<InteractionMode, { width: number; role: Role }> = {
  default: { width: 1, role: "ink" },
  selected: { width: 2, role: "selected" },
  targetable: { width: 2, role: "targetable" },
  targeted: { width: 2, role: "targeted" },
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

/** A marker's radius: markets and ecosystems are drawn larger, as they hold more. */
export const markerRadius = ({ symbol, pipeline }: ComponentConfig) =>
  !pipeline && (symbol === "market" || symbol === "ecosystem") ? 9 : 6;

/** How far a sourcing circle reaches past the marker. */
const SOURCING_REACH = 8;
/** The inertia bar's size, and its gap from what it stands beside. */
export const INERTIA = { width: 5, height: 24, gap: 4 };

/**
 * How far right of a component its marker, sourcing circle and inertia bar
 * reach, and where the bar starts, if it has one.
 */
export const reachOf = (config: ComponentConfig) => {
  const circle = markerRadius(config) + (config.sourcing ? SOURCING_REACH : 0);
  if (!config.inertia) return { circle, right: circle };
  const bar = circle + INERTIA.gap;
  return { circle, bar, right: bar + INERTIA.width };
};

/** The future's circle, `dx` px along from the component, and how far its sourcing reaches. */
export const futureOf = (config: ComponentConfig) => {
  if (!config.evolve) return undefined;
  const radius = markerRadius(config);
  const reach = radius + (config.evolve.sourcing ? SOURCING_REACH : 0);
  return { dx: config.evolve.x - config.x, radius, reach };
};

/**
 * Where a component's parts go. A pipeline's components sit lower, inside its
 * box and in front of it, with labels at an angle so neighbours don't overlap.
 * A label starts clear of the marker and anything drawn beside it, unless it's
 * been placed.
 */
export const layoutComponent = (config: ComponentConfig) => {
  const { x, y, inPipeline, pipeline, labelOffset } = config;
  const pipe = pipeline?.length ? pipelineBox(x, pipeline) : undefined;
  const label = labelOffset ? { ...labelOffset, rotation: 0 } : defaultLabel(config, !!pipe);
  return inPipeline ? { y: y + 12, zIndex: 1, pipe, label } : { y, zIndex: 0, pipe, label };
};

/** Where a label goes until it's placed: right of everything beside the component. */
const defaultLabel = (config: ComponentConfig, boxed: boolean) => {
  const x = reachOf(config).right + 3;
  if (config.inPipeline) return { x, y: 10, rotation: Math.PI / 6 };
  if (boxed) return { x, y: -18, rotation: 0 };
  // Lifted clear of a larger marker, and of the arrow to its future.
  const lift = markerRadius(config) - 6 + ((futureOf(config)?.dx ?? 0) > 0 ? 6 : 0);
  return { x, y: -16 - lift, rotation: 0 };
};
