/**
 * Width of the code editor panel, as driven by the divider beside it.
 *
 * - Click: collapse; click again to reopen at the last width it was
 *   dragged to (or the default width).
 * - Drag: resize. Releasing within `snapWidth` of the edge snaps it closed,
 *   and the next click reopens at the default width rather than the sliver
 *   it was dragged to, so it can't reopen too narrow to notice.
 * - On phones, a click toggles between collapsed and the full width.
 */
export interface PanelState {
  /** Current width in px; 0 means collapsed. */
  width: number;
  /** Width a click reopens to. */
  lastOpenWidth: number;
}

export interface PanelLimits {
  defaultWidth: number;
  maxWidth: number;
  snapWidth: number;
  mobile: boolean;
}

export const isCollapsed = (state: PanelState) => state.width === 0;

export const initialPanel = (limits: PanelLimits): PanelState => ({
  width: limits.mobile ? 0 : limits.defaultWidth,
  lastOpenWidth: limits.defaultWidth,
});

const clamp = (width: number, limits: PanelLimits) =>
  Math.round(Math.min(Math.max(width, 0), limits.maxWidth));

/** Live width while the divider is dragged. */
export const dragTo = (state: PanelState, width: number, limits: PanelLimits): PanelState => ({
  ...state,
  width: clamp(width, limits),
});

/** End of a drag: snap closed near the edge, else remember the width. */
export const release = (state: PanelState, limits: PanelLimits): PanelState =>
  state.width < limits.snapWidth
    ? { width: 0, lastOpenWidth: limits.defaultWidth }
    : { width: state.width, lastOpenWidth: state.width };

/** A click on the divider. */
export const toggle = (state: PanelState, limits: PanelLimits): PanelState => {
  if (!isCollapsed(state)) return { width: 0, lastOpenWidth: state.width };
  const width = limits.mobile ? limits.maxWidth : state.lastOpenWidth;
  return { width: clamp(width, limits), lastOpenWidth: state.lastOpenWidth };
};

/** Keeps the panel inside a resized window. */
export const fit = (state: PanelState, limits: PanelLimits): PanelState =>
  state.width > limits.maxWidth ? { ...state, width: limits.maxWidth } : state;
