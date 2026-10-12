import { appendText, renameComponent } from "../editor/Editor";
import { graph } from "../state/Graph";
import {
  clearSelection,
  dragTo,
  linkTo,
  pressCanvas,
  pressComponent,
  releaseDrag,
  replaceSelection,
} from "../state/State";
import { activeTool, setTool } from "../state/Tools";
import { FloatingTextInput } from "./components/FloatingTextInput";
import type { CanvasActions } from "./gestures";
import { hitComponent, type Hittable } from "./hitTest";
import { panView, toWorld, viewport, zoomView, type Point } from "./viewport";

/** What the actions need of the map (MapSingleton). */
export interface MapView {
  element: HTMLElement;
  components(): readonly Hittable[];
  size(): { width: number; height: number };
}

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);
const round = (n: number) => Math.round(n * 10) / 10;

/** Map coordinates ("[visibility, evolution]", 0–100) of a screen point. */
export const mapCoordinates = (map: MapView, p: Point) => {
  const world = toWorld(viewport, p);
  const { width, height } = map.size();
  const evolution = round((100 * clamp(world.x, width)) / width);
  const visibility = round(100 - (100 * clamp(world.y, height)) / height);
  return `[${visibility}, ${evolution}]`;
};

/** Names a new component where the user pressed. */
const create = (map: MapView, p: Point) =>
  FloatingTextInput(map.element, p.x, p.y, (name) => {
    if (!graph.hasNode(name)) appendText(`\n${name} ${mapCoordinates(map, p)}`); // ->Editor
  });

const rename = (map: MapView, nodeKey: string, p: Point) =>
  FloatingTextInput(
    map.element,
    p.x,
    p.y,
    (name) => {
      if (!graph.hasNode(name)) renameComponent(nodeKey, name); // ->Editor
    },
    nodeKey,
  );

const vibrate = () => navigator.vibrate?.(10);

export function canvasActions(map: MapView): CanvasActions {
  const world = (p: Point) => toWorld(viewport, p);
  return {
    tool: () => activeTool(),
    hit: (p) => hitComponent(map.components(), p),
    press: (nodeKey, p, additive) =>
      nodeKey ? pressComponent(nodeKey, world(p), additive) : pressCanvas(world(p), additive),
    drag: (p, additive) => dragTo(world(p), additive),
    release: releaseDrag,
    select: (nodeKey) => (nodeKey ? replaceSelection([nodeKey]) : clearSelection()),
    link: linkTo,
    edit: (nodeKey, p) => (nodeKey ? rename(map, nodeKey, p) : create(map, p)),
    place: (p) => {
      setTool("select");
      create(map, p);
    },
    pan: panView,
    zoom: zoomView,
    pickedUp: vibrate,
  };
}
