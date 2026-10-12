import {
  dragTo,
  fit,
  initialPanel,
  isCollapsed,
  release,
  toggle,
  type PanelLimits,
  type PanelState,
} from "./editorPanel";

/** Movement (px) before a press on the divider counts as a drag. */
const DRAG_THRESHOLD = 3;
const KEY_STEP = 24;
const MOBILE_QUERY = "(max-width: 639px)";

/** Panel limits for the current viewport. */
export function panelLimits(container: HTMLElement, divider: HTMLElement): PanelLimits {
  const mobile = window.matchMedia?.(MOBILE_QUERY).matches ?? false;
  const available = container.clientWidth - divider.offsetWidth;
  // On desktop always leave some map visible; on phones the editor may cover it.
  const maxWidth = Math.max(0, mobile ? available : available - 160);
  const defaultWidth = Math.min(maxWidth, Math.max(380, Math.round(available * 0.3)));
  return { defaultWidth, maxWidth, snapWidth: 48, mobile };
}

/**
 * Binds the divider between the map and the code editor (see editorPanel.ts
 * for the rules). Works with mouse, pen, touch and keyboard.
 */
export function initializePanelResizer(
  panel: HTMLElement,
  divider: HTMLElement,
  onResize: () => void,
  limits: () => PanelLimits = () => panelLimits(panel.parentElement!, divider),
) {
  let state = initialPanel(limits());
  let press: { x: number; width: number; dragging: boolean } | undefined;

  const apply = (next: PanelState) => {
    state = next;
    panel.style.setProperty("--editor-width", `${state.width}px`);
    panel.inert = isCollapsed(state);
    divider.setAttribute("aria-valuenow", String(state.width));
    onResize();
  };

  divider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    divider.setPointerCapture?.(event.pointerId);
    press = { x: event.clientX, width: state.width, dragging: false };
  });

  divider.addEventListener("pointermove", (event) => {
    if (!press) return;
    const dx = press.x - event.clientX;
    press.dragging ||= Math.abs(dx) >= DRAG_THRESHOLD;
    if (!press.dragging) return;
    divider.classList.add("dragging");
    apply(dragTo(state, press.width + dx, limits()));
  });

  // A press that never moved is a click; a cancelled click changes nothing.
  const endPress = (event: PointerEvent) => {
    if (!press) return;
    const end = press.dragging ? release : event.type === "pointerup" ? toggle : unchanged;
    press = undefined;
    divider.classList.remove("dragging");
    apply(end(state, limits()));
  };
  divider.addEventListener("pointerup", endPress);
  divider.addEventListener("pointercancel", endPress);
  divider.addEventListener("keydown", (event) => onKey(event, state, limits(), apply));
  window.addEventListener("resize", () => apply(fit(state, limits())));

  apply(state);
  return { state: () => state };
}

const unchanged = (state: PanelState) => state;

const keySteps: Record<string, number> = { ArrowLeft: KEY_STEP, ArrowRight: -KEY_STEP };

function onKey(event: KeyboardEvent, state: PanelState, limits: PanelLimits, apply: (s: PanelState) => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    apply(toggle(state, limits));
  } else if (event.key in keySteps) {
    event.preventDefault();
    apply(release(dragTo(state, state.width + keySteps[event.key], limits), limits));
  }
}
