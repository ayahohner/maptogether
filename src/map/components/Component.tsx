import { type BitmapText, Container, Graphics } from "pixi.js";

import { state, subscribe } from "../../state/State";
import {
  type ComponentConfig,
  type InteractionMode,
  layoutComponent,
  modeOf,
  pipelineBox,
} from "./componentLayout";
import { addShapes, drawShapes, drawText } from "./drawShapes";
import MapSingleton from "./MapSingleton";
import { drawPipe } from "./PipelineContainer";
import { Rectangle } from "./Rectangle";
import { decorations, markerShapes } from "./symbols";
import { pixiColor } from "../tokens";
import type { ComponentT } from "./types";

/** The label, on a patch of the canvas colour so lines don't run through it. */
const label = (
  text: string,
  { x, y, rotation }: { x: number; y: number; rotation: number },
): [Graphics, BitmapText] => {
  const drawn = drawText({ x, y, text, fill: "ink" });
  drawn.rotation = rotation;
  const backing = Rectangle(x, y, drawn.width, drawn.height);
  backing.rotation = rotation;
  return [backing, drawn];
};

/**
 * Adds the decorations behind the label, the label (which can be dragged),
 * then those in front of it.
 */
const addLabelAndDecorations = (
  component: ComponentT,
  config: ComponentConfig,
  at: ReturnType<typeof layoutComponent>["label"],
) => {
  const parts = decorations(config);
  addShapes(component, parts.behind);
  const [backing, text] = label(config.label ?? config.name, at);
  component.addChild(backing, text);
  // A note is all label, and pressing it moves the note.
  component.onLabel = ({ x, y }) => !config.note && backing.getBounds().containsPoint(x, y);
  component.moveLabelBy = (x, y) => {
    for (const part of [backing, text]) part.position.set(part.x + x, part.y + y);
    MapSingleton.dirty = true;
    return { x: text.x, y: text.y };
  };
  addShapes(component, parts.front);
  for (const future of parts.texts) component.addChild(drawText(future));
  return text;
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
    drawPipe(pipe, pipelineBox(component.x, childXs, config.bounds));
    MapSingleton.dirty = true;
  };

  const text = addLabelAndDecorations(component, config, layout.label);

  const marker = new Graphics();
  let drawnMode: InteractionMode | undefined;
  // Redrawing the marker is slow, so it is redrawn only when its mode changes.
  const redrawMarker = () => {
    const mode = modeOf(state, config.name);
    if (mode === drawnMode) return;
    drawShapes(marker, markerShapes(config, mode));
    // A note has no marker to show it's selected, so its text does.
    if (config.note) text.style.fill = pixiColor(mode === "selected" ? "selected" : "ink");
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
