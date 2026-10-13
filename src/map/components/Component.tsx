import { BitmapText, Container, Graphics } from "pixi.js";

import { state, subscribe } from "../../state/State";
import {
  BORDERS,
  type ComponentConfig,
  type InteractionMode,
  layoutComponent,
  modeOf,
  squareHalfSide,
} from "./componentLayout";
import MapSingleton from "./MapSingleton";
import { PipelineContainer } from "./PipelineContainer";
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

export const Component = (config: ComponentConfig) => {
  const layout = layoutComponent(config);
  const component = new Container() as ComponentT;
  component.eventMode = "static";
  component.cursor = "pointer";
  component.nodeKey = config.name;
  component.zIndex = layout.zIndex;
  component.position.set(config.x, layout.y);

  if (layout.pipe) {
    const pipe = PipelineContainer(layout.pipe.width);
    pipe.x = layout.pipe.offset;
    component.addChild(pipe);
  }

  const text = new BitmapText({
    text: config.name,
    style: { fontFamily: "TitleFont", fontSize: 16 },
  });
  text.position.set(layout.label.x, layout.label.y);
  text.rotation = layout.label.rotation;

  // A patch of the canvas colour behind the label keeps lines from running through it.
  const backing = Rectangle(text.x, text.y, text.width, text.height);
  backing.rotation = layout.label.rotation;
  component.addChild(backing, text);

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
