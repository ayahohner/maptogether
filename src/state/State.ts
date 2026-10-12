import { proxy, subscribe } from "valtio/vanilla";
import { proxySet } from "valtio/utils";

import { ComponentT } from "../map/components/types";
import { graph, NodeAttributes, updateComponentPositionOffset } from "./Graph";

import { appendText, replaceCoordinates } from "../editor/Editor";
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

// STORE
export const state = proxy<StateT>({
  editor: { editorText: "" },
  linking: {
    initialLinkTarget: undefined,
    isLinkModeEnabled: false,
  },
  selection: { selectionItems: proxySet() },
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

// ACTIONS
export const setEditorText = (text: string) => {
  state.editor.editorText = text;
};

export const setInitialLinkTarget = (
  nodeKey: ComponentT["nodeKey"] | undefined
) => {
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

export const nodeInSelection = (
  nodeKey: string,
  nodeAttributes: NodeAttributes
) => {
  let startX = state.selectDrag.selectionStartPoint!.x;
  let startY = state.selectDrag.selectionStartPoint!.y;
  let curX = state.selectDrag.selectionCurrentPoint!.x;
  let curY = state.selectDrag.selectionCurrentPoint!.y;
  let [left, right] = startX <= curX ? [startX, curX] : [curX, startX];
  let [bottom, top] = startY <= curY ? [startY, curY] : [curY, startY];

  let nodeX = nodeAttributes.coordinates.x;
  let nodeY = nodeAttributes.coordinates.y;
  return nodeX >= left && nodeX <= right && nodeY >= bottom && nodeY <= top;
};

export const updateSelectionPoint = (location: PointLike) => {
  state.selectDrag.selectionCurrentPoint = location;
  replaceSelection(graph.filterNodes(nodeInSelection));
};

export const addUpdateSelectionPoint = (location: PointLike) => {
  state.selectDrag.selectionCurrentPoint = location;
  addToSelection(graph.filterNodes(nodeInSelection));
};

export const clearSelection = () => {
  state.selection.selectionItems.clear();
};

export const removeFromSelection = (item: ComponentT["nodeKey"]) =>
  state.selection.selectionItems.delete(item);

export const addToSelection = (items: ComponentT["nodeKey"][]) => {
  items.forEach((item) => {
    state.selection.selectionItems.add(item);
  });
};

export const replaceSelection = (newSelection: ComponentT["nodeKey"][]) => {
  state.selection.selectionItems.clear();
  newSelection.forEach((item) => state.selection.selectionItems.add(item));
};

export const xorSelection = (inputSelection: ComponentT["nodeKey"][]) => {
  inputSelection.forEach((item) => {
    if (state.selection.selectionItems.has(item)) {
      state.selection.selectionItems.delete(item);
    } else {
      state.selection.selectionItems.add(item);
    }
  });
};

export const startPotentialTranslation = (location: PointLike) => {
  state.translateDrag.translationStartPoint = location;
};

export const startTranslation = (location: PointLike) => {
  state.translateDrag.isTranslating = true;
  state.translateDrag.translationLastPoint = location;
  state.translateDrag.translationCurrentPoint = location;
};

export const stopTranslation = () => {
  if (state.translateDrag.translationCurrentPoint) {
    state.selection.selectionItems.forEach((item) => {
      const coords = graph.getNodeAttribute(item, "coordinates");
      replaceCoordinates(item, coords.x, coords.y); //->Editor
    });
  }

  state.translateDrag.isTranslating = false;
  state.translateDrag.translationStartPoint = undefined;
  state.translateDrag.translationLastPoint = undefined;
  state.translateDrag.translationCurrentPoint = undefined;
};

export const updateTranslationPoint = (location: PointLike) => {
  state.translateDrag.translationCurrentPoint = location;

  state.selection.selectionItems.forEach((item) => {
    updateComponentPositionOffset(
      item,
      state.translateDrag.translationCurrentPoint!.x -
        state.translateDrag.translationLastPoint!.x,
      state.translateDrag.translationCurrentPoint!.y -
        state.translateDrag.translationLastPoint!.y
    );
  });
  state.translateDrag.translationLastPoint =
    state.translateDrag.translationCurrentPoint;
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
  additive: boolean
) => {
  if (additive) return xorSelection([nodeKey]);
  if (!state.selection.selectionItems.has(nodeKey)) replaceSelection([nodeKey]);
  startPotentialTranslation(point);
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
  if (state.translateDrag.isTranslating) updateTranslationPoint(point);
  else if (pastThreshold(start, point)) startTranslation(point);
};

const dragMarquee = (start: PointLike, point: PointLike, additive: boolean) => {
  if (!state.selectDrag.isSelecting) {
    if (pastThreshold(start, point)) startSelecting(point);
  } else if (additive) addUpdateSelectionPoint(point);
  else updateSelectionPoint(point);
};

/** End of a press: commit any move and drop the marquee. */
export const releaseDrag = () => {
  stopSelecting();
  stopTranslation();
};

/**
 * Link tool: the first component picked is the source, the second the
 * component it needs. Picking empty canvas or the source again starts over.
 */
export const linkTo = (nodeKey: ComponentT["nodeKey"] | undefined) => {
  const from = state.linking.initialLinkTarget;
  if (nodeKey && !from) return setInitialLinkTarget(nodeKey);
  if (nodeKey && from && from !== nodeKey && !graph.areNeighbors(from, nodeKey)) {
    appendText(`\n${from}.${nodeKey}`); // ->Editor
  }
  setInitialLinkTarget(undefined);
};

/** Link mode (and its styling) follows the active tool. */
export const followActiveTool = () => {
  const enabled = activeTool() === "link";
  if (enabled === state.linking.isLinkModeEnabled) return;
  state.linking.isLinkModeEnabled = enabled;
  state.linking.initialLinkTarget = undefined;
};

subscribe(tools, followActiveTool, true);

export { subscribe };
