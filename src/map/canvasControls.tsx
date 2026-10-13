import { createRoot } from "react-dom/client";
import { subscribe } from "valtio/vanilla";

import { activeTool, tools } from "../state/Tools";
import { canvasActions, type MapView } from "./canvasActions";
import { bindGestures, Gestures } from "./gestures";
import { MapControls } from "./Toolbar";
import { resetView, zoomCentered } from "./viewport";

export interface EditorCommands {
  undo: () => void;
  redo: () => void;
  deleteSelection: () => void;
}

/** Canvas gestures, the toolbar and zoom buttons, and tool cursors. */
export function initializeCanvasControls(
  canvas: HTMLElement,
  map: MapView,
  editor: EditorCommands,
) {
  bindGestures(canvas, new Gestures(canvasActions(map)));

  const showTool = () => {
    map.element.dataset.tool = activeTool();
  };
  subscribe(tools, showTool, true);
  showTool();

  const host = document.createElement("div");
  host.className = "map-controls";
  map.element.append(host);
  createRoot(host).render(
    <MapControls
      onUndo={editor.undo}
      onRedo={editor.redo}
      onDelete={editor.deleteSelection}
      onZoom={(factor) => zoomCentered(map.element, factor)}
      onResetZoom={resetView}
    />,
  );
}
