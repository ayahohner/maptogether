import { createRoot } from "react-dom/client";

import MapSingleton from "../map/components/MapSingleton";

import { initializeCanvasPresence } from "../map/CanvasPresence";
import { MapAxes, StageDividers } from "../map/MapAxes";
import { editorView, awareness, replaceText, room } from "../editor/Editor";
import { TopBar } from "../menu";
import { HelpLauncher } from "../help/HelpLauncher";
import { openAbout } from "../onboarding/about";
import { initializeOnboarding } from "../onboarding";
import { trackHelpTopic } from "../state/Ui";

import { setEditorText } from "../state/State";

import { initializeHistoryMonkeypatch } from "./utilities/HistoryMonkeypatch";
import { initializePanelResizer } from "./components/PanelResizer";
import { initializeUserEvents } from "./UserEvents";
import { keepMapOutOfSearch } from "./seo";

import "./index.css";

/**
 * Principles,
 * 1. One way state binding
 * mark each place in app with a state change
 * Make it update data structure
 * Make data structure attatch component to app on creation
 * make data structure rerender on change
 *
 *
 * Order of initialization:
 * 1. Graph
 * 2. State
 * 3. Editor
 * 4. App
 */

initializeHistoryMonkeypatch();

initializeUserEvents();

keepMapOutOfSearch(room.isNew);

const run = async (elementId: string) => {
  // Pixi v8 initializes asynchronously; wait for it before touching the
  // renderer or appending the canvas.
  await MapSingleton.ready;

  initializePanelResizer(document.getElementById("editorContainer"));

  setEditorText(editorView.state.doc.toString());

  // Bind app view to root html element
  document.getElementById(elementId)?.appendChild(MapSingleton.canvas);

  const dividers = document.createElement("div");
  dividers.className = "map-axes";
  MapSingleton.canvas.before(dividers);
  createRoot(dividers).render(<StageDividers />);

  const axes = document.createElement("div");
  axes.className = "map-axes";
  MapSingleton.canvas.after(axes);
  createRoot(axes).render(<MapAxes />);

  initializeCanvasPresence(MapSingleton.canvas, awareness);

  MapSingleton.handleResize();

  // Render once even if graph is empty
  MapSingleton.dirty = true;

  initializeChrome();
};

/** Top bar, help, and the About dialog that welcomes first-time visitors. */
const initializeChrome = () => {
  const openDemo = initializeOnboarding(
    room,
    { text: () => editorView.state.doc.toString(), replace: replaceText },
    document.getElementById("about") as HTMLDialogElement,
    localStorage,
  );
  createRoot(document.getElementById("topBar")!).render(
    <TopBar onAbout={openAbout} onDemo={openDemo} />,
  );
  createRoot(document.getElementById("overlays")!).render(<HelpLauncher />);
  trackHelpTopic();
};
