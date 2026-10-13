import { BitmapText, Container, Graphics } from "pixi.js";

import { state, subscribe } from "../../state/State";
import {
  BORDERS,
  type ComponentConfig,
  type InteractionMode,
  layoutComponent,
  modeOf,
  pipelineBox,
  squareHalfSide,
} from "./componentLayout";
import MapSingleton from "./MapSingleton";
import { drawPipe } from "./PipelineContainer";
import { Rectangle } from "./Rectangle";
import type { ComponentT } from "./types";

/** A circle for a component, or a square for a pipeline. */
const drawMarker = (g: Graphics, square: boolean, mode: InteractionMode) => {
  g.clear();
  const half = squareHalfSide(mode);
  if (square) g.rect(-half, -half, 2 * half, 2 * half);
  else g.circle(0, 0, 6);
  g.fill({ color: 0xffffff, alpha: 1 });
  g.stroke({ ...BORDERS[mode], alpha: 1, alignment: 1 });
};

/** The name, on a patch of the canvas colour so lines don't run through it. */
const label = (name: string, { x, y, rotation }: { x: number; y: number; rotation: number }) => {
  const text = new BitmapText({ text: name, style: { fontFamily: "TitleFont", fontSize: 16 } });
  text.position.set(x, y);
  text.rotation = rotation;
  const backing = Rectangle(x, y, text.width, text.height);
  backing.rotation = rotation;
  return [backing, text];
};

export const Component = (config: ComponentConfig) => {
  const layout = layoutComponent(config);
  const component = new Container() as ComponentT;
  component.eventMode = "static";
  component.cursor = "pointer";
  component.nodeKey = config.name;
  component.zIndex = layout.zIndex;
  component.position.set(config.x, layout.y);

  const pipe = new Graphics();
  if (layout.pipe) {
    drawPipe(pipe, layout.pipe);
    component.addChild(pipe);
  }
  component.fitPipe = (childXs) => {
    if (!layout.pipe) return;
    drawPipe(pipe, pipelineBox(component.x, childXs));
    MapSingleton.dirty = true;
  };

  component.addChild(...label(config.name, layout.label));

  const marker = new Graphics();
  let drawnMode: InteractionMode | undefined;
  // Redrawing the marker is slow, so it is redrawn only when its mode changes.
  const redrawMarker = () => {
    const mode = modeOf(state, config.name);
    if (mode === drawnMode) return;
    drawMarker(marker, config.pipeline !== undefined, mode);
    MapSingleton.dirty = true;
    drawnMode = mode;
  };
  redrawMarker();
  component.addChild(marker);

  const unsubscribeSelection = subscribe(state.selection, redrawMarker);
  const unsubscribeLinking = subscribe(state.linking, redrawMarker);

  component.on("removed", () => {
    unsubscribeSelection();
    unsubscribeLinking();
    component.destroy({ children: true });
  });

  return component;
};
