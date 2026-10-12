import type { Point } from "./viewport";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What hitComponent needs of a child of the graph container. */
export interface Hittable {
  nodeKey?: string;
  zIndex?: number;
  /** Only connection lines have this. */
  updateLine?: unknown;
  getBounds(): Bounds;
}

const contains = (b: Bounds, p: Point) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

const isComponent = (child: Hittable) => child.nodeKey !== undefined && child.updateLine === undefined;

/**
 * The node key of the topmost component (by zIndex, then paint order) whose
 * screen bounds contain `p`. Connection lines are skipped: their keys are
 * edges, and their bounding boxes would swallow presses on empty canvas.
 */
export function hitComponent(children: readonly Hittable[], p: Point): string | undefined {
  const ranked = children
    .map((child, index) => ({ child, index }))
    .filter(({ child }) => isComponent(child))
    .sort((a, b) => (b.child.zIndex ?? 0) - (a.child.zIndex ?? 0) || b.index - a.index);
  return ranked.find(({ child }) => contains(child.getBounds(), p))?.child.nodeKey;
}
