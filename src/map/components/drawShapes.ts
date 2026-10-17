import { BitmapText, type Container, Graphics } from "pixi.js";

import { pixiColor } from "../tokens";
import type { Shape, TextShape } from "./symbols";

const outline = (g: Graphics, shape: Shape) => {
  switch (shape.kind) {
    case "circle":
      return g.circle(shape.x, shape.y, shape.r);
    case "rect":
      return g.rect(shape.x, shape.y, shape.width, shape.height);
    case "polygon":
      return g.poly(shape.points);
    case "line":
      return g.moveTo(shape.points[0], shape.points[1]).lineTo(shape.points[2], shape.points[3]);
  }
};

/** Draws `shapes` into `g`, in order, clearing it first. */
export const drawShapes = (g: Graphics, shapes: Shape[]) => {
  g.clear();
  for (const shape of shapes) {
    outline(g, shape);
    if ("fill" in shape && shape.fill) g.fill({ color: pixiColor(shape.fill), alpha: 1 });
    if ("stroke" in shape && shape.stroke) {
      const { role, width, inside } = shape.stroke;
      g.stroke({ color: pixiColor(role), width, alpha: 1, alignment: inside ? 1 : 0.5 });
    }
  }
  return g;
};

/** Text in the label font, tinted to its token. */
export const drawText = ({ x, y, text, fill }: TextShape) => {
  const label = new BitmapText({
    text,
    style: { fontFamily: "TitleFont", fontSize: 16, fill: pixiColor(fill) },
  });
  label.position.set(x, y);
  return label;
};

/** Adds a Graphics drawing `shapes` to `parent`, if there are any. */
export const addShapes = (parent: Container, shapes: Shape[]) => {
  if (shapes.length) parent.addChild(drawShapes(new Graphics(), shapes));
};
