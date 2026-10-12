import type { Tool } from "../state/Tools";
import type { Point } from "./viewport";

/**
 * What the canvas can do, in screen points relative to the canvas. Gestures
 * decide what a press means; the actions do it (see canvasActions.ts).
 */
export interface CanvasActions {
  tool(): Tool;
  /** Node key of the component at `p`, if any. */
  hit(p: Point): string | undefined;
  /** Select (or clear) and start a possible move or marquee. */
  press(nodeKey: string | undefined, p: Point, additive: boolean): void;
  drag(p: Point, additive: boolean): void;
  release(): void;
  /** Select one component, or clear the selection. */
  select(nodeKey: string | undefined): void;
  link(nodeKey: string | undefined): void;
  /** Rename a component, or name a new one at `p`. */
  edit(nodeKey: string | undefined, p: Point): void;
  /** Place a component with the component tool. */
  place(p: Point): void;
  pan(dx: number, dy: number): void;
  zoom(at: Point, factor: number): void;
  /** Feedback when a long press picks a component up. */
  pickedUp(): void;
}

export interface PointerInput {
  id: number;
  point: Point;
  /** 0 main, 1 middle. */
  button: number;
  shift: boolean;
  touch: boolean;
}

export interface WheelInput {
  point: Point;
  dx: number;
  dy: number;
  /** Pinch on a trackpad, or ⌘/Ctrl + scroll. */
  zoom: boolean;
}

/**
 * - pending: waiting to see if it's a tap, a pan (touch) or a long press
 * - drag: moving components or drawing a marquee
 * - pan: moving the view
 */
type Mode = "pending" | "drag" | "pan";

interface Press {
  id: number;
  start: Point;
  last: Point;
  nodeKey: string | undefined;
  touch: boolean;
  mode: Mode;
  moved: boolean;
}

export const DOUBLE_TAP_MS = 300;
export const LONG_PRESS_MS = 400;
const slop = (touch: boolean) => (touch ? 8 : 4);
const repeatRadius = (touch: boolean) => (touch ? 24 : 8);

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export interface Clock {
  now(): number;
  later(fn: () => void, ms: number): () => void;
}

const realClock: Clock = {
  now: () => performance.now(),
  later: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
};

/**
 * Turns pointer input into canvas actions, the same way for mouse, pen and
 * touch where it can:
 *
 * - Mouse: press and drag moves components or draws a marquee; double-click
 *   renames a component or creates one; middle button pans.
 * - Touch: drag pans; press and hold picks up a component to move; tap
 *   selects; double-tap renames or creates; two fingers pinch to zoom.
 * - Tools: hand pans, link taps two components, component places one.
 */
export class Gestures {
  private pointers = new Map<number, Point>();
  private press: Press | undefined;
  private pinch: { distance: number; mid: Point } | undefined;
  private lastTap: { at: Point; time: number } | undefined;
  private cancelLongPress = () => {};

  constructor(
    private actions: CanvasActions,
    private clock: Clock = realClock,
  ) {}

  down(e: PointerInput) {
    this.pointers.set(e.id, e.point);
    if (this.pointers.size === 2) return this.startPinch();
    if (this.pointers.size > 1) return;
    const nodeKey = this.actions.hit(e.point);
    const mode = this.startMode(e, nodeKey);
    this.press = { id: e.id, start: e.point, last: e.point, nodeKey, touch: e.touch, mode, moved: false };
    if (e.touch && nodeKey && this.actions.tool() === "select") this.waitForLongPress(this.press);
  }

  move(e: PointerInput) {
    if (!this.pointers.has(e.id)) return;
    this.pointers.set(e.id, e.point);
    if (this.pinch) return this.updatePinch();
    const press = this.press;
    if (press?.id === e.id) this.movePress(press, e);
  }

  up(e: PointerInput) {
    const press = this.end(e);
    if (press && !press.moved) this.tap(press, e.point);
  }

  cancel(e: PointerInput) {
    this.end(e);
  }

  wheel(e: WheelInput) {
    // Clamped so one notch of a mouse wheel zooms by at most about a third.
    if (e.zoom) this.actions.zoom(e.point, Math.exp(-Math.min(Math.max(e.dy, -30), 30) / 100));
    else this.actions.pan(-e.dx, -e.dy);
  }

  private startMode(e: PointerInput, nodeKey: string | undefined): Mode {
    const tool = this.actions.tool();
    if (tool === "hand" || e.button === 1) return "pan";
    if (e.touch || tool !== "select") return "pending";
    this.actions.press(nodeKey, e.point, e.shift);
    return "drag";
  }

  private waitForLongPress(press: Press) {
    this.cancelLongPress = this.clock.later(() => {
      if (this.press !== press || press.mode !== "pending") return;
      press.mode = "drag";
      this.actions.press(press.nodeKey, press.start, false);
      this.actions.pickedUp();
    }, LONG_PRESS_MS);
  }

  private movePress(press: Press, e: PointerInput) {
    press.moved ||= distance(press.start, e.point) >= slop(press.touch);
    if (press.moved && press.touch && press.mode === "pending") press.mode = "pan";
    if (press.mode === "pan") this.actions.pan(e.point.x - press.last.x, e.point.y - press.last.y);
    if (press.mode === "drag") this.actions.drag(e.point, e.shift);
    press.last = e.point;
  }

  /** Ends the press if `e` is its pointer; returns it. */
  private end(e: PointerInput): Press | undefined {
    this.pointers.delete(e.id);
    if (this.pointers.size < 2) this.pinch = undefined;
    const press = this.press;
    if (press?.id !== e.id) return undefined;
    this.stopPress();
    return press;
  }

  private stopPress() {
    this.cancelLongPress();
    if (this.press?.mode === "drag") this.actions.release();
    this.press = undefined;
  }

  private tap(press: Press, p: Point) {
    const tool = this.actions.tool();
    if (this.isRepeat(p, press.touch) && tool === "select") return this.actions.edit(press.nodeKey, p);
    if (press.mode === "pending") this.toolTap(tool, press.nodeKey, p);
  }

  private toolTap(tool: Tool, nodeKey: string | undefined, p: Point) {
    if (tool === "link") return this.actions.link(nodeKey);
    if (tool === "component" && !nodeKey) return this.actions.place(p);
    if (tool !== "hand") this.actions.select(nodeKey);
  }

  /** A second tap close in time and place to the last; a third starts over. */
  private isRepeat(p: Point, touch: boolean) {
    const time = this.clock.now();
    const last = this.lastTap;
    const repeat = !!last && time - last.time < DOUBLE_TAP_MS && distance(last.at, p) < repeatRadius(touch);
    this.lastTap = repeat ? undefined : { at: p, time };
    return repeat;
  }

  private startPinch() {
    this.stopPress();
    this.pinch = this.measurePinch();
  }

  private updatePinch() {
    const next = this.measurePinch();
    const last = this.pinch!;
    this.actions.pan(next.mid.x - last.mid.x, next.mid.y - last.mid.y);
    this.actions.zoom(next.mid, next.distance / last.distance);
    this.pinch = next;
  }

  private measurePinch() {
    const [a, b] = [...this.pointers.values()];
    return { distance: Math.max(distance(a, b), 1), mid: midpoint(a, b) };
  }
}

/** Wheel deltas in px, whatever unit the browser reports them in. */
export function wheelPixels(e: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode">) {
  const unit = [1, 16, 400][e.deltaMode] ?? 1;
  return { dx: e.deltaX * unit, dy: e.deltaY * unit };
}

/**
 * Feeds a canvas's pointer, wheel and Safari trackpad-pinch events to
 * `gestures`. Returns a function that unbinds them.
 */
export function bindGestures(canvas: HTMLElement, gestures: Gestures) {
  const local = (e: MouseEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const input = (e: PointerEvent): PointerInput => ({
    id: e.pointerId,
    point: local(e),
    button: e.button,
    shift: e.shiftKey,
    touch: e.pointerType === "touch",
  });
  let gestureScale = 1;
  const listeners: [string, (e: any) => void][] = [
    ["pointerdown", (e: PointerEvent) => {
      // Stops the browser's own touch handling and text selection. That also
      // stops focus moving, so end typing in the editor or a name field here.
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
      gestures.down(input(e));
      canvas.setPointerCapture?.(e.pointerId);
    }],
    ["pointermove", (e: PointerEvent) => gestures.move(input(e))],
    ["pointerup", (e: PointerEvent) => gestures.up(input(e))],
    ["pointercancel", (e: PointerEvent) => gestures.cancel(input(e))],
    ["wheel", (e: WheelEvent) => {
      e.preventDefault();
      gestures.wheel({ point: local(e), zoom: e.ctrlKey || e.metaKey, ...wheelPixels(e) });
    }],
    // Safari reports trackpad pinches as gesture events rather than wheels.
    ["gesturestart", (e: Event) => {
      e.preventDefault();
      gestureScale = 1;
    }],
    ["gesturechange", (e: Event & { scale: number; clientX: number; clientY: number }) => {
      e.preventDefault();
      gestures.wheel({ point: local(e as unknown as MouseEvent), dx: 0, dy: -100 * Math.log(e.scale / gestureScale), zoom: true });
      gestureScale = e.scale;
    }],
  ];
  for (const [type, fn] of listeners) canvas.addEventListener(type, fn, { passive: false });
  return () => {
    for (const [type, fn] of listeners) canvas.removeEventListener(type, fn);
  };
}
