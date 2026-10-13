import { proxy, subscribe } from "valtio/vanilla";
import { proxySet } from "valtio/utils";

import type { ComponentT } from "../map/components/types";
import { contains, fractionInside, rectBetween, type Segment } from "../map/segments";
import { graph, moveComponentsBy, type NodeAttributes } from "./Graph";
import { activeTool, tools } from "./Tools";

/** Plain coordinate pair. Kept as a plain object (not a Pixi Point) so it is
 *  safe to store in valtio state — valtio deep-proxies class instances and
 *  mutates the originals, which corrupts live Pixi objects. */
export interface PointLike {
  x: number;
  y: number;
}

export interface StateT {
  editor: { editorText: string };
  linking: {
    isLinkModeEnabled: boolean;
    /** Node key of the link source. Stored as a string key — never store a
     *  live Pixi component here (see note on PointLike). */
    initialLinkTarget: ComponentT["nodeKey"] | undefined;
  };
  selection: {
    selectionItems: Set<ComponentT["nodeKey"]>;
    /** Selected links, by their lines' keys ("needer->needed"). */
    edgeItems: Set<string>;
  };
  selectDrag: {
    isSelecting: boolean;
    selectionStartPoint: PointLike | undefined;
    selectionCurrentPoint: PointLike | undefined;
  };
  translateDrag: {
    isTranslating: boolean;
    translationStartPoint: PointLike | undefined;
    translationLastPoint: PointLike | undefined;
    translationCurrentPoint: PointLike | undefined;
  };
}

export const state = proxy<StateT>({
  editor: { editorText: "" },
  linking: {
    initialLinkTarget: undefined,
    isLinkModeEnabled: false,
  },
  selection: { selectionItems: proxySet(), edgeItems: proxySet() },
  selectDrag: {
    isSelecting: false,
    selectionStartPoint: undefined,
    selectionCurrentPoint: undefined,
  },
  translateDrag: {
    isTranslating: false,
    translationStartPoint: undefined,
    translationLastPoint: undefined,
    translationCurrentPoint: undefined,
  },
});

export const setEditorText = (text: string) => {
  state.editor.editorText = text;
};

export const setInitialLinkTarget = (nodeKey: ComponentT["nodeKey"] | undefined) => {
  state.linking.initialLinkTarget = nodeKey;
};

export const startPotentialSelect = (location: PointLike) => {
  state.selectDrag.selectionStartPoint = location;
};

export const startSelecting = (location: PointLike) => {
  state.selectDrag.isSelecting = true;
  state.selectDrag.selectionCurrentPoint = location;
};

export const stopSelecting = () => {
  state.selectDrag.isSelecting = false;
  state.selectDrag.selectionStartPoint = undefined;
  state.selectDrag.selectionCurrentPoint = undefined;
};

/** The marquee, while one is being drawn. */
const marquee = () =>
  rectBetween(state.selectDrag.selectionStartPoint!, state.selectDrag.selectionCurrentPoint!);

const nodeInSelection = (_nodeKey: string, node: NodeAttributes) =>
  contains(marquee(), node.coordinates);

/** Each link's line, from the components' drawn positions. */
export const edgeSegments = (): Segment[] =>
  graph.mapEdges((_edge, link, _source, _target, source, target) => ({
    key: link.nodeKey,
    start: source.component.position,
    stop: target.component.position,
  }));

/** Links more than half inside the marquee, so a box around one component skips its links. */
const edgesInSelection = () => {
  const rect = marquee();
  return edgeSegments()
    .filter(({ start, stop }) => fractionInside(start, stop, rect) > 0.5)
    .map(({ key }) => key);
};

const updateSelectionPoint = (location: PointLike) => {
  state.selectDrag.selectionCurrentPoint = location;
  replaceSelection(graph.filterNodes(nodeInSelection), edgesInSelection());
};

const addUpdateSelectionPoint = (location: PointLike) => {
  state.selectDrag.selectionCurrentPoint = location;
  addToSelection(graph.filterNodes(nodeInSelection), edgesInSelection());
};

export const clearSelection = () => {
  state.selection.selectionItems.clear();
  state.selection.edgeItems.clear();
};

/** Keeps a renamed component selected under its new name. */
export const renameInSelection = (oldName: string, newName: string) => {
  if (state.selection.selectionItems.delete(oldName)) state.selection.selectionItems.add(newName);
};

const addToSelection = (items: ComponentT["nodeKey"][], edges: string[] = []) => {
  for (const item of items) state.selection.selectionItems.add(item);
  for (const edge of edges) state.selection.edgeItems.add(edge);
};

export const replaceSelection = (newSelection: ComponentT["nodeKey"][], edges: string[] = []) => {
  clearSelection();
  addToSelection(newSelection, edges);
};

const toggle = (set: Set<string>, item: string) => {
  if (!set.delete(item)) set.add(item);
};

export const xorSelection = (inputSelection: ComponentT["nodeKey"][], edges: string[] = []) => {
  for (const item of inputSelection) toggle(state.selection.selectionItems, item);
  for (const edge of edges) toggle(state.selection.edgeItems, edge);
};

export const hasSelection = (selection: StateT["selection"] = state.selection) =>
  selection.selectionItems.size + selection.edgeItems.size > 0;

const startPotentialTranslation = (location: PointLike) => {
  state.translateDrag.translationStartPoint = location;
};

const startTranslation = (location: PointLike) => {
  state.translateDrag.isTranslating = true;
  state.translateDrag.translationLastPoint = location;
  state.translateDrag.translationCurrentPoint = location;
};

/** A component moved on the canvas, and where it now is (px). */
export interface Move extends PointLike {
  name: ComponentT["nodeKey"];
}

/** Ends a move; returns the components it moved, for the text to follow. */
const stopTranslation = (): Move[] => {
  const moves = state.translateDrag.translationCurrentPoint
    ? [...state.selection.selectionItems]
        .filter((name) => graph.hasNode(name))
        .map((name) => ({ name, ...graph.getNodeAttribute(name, "coordinates") }))
    : [];

  state.translateDrag.isTranslating = false;
  state.translateDrag.translationStartPoint = undefined;
  state.translateDrag.translationLastPoint = undefined;
  state.translateDrag.translationCurrentPoint = undefined;
  return moves;
};

const updateTranslationPoint = (location: PointLike) => {
  const last = state.translateDrag.translationLastPoint!;
  moveComponentsBy(state.selection.selectionItems, location.x - last.x, location.y - last.y);
  state.translateDrag.translationCurrentPoint = location;
  state.translateDrag.translationLastPoint = location;
};

/* ===== Canvas gestures (points in world coordinates) ===== */

/** Press on empty canvas: clear the selection (unless adding) and start a marquee. */
export const pressCanvas = (point: PointLike, additive: boolean) => {
  if (!additive) clearSelection();
  startPotentialSelect(point);
};

/** Press on a component: select it (or toggle it when adding) and start a move. */
export const pressComponent = (
  nodeKey: ComponentT["nodeKey"],
  point: PointLike,
  additive: boolean,
) => {
  if (additive) return xorSelection([nodeKey]);
  if (!state.selection.selectionItems.has(nodeKey)) replaceSelection([nodeKey]);
  startPotentialTranslation(point);
};

/** Press on a link: select it (or toggle it when adding); dragging draws a marquee. */
export const pressEdge = (edgeKey: string, point: PointLike, additive: boolean) => {
  if (additive) xorSelection([], [edgeKey]);
  else replaceSelection([], [edgeKey]);
  startPotentialSelect(point);
};

/** Movement (px) before a press becomes a move or a marquee. */
const DRAG_THRESHOLD = 3;
const pastThreshold = (a: PointLike, b: PointLike) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= DRAG_THRESHOLD;

/** Pointer moved while pressed: continue the move or marquee it started. */
export const dragTo = (point: PointLike, additive: boolean) => {
  const { translationStartPoint } = state.translateDrag;
  if (translationStartPoint) return dragTranslation(translationStartPoint, point);
  const { selectionStartPoint } = state.selectDrag;
  if (selectionStartPoint) dragMarquee(selectionStartPoint, point, additive);
};

const dragTranslation = (start: PointLike, point: PointLike) => {
  if (!state.translateDrag.isTranslating) {
    if (!pastThreshold(start, point)) return;
    // From the press, so the components stay under the pointer.
    startTranslation(start);
  }
  updateTranslationPoint(point);
};

const dragMarquee = (start: PointLike, point: PointLike, additive: boolean) => {
  if (!state.selectDrag.isSelecting) {
    if (pastThreshold(start, point)) startSelecting(point);
  } else if (additive) addUpdateSelectionPoint(point);
  else updateSelectionPoint(point);
};

/** End of a press: drops the marquee, and returns the components moved. */
export const releaseDrag = () => {
  stopSelecting();
  return stopTranslation();
};

/**
 * Link tool: the first component picked is the source, the second the
 * component it needs. Picking empty canvas or the source again starts over.
 * Returns the link to write, once both ends are picked.
 */
export const linkTo = (nodeKey: ComponentT["nodeKey"] | undefined) => {
  const from = linkSource();
  setInitialLinkTarget(nodeKey && !from ? nodeKey : undefined);
  if (from && nodeKey && canLink(from, nodeKey)) return { from, to: nodeKey };
};

/** The link tool's source, unless it has been removed from the map since it was picked. */
const linkSource = () => {
  const picked = state.linking.initialLinkTarget;
  return picked && graph.hasNode(picked) ? picked : undefined;
};

const canLink = (from: string, to: string) => from !== to && !graph.areNeighbors(from, to);

/** Link mode (and its styling) follows the active tool. */
export const followActiveTool = () => {
  const enabled = activeTool() === "link";
  if (enabled === state.linking.isLinkModeEnabled) return;
  state.linking.isLinkModeEnabled = enabled;
  state.linking.initialLinkTarget = undefined;
};

subscribe(tools, followActiveTool, true);

export { subscribe };
