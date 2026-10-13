import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tool } from "../state/Tools";
import {
  bindGestures,
  DOUBLE_TAP_MS,
  Gestures,
  wheelPixels,
  type CanvasActions,
  type Clock,
  type PointerInput,
} from "./gestures";

/** A component "A" sits at x 0–10; everything else is empty canvas. */
const hit = (p: { x: number }) => (p.x <= 10 ? "A" : undefined);

let tool: Tool;
let actions: { [K in keyof CanvasActions]: ReturnType<typeof vi.fn> };
let time: number;
let pending: (() => void) | undefined;
let gestures: Gestures;

const clock: Clock = {
  now: () => time,
  later: (fn) => {
    pending = fn;
    return () => (pending = undefined);
  },
};

beforeEach(() => {
  tool = "select";
  time = 0;
  pending = undefined;
  actions = {
    tool: vi.fn(() => tool),
    hit: vi.fn(hit),
    press: vi.fn(),
    drag: vi.fn(),
    release: vi.fn(),
    select: vi.fn(),
    link: vi.fn(),
    edit: vi.fn(),
    place: vi.fn(),
    pan: vi.fn(),
    zoom: vi.fn(),
    pickedUp: vi.fn(),
  };
  gestures = new Gestures(actions as CanvasActions, clock);
});

const at = (x: number, y = 0, more: Partial<PointerInput> = {}): PointerInput => ({
  id: 1,
  point: { x, y },
  button: 0,
  shift: false,
  touch: false,
  ...more,
});
const touchAt = (x: number, y = 0, id = 1) => at(x, y, { touch: true, id });

/** Press and release without moving. */
const tap = (input: PointerInput) => {
  gestures.down(input);
  gestures.up(input);
};

describe("mouse", () => {
  it("presses, drags and releases components or a marquee", () => {
    gestures.down(at(5, 0, { shift: true }));
    expect(actions.press).toHaveBeenCalledWith("A", { x: 5, y: 0 }, true);
    gestures.move(at(50, 20, { shift: true }));
    expect(actions.drag).toHaveBeenCalledWith({ x: 50, y: 20 }, true);
    gestures.up(at(50, 20));
    expect(actions.release).toHaveBeenCalledOnce();
    expect(actions.edit).not.toHaveBeenCalled();
  });

  it("ignores moves without a press", () => {
    gestures.move(at(50));
    expect(actions.drag).not.toHaveBeenCalled();
  });

  it("double-click renames a component or creates one", () => {
    tap(at(5));
    time = 100;
    tap(at(6));
    expect(actions.edit).toHaveBeenCalledWith("A", { x: 6, y: 0 });
    time = 1000;
    tap(at(50));
    time = 1100;
    tap(at(51));
    expect(actions.edit).toHaveBeenLastCalledWith(undefined, { x: 51, y: 0 });
  });

  it("doesn't count slow or distant clicks, or a third click", () => {
    tap(at(50));
    time = DOUBLE_TAP_MS + 1;
    tap(at(50));
    tap(at(80));
    expect(actions.edit).not.toHaveBeenCalled();
    tap(at(80));
    tap(at(80));
    expect(actions.edit).toHaveBeenCalledOnce();
  });

  it("pans with the middle button or the hand tool", () => {
    gestures.down(at(50, 0, { button: 1 }));
    gestures.move(at(60, 5, { button: 1 }));
    expect(actions.pan).toHaveBeenCalledWith(10, 5);
    gestures.up(at(60, 5));
    tool = "hand";
    gestures.down(at(50));
    gestures.move(at(40));
    expect(actions.pan).toHaveBeenLastCalledWith(-10, 0);
    gestures.up(at(40));
    expect(actions.press).not.toHaveBeenCalled();
    expect(actions.select).not.toHaveBeenCalled();
  });

  it("links with the link tool, on click", () => {
    tool = "link";
    tap(at(5));
    expect(actions.link).toHaveBeenCalledWith("A");
    tap(at(50));
    expect(actions.link).toHaveBeenLastCalledWith(undefined);
    expect(actions.press).not.toHaveBeenCalled();
  });

  it("places a component with the component tool, or selects one", () => {
    tool = "component";
    tap(at(50));
    expect(actions.place).toHaveBeenCalledWith({ x: 50, y: 0 });
    time = 1000;
    tap(at(5));
    expect(actions.select).toHaveBeenCalledWith("A", { x: 5, y: 0 }, false);
  });

  it("doesn't treat a drag with a tool as a click", () => {
    tool = "link";
    gestures.down(at(50));
    gestures.move(at(90));
    gestures.up(at(90));
    expect(actions.link).not.toHaveBeenCalled();
    expect(actions.pan).not.toHaveBeenCalled();
  });
});

describe("touch", () => {
  it("pans with one finger, even from a component", () => {
    gestures.down(touchAt(5));
    gestures.move(touchAt(20));
    gestures.move(touchAt(30, 4));
    expect(actions.pan.mock.calls).toEqual([
      [15, 0],
      [10, 4],
    ]);
    gestures.up(touchAt(30, 4));
    expect(actions.press).not.toHaveBeenCalled();
    expect(actions.select).not.toHaveBeenCalled();
  });

  it("allows a little movement in a tap", () => {
    gestures.down(touchAt(50));
    gestures.move(touchAt(54));
    gestures.up(touchAt(54));
    expect(actions.pan).not.toHaveBeenCalled();
    expect(actions.select).toHaveBeenCalledWith(undefined, { x: 54, y: 0 }, true);
  });

  it("taps to select, and double-taps to rename or create", () => {
    tap(touchAt(5));
    expect(actions.select).toHaveBeenCalledWith("A", { x: 5, y: 0 }, true);
    time = 200;
    tap(touchAt(9, 10));
    expect(actions.edit).toHaveBeenCalledWith("A", { x: 9, y: 10 });
  });

  it("presses and holds to pick up a component, then drags it", () => {
    gestures.down(touchAt(5));
    expect(actions.press).not.toHaveBeenCalled();
    pending!();
    expect(actions.press).toHaveBeenCalledWith("A", { x: 5, y: 0 }, false);
    expect(actions.pickedUp).toHaveBeenCalled();
    gestures.move(touchAt(40));
    expect(actions.drag).toHaveBeenCalledWith({ x: 40, y: 0 }, false);
    expect(actions.pan).not.toHaveBeenCalled();
    gestures.up(touchAt(40));
    expect(actions.release).toHaveBeenCalledOnce();
  });

  it("only waits for a long press on a component with the select tool", () => {
    gestures.down(touchAt(50));
    expect(pending).toBeUndefined();
    gestures.up(touchAt(50));
    tool = "link";
    gestures.down(touchAt(5));
    expect(pending).toBeUndefined();
  });

  it("cancels the long press once the finger moves or lifts", () => {
    gestures.down(touchAt(5));
    const fire = pending!;
    gestures.move(touchAt(30));
    fire();
    expect(actions.press).not.toHaveBeenCalled();
    gestures.up(touchAt(30));
    expect(pending).toBeUndefined();
  });

  it("pinches to zoom and pan, and ignores the finger left behind", () => {
    gestures.down(touchAt(100, 0, 1));
    gestures.down(touchAt(200, 0, 2));
    gestures.move(touchAt(50, 0, 1));
    expect(actions.pan).toHaveBeenLastCalledWith(-25, 0);
    expect(actions.zoom).toHaveBeenLastCalledWith({ x: 125, y: 0 }, 1.5);
    gestures.up(touchAt(50, 0, 1));
    gestures.move(touchAt(260, 0, 2));
    gestures.up(touchAt(260, 0, 2));
    expect(actions.zoom).toHaveBeenCalledOnce();
    expect(actions.select).not.toHaveBeenCalled();
  });

  it("drops a move in progress when a second finger lands", () => {
    gestures.down(touchAt(5, 0, 1));
    pending!();
    gestures.down(touchAt(100, 0, 2));
    expect(actions.release).toHaveBeenCalledOnce();
    // A third finger doesn't start anything either.
    gestures.down(touchAt(150, 0, 3));
    expect(actions.hit).toHaveBeenCalledOnce();
  });

  it("does nothing on a cancelled touch", () => {
    gestures.down(touchAt(50));
    gestures.cancel(touchAt(50));
    expect(actions.select).not.toHaveBeenCalled();
  });

  it("does nothing on a tap with the hand tool", () => {
    tool = "hand";
    tap(touchAt(5));
    expect(actions.select).not.toHaveBeenCalled();
  });
});

describe("wheel", () => {
  it("pans, or zooms with a pinch or modifier", () => {
    gestures.wheel({ point: { x: 1, y: 2 }, dx: 3, dy: 4, zoom: false });
    expect(actions.pan).toHaveBeenCalledWith(-3, -4);
    gestures.wheel({ point: { x: 1, y: 2 }, dx: 0, dy: -10, zoom: true });
    expect(actions.zoom).toHaveBeenCalledWith({ x: 1, y: 2 }, Math.exp(0.1));
  });

  it("limits how far one wheel notch zooms", () => {
    gestures.wheel({ point: { x: 0, y: 0 }, dx: 0, dy: 500, zoom: true });
    expect(actions.zoom).toHaveBeenCalledWith({ x: 0, y: 0 }, Math.exp(-0.3));
  });

  it("converts wheel deltas to pixels", () => {
    expect(wheelPixels({ deltaX: 1, deltaY: 2, deltaMode: 0 })).toEqual({ dx: 1, dy: 2 });
    expect(wheelPixels({ deltaX: 1, deltaY: 2, deltaMode: 1 })).toEqual({ dx: 16, dy: 32 });
    expect(wheelPixels({ deltaX: 0, deltaY: 1, deltaMode: 2 })).toEqual({ dx: 0, dy: 400 });
    expect(wheelPixels({ deltaX: 0, deltaY: 1, deltaMode: 9 })).toEqual({ dx: 0, dy: 1 });
  });
});

describe("bindGestures", () => {
  let canvas: HTMLElement;
  let target: { [K in "down" | "move" | "up" | "cancel" | "wheel"]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    document.body.innerHTML = `<input id="field"><canvas></canvas>`;
    canvas = document.querySelector("canvas")!;
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
    target = { down: vi.fn(), move: vi.fn(), up: vi.fn(), cancel: vi.fn(), wheel: vi.fn() };
  });

  const pointer = (type: string, init: PointerEventInit = {}) => {
    const event = new PointerEvent(type, {
      clientX: 15,
      clientY: 30,
      pointerId: 3,
      cancelable: true,
      ...init,
    });
    canvas.dispatchEvent(event);
    return event;
  };

  it("feeds pointer events in canvas coordinates", () => {
    const unbind = bindGestures(canvas, target as unknown as Gestures);
    const down = pointer("pointerdown", { pointerType: "touch", shiftKey: true });
    expect(down.defaultPrevented).toBe(true);
    expect(target.down).toHaveBeenCalledWith({
      id: 3,
      point: { x: 5, y: 10 },
      button: 0,
      shift: true,
      touch: true,
    });
    pointer("pointermove");
    pointer("pointerup");
    pointer("pointercancel");
    expect(target.move).toHaveBeenCalled();
    expect(target.up).toHaveBeenCalled();
    expect(target.cancel).toHaveBeenCalled();
    unbind();
    pointer("pointermove");
    expect(target.move).toHaveBeenCalledOnce();
  });

  it("takes focus from fields when the canvas is pressed", () => {
    bindGestures(canvas, target as unknown as Gestures);
    const field = document.getElementById("field")!;
    field.focus();
    pointer("pointerdown");
    expect(document.activeElement).not.toBe(field);
  });

  it("stops middle-button autoscroll", () => {
    bindGestures(canvas, target as unknown as Gestures);
    const press = (button: number) => {
      const event = new MouseEvent("mousedown", { button, cancelable: true });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press(1)).toBe(true);
    expect(press(0)).toBe(false);
  });

  it("feeds wheels, zooming with a modifier", () => {
    bindGestures(canvas, target as unknown as Gestures);
    const wheel = new WheelEvent("wheel", { deltaY: 4, ctrlKey: true, cancelable: true });
    // happy-dom's WheelEvent ignores the MouseEvent fields.
    Object.defineProperties(wheel, {
      clientX: { value: 15 },
      clientY: { value: 30 },
      ctrlKey: { value: true },
    });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(target.wheel).toHaveBeenCalledWith({ point: { x: 5, y: 10 }, zoom: true, dx: 0, dy: 4 });
  });

  it("feeds Safari trackpad pinches as zooms", () => {
    bindGestures(canvas, target as unknown as Gestures);
    const gesture = (type: string, scale: number) =>
      canvas.dispatchEvent(
        Object.assign(new Event(type, { cancelable: true }), { scale, clientX: 15, clientY: 30 }),
      );
    gesture("gesturestart", 1);
    gesture("gesturechange", 2);
    const [{ point, dy, zoom }] = target.wheel.mock.calls[0];
    expect({ point, zoom }).toEqual({ point: { x: 5, y: 10 }, zoom: true });
    expect(Math.exp(-dy / 100)).toBeCloseTo(2);
  });
});
