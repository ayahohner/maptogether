import { Graphics } from "pixi.js";

import { pixiColor } from "../tokens";

export function Rectangle(x: number, y: number, width: number, height: number) {
  const rectangle = new Graphics();
  rectangle.rect(0, 0, width, height);
  rectangle.fill({ color: pixiColor("canvas"), alpha: 1 });
  rectangle.x = x;
  rectangle.y = y;
  return rectangle;
}
