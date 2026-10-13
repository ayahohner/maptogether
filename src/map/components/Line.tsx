import { Graphics } from "pixi.js";

import { state, subscribe } from "../../state/State";
import MapSingleton from "./MapSingleton";
import type { LineT } from "./types";

const strokes = {
  normal: { width: 1, color: 0x000000, alpha: 1 },
  // The same colour as a selected component's border.
  selected: { width: 2.5, color: 0x9b5af9, alpha: 1 },
};

export const Line = (
  componentAx: number,
  componentAy: number,
  componentBx: number,
  componentBy: number,
  nodeKey: string,
): LineT => {
  const g = new Graphics() as LineT;
  let ends = [componentAx, componentAy, componentBx, componentBy];
  let selected = state.selection.edgeItems.has(nodeKey);

  const draw = () => {
    const [ax, ay, bx, by] = ends;
    g.clear();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke(selected ? strokes.selected : strokes.normal);
  };

  draw();
  g.zIndex = -1;
  g.nodeKey = nodeKey;

  g.updateLine = (...next: number[]) => {
    ends = next;
    draw();
  };

  const unsubscribe = subscribe(state.selection, () => {
    if (selected === state.selection.edgeItems.has(nodeKey)) return;
    selected = !selected;
    draw();
    MapSingleton.dirty = true;
  });

  g.on("removed", () => {
    unsubscribe();
    g.destroy();
  });

  return g;
};
