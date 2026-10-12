import type { Point } from "./viewport";

/** A connection line between two components, in world coordinates. */
export interface Segment {
  key: string;
  start: Point;
  stop: Point;
}

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The rectangle with corners `a` and `b`. */
export const rectBetween = (a: Point, b: Point): Rect => ({
  left: Math.min(a.x, b.x),
  right: Math.max(a.x, b.x),
  top: Math.min(a.y, b.y),
  bottom: Math.max(a.y, b.y),
});

/** Distance from `p` to the nearest point of the segment a–b. */
export function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.min(Math.max(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0), 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Key of the segment nearest `p`, if any is within `reach`. */
export function hitSegment(segments: readonly Segment[], p: Point, reach: number) {
  let best: { key: string; distance: number } | undefined;
  for (const { key, start, stop } of segments) {
    const distance = distanceToSegment(p, start, stop);
    if (distance <= reach && distance < (best?.distance ?? Infinity)) best = { key, distance };
  }
  return best?.key;
}

/**
 * How much of the segment a–b lies inside `rect`, from 0 to 1
 * (Liang–Barsky clipping).
 */
export function fractionInside(a: Point, b: Point, rect: Rect) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: [number, number][] = [
    [-dx, a.x - rect.left],
    [dx, rect.right - a.x],
    [-dy, a.y - rect.top],
    [dy, rect.bottom - a.y],
  ];
  let enter = 0;
  let exit = 1;
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return 0;
    } else if (p < 0) enter = Math.max(enter, q / p);
    else exit = Math.min(exit, q / p);
  }
  return Math.max(exit - enter, 0);
}
