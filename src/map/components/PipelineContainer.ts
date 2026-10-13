import type { Graphics } from "pixi.js";

/** Draws a pipeline's box into `box`, `width` wide from `offset`, relative to the pipeline. */
export function drawPipe(box: Graphics, { offset, width }: { offset: number; width: number }) {
  box.clear();
  box.x = offset;
  box.rect(0, 2, width, 20);
  box.fill({ color: 0xffffff, alpha: 0.1 });
  box.stroke({ width: 1, color: 0x000000, alpha: 1, alignment: 1 });
}
