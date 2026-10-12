import { proxy } from "valtio/vanilla";

export interface Point {
  x: number;
  y: number;
}

/** Pan (screen px) and zoom of the map: screen = world × scale + (x, y). */
export interface View {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 3;

export const viewport = proxy<View>({ x: 0, y: 0, scale: 1 });

export const toWorld = (view: View, p: Point): Point => ({
  x: (p.x - view.x) / view.scale,
  y: (p.y - view.y) / view.scale,
});

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** Zooms by `factor`, keeping the screen point `at` still. */
export const zoomAt = (view: View, at: Point, factor: number): View => {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale;
  return { scale, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k };
};

export const panView = (dx: number, dy: number) => {
  viewport.x += dx;
  viewport.y += dy;
};

export const zoomView = (at: Point, factor: number) => Object.assign(viewport, zoomAt(viewport, at, factor));

/** Zooms around the middle of `el` (the zoom buttons). */
export const zoomCentered = (el: HTMLElement, factor: number) =>
  zoomView({ x: el.clientWidth / 2, y: el.clientHeight / 2 }, factor);

export const resetView = () => Object.assign(viewport, { x: 0, y: 0, scale: 1 });

interface Transformable {
  position: { set(x: number, y: number): void };
  scale: { set(s: number): void };
}

/**
 * Applies the view to the Pixi world container, and to the HTML overlays
 * (axes, cursors) through CSS variables on the map element.
 */
export const applyView = (world: Transformable, el: HTMLElement, view: View) => {
  world.position.set(view.x, view.y);
  world.scale.set(view.scale);
  el.style.setProperty("--view", `translate(${view.x}px, ${view.y}px) scale(${view.scale})`);
  el.style.setProperty("--zoom", String(view.scale));
};
