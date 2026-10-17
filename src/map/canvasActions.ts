import { appendText, moveComponents, placeLabel, renameComponent } from "../editor/Editor";
import { isComponentName, writeName } from "../parser/names";
import { graph } from "../state/Graph";
import {
  clearSelection,
  dragTo,
  linkTo,
  edgeSegments,
  pressCanvas,
  pressComponent,
  pressEdge,
  pressLabel,
  releaseDrag,
  releaseLabel,
  replaceSelection,
} from "../state/State";
import { activeTool, setTool } from "../state/Tools";
import { FloatingTextInput } from "./components/FloatingTextInput";
import type { CanvasActions } from "./gestures";
import { hitComponent, type Hittable } from "./hitTest";
import { hitSegment } from "./segments";
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

/** Why a component can't be named `name`, if it can't; `current` is its name now. */
export const nameProblem = (name: string, current?: string) => {
  if (name !== current && graph.hasNode(name)) return `${name} is already on the map`;
  if (!isComponentName(name))
    return "A name can't use -- // [ ] { } \" ; or `, start with @, or start or end with a space";
};

/** Names a new component where the user pressed. */
const create = (map: MapView, p: Point) =>
  FloatingTextInput(
    map.element,
    p.x,
    p.y,
    (name) => {
      if (!graph.hasNode(name)) appendText(`\n${name} ${mapCoordinates(map, p)}`);
    },
    "",
    nameProblem,
  );

const rename = (map: MapView, nodeKey: string, p: Point) =>
  FloatingTextInput(
    map.element,
    p.x,
    p.y,
    (name) => {
      if (!graph.hasNode(name)) renameComponent(nodeKey, name);
    },
    nodeKey,
    (name) => nameProblem(name, nodeKey),
  );

const vibrate = () => navigator.vibrate?.(10);

/** How far (screen px) from a link a press still picks it. */
const linkReach = (touch: boolean) => (touch ? 14 : 6);

export function canvasActions(map: MapView): CanvasActions {
  const world = (p: Point) => toWorld(viewport, p);
  const linkAt = (p: Point, touch: boolean) =>
    hitSegment(edgeSegments(), world(p), linkReach(touch) / viewport.scale);
  const pressEmpty = (p: Point, additive: boolean) => {
    const link = linkAt(p, false);
    if (link) pressEdge(link, world(p), additive);
    else pressCanvas(world(p), additive);
  };
  /** A press on a label moves the label; anywhere else on a component, the component. */
  const pressOn = (nodeKey: string, p: Point, additive: boolean) => {
    const onLabel = !additive && graph.getNodeAttribute(nodeKey, "component").onLabel(p);
    if (onLabel) pressLabel(nodeKey, world(p));
    else pressComponent(nodeKey, world(p), additive);
  };
  const release = () => {
    const label = releaseLabel();
    if (label) placeLabel(label.name, label.x, label.y);
    else moveComponents(releaseDrag());
  };
  const tap = (p: Point, touch: boolean) => {
    const link = linkAt(p, touch);
    if (link) replaceSelection([], [link]);
    else clearSelection();
  };
  return {
    tool: () => activeTool(),
    hit: (p) => hitComponent(map.components(), p),
    press: (nodeKey, p, additive) =>
      nodeKey ? pressOn(nodeKey, p, additive) : pressEmpty(p, additive),
    drag: (p, additive) => dragTo(world(p), additive),
    release,
    select: (nodeKey, p, touch) => (nodeKey ? replaceSelection([nodeKey]) : tap(p, touch)),
    link: (nodeKey) => {
      const link = linkTo(nodeKey);
      if (link) appendText(`\n${writeName(link.from)} -- ${writeName(link.to)}`);
    },
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
