import throttle from "lodash/throttle";
import { createRoot } from "react-dom/client";

import {
  editorView,
  awareness,
  deleteSelection,
  mapLink,
  redrawMap,
  replaceText,
  room,
  undoManager,
} from "../editor/Editor";
import MapSingleton from "../map/components/MapSingleton";
import { SelectionHandler } from "../map/components/SelectionHandler";

import { initializeCanvasPresence } from "../map/CanvasPresence";
import { MapAxes, StageDividers } from "../map/MapAxes";
import { initializeCanvasControls } from "../map/canvasControls";
import { toWorld, viewport } from "../map/viewport";
import { TopBar } from "../menu";
import { HelpLauncher } from "../help/HelpLauncher";
import { openAbout } from "../onboarding/about";
import { initializeOnboarding } from "../onboarding";
import { canvasMeasure, type ExportFormat, exportMap } from "../export/exportMap";
import { sceneFromGraph } from "../export/scene";
import { graph } from "../state/Graph";
import { mapSettings } from "../state/Settings";

import { setEditorText, stopSelecting } from "../state/State";

import { initializePanelResizer } from "./components/PanelResizer";
import { fileName, initializeMapSettings } from "./mapSettings";
import { bindEditShortcuts, bindToolShortcuts } from "./shortcuts";
import { keepMapOutOfSearch } from "./seo";

import "@fontsource-variable/jetbrains-mono";
import "./index.css";

const edits = {
  undo: () => undoManager.undo(),
  redo: () => undoManager.redo(),
  deleteSelection,
};
bindToolShortcuts();
bindEditShortcuts(edits);
// A marquee can't follow a pointer released outside the window.
window.addEventListener("blur", stopSelecting);

keepMapOutOfSearch(room.isNew);

const run = async (elementId: string) => {
  // Pixi starts asynchronously; the renderer and canvas exist only once it is ready.
  await MapSingleton.ready;
  MapSingleton.world.addChild(SelectionHandler());

  // Map positions are fractions of the canvas, so a new size redraws the map.
  const fitMap = throttle(() => {
    MapSingleton.fitToParent();
    redrawMap();
  }, 32);
  initializePanelResizer(
    document.getElementById("editorContainer")!,
    document.getElementById("resize")!,
    fitMap,
  );

  setEditorText(editorView.state.doc.toString());

  document.getElementById(elementId)?.appendChild(MapSingleton.canvas);
  initializeMapSettings(document.getElementById(elementId)!);

  const dividers = document.createElement("div");
  dividers.className = "map-axes";
  MapSingleton.canvas.before(dividers);
  createRoot(dividers).render(<StageDividers />);

  const axes = document.createElement("div");
  axes.className = "map-axes";
  MapSingleton.canvas.after(axes);
  createRoot(axes).render(<MapAxes />);

  initializeCanvasPresence(MapSingleton.canvas, awareness, (p) => toWorld(viewport, p));

  initializeCanvasControls(MapSingleton.canvas, MapSingleton.mapView, edits);

  fitMap();

  // Draws the first frame, even of an empty map.
  MapSingleton.dirty = true;

  initializeChrome();
};

/** Top bar, help, and the About dialog, which first-time visitors see as a welcome. */
const initializeChrome = () => {
  const openDemo = initializeOnboarding(
    room,
    {
      text: () => editorView.state.doc.toString(),
      replace: (text) => {
        mapLink.setUnedited(text);
        replaceText(text);
      },
    },
    document.getElementById("about") as HTMLDialogElement,
    localStorage,
  );
  createRoot(document.getElementById("topBar")!).render(
    <TopBar
      onAbout={openAbout}
      onDemo={openDemo}
      onShare={mapLink.create}
      onExport={exportPicture}
    />,
  );
  createRoot(document.getElementById("overlays")!).render(<HelpLauncher />);
};

/** Downloads the map as it is drawn now, whatever the pan and zoom. */
const exportPicture = (format: ExportFormat) =>
  exportMap(format, {
    scene: sceneFromGraph(graph, MapSingleton.screen, structuredClone(mapSettings)),
    measure: canvasMeasure(document.createElement("canvas").getContext("2d")!),
    name: fileName(mapSettings.title, room.id ? `wardley-map-${room.id}` : "wardley-map"),
  }).catch(console.error);

run("map");
