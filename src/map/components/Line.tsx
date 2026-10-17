import { Container, Graphics } from "pixi.js";

import { state, subscribe } from "../../state/State";
import { drawShapes, drawText } from "./drawShapes";
import MapSingleton from "./MapSingleton";
import { Rectangle } from "./Rectangle";
import { type LinkStyle, linkShapes, PLAIN_LINK, type Shape } from "./symbols";
import type { LineT } from "./types";

/** A selected link, in the same colour as a selected component's border. */
const SELECTED_WIDTH = 2.5;

const selectedLine = (line: Shape): Shape =>
  line.kind === "line"
    ? {
        ...line,
        stroke: { role: "selected", width: Math.max(line.stroke.width, SELECTED_WIDTH) },
      }
    : line;

export const Line = (
  componentAx: number,
  componentAy: number,
  componentBx: number,
  componentBy: number,
  nodeKey: string,
  style: LinkStyle = PLAIN_LINK,
): LineT => {
  const link = new Container() as LineT;
  const g = new Graphics();
  link.addChild(g);
  let ends: [number, number, number, number] = [componentAx, componentAy, componentBx, componentBy];
  let selected = state.selection.edgeItems.has(nodeKey);

  const first = linkShapes(ends, style).text;
  const label = first && drawText(first);
  const backing = label && Rectangle(0, 0, label.width, label.height);
  if (backing && label) link.addChild(backing, label);

  const draw = () => {
    const { line, text } = linkShapes(ends, style);
    drawShapes(g, [selected ? selectedLine(line) : line]);
    if (text && label && backing) {
      label.position.set(text.x, text.y);
      backing.position.set(text.x, text.y);
    }
  };

  draw();
  link.zIndex = -1;
  link.nodeKey = nodeKey;
  link.line = g;

  link.updateLine = (...next) => {
    ends = next;
    draw();
  };

  const unsubscribe = subscribe(state.selection, () => {
    if (selected === state.selection.edgeItems.has(nodeKey)) return;
    selected = !selected;
    draw();
    MapSingleton.dirty = true;
  });

  link.on("removed", () => {
    unsubscribe();
    link.destroy({ children: true });
  });

  return link;
};
