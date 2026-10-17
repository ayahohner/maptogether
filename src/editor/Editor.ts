import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { Awareness } from "y-protocols/awareness";
import { bindPresence, collaboration } from "../sync/presence";
import { connectSync } from "../sync/connect";

import { EditorState } from "@codemirror/state";
import { basicSetup, EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";

import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";

import debounce from "lodash/debounce";

import {
  clearSelection,
  type Move,
  renameInSelection,
  setEditorText,
  state,
  subscribe,
} from "../state/State";
import MapSingleton from "../map/components/MapSingleton";
import { togetherScriptLinter } from "./TogetherScriptLinter";
import { deletionRanges } from "./deletions";
import { moveChanges, renameChanges } from "./edits";
import { generateRandomAnimal } from "../user/utilities/generateRandomAnimal";
import { drawMap } from "../map/drawMap";
import { linkEnds } from "../state/Graph";
import { mapLifecycle, resolveRoom } from "../app/room";
import { keepMapOutOfSearch } from "../app/seo";

export const room = resolveRoom(document.location);

const Theme = EditorView.theme({
  "&": {
    fontSize: "1rem",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    fontWeight: "400",
    cursor: "text",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    fontWeight: "400",
  },
  ".cm-gutters": {
    color: "#d0d0d0",
    backgroundColor: "transparent",
    borderRight: "none",
  },
  ".cm-gutterElement": {
    userSelect: "none",
  },
  // Lines left off the map because they don't parse.
  ".cm-lintRange-error": {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
  },
  ".cm-ySelectionInfo": {
    fontFamily: "var(--font-mono)",
    fontWeight: "400",
    color: "black",
  },
});

const userColors = [
  { color: "#30bced", light: "#30bced33" },
  { color: "#6eeb83", light: "#6eeb8333" },
  { color: "#ffbc42", light: "#ffbc4233" },
  { color: "#ecd444", light: "#ecd44433" },
  { color: "#ee6352", light: "#ee635233" },
  { color: "#9ac2c9", light: "#9ac2c933" },
  { color: "#8acb88", light: "#8acb8833" },
  { color: "#1be7ff", light: "#1be7ff33" },
];

const userColor = userColors[Math.floor(Math.random() * userColors.length)];

// Keeps deleted text, so earlier versions of the map can be rebuilt from
// snapshots. The relay's copy keeps it too (relay/src/store.ts).
const yDoc = new Y.Doc({ gc: false });
const yText = yDoc.getText("maptogether");

export const undoManager = new Y.UndoManager(yText, { captureTimeout: 350 });

export const awareness = new Awareness(yDoc);

const startSync = (id: string) =>
  connectSync(yDoc, awareness, id, {
    onStatus: (status) => {
      collaboration.status = status;
    },
  })
    .then((sync) => {
      if (import.meta.env.VITE_DEBUG_ENABLED === "true")
        (window as { __sync?: unknown }).__sync = sync;
    })
    .catch((err) => {
      collaboration.status = "error";
      console.error("[sync] failed to connect", err);
    });

/** Saves and shares the map; a new map starts once it's edited or shared. */
if (!room.id) collaboration.status = "draft";
export const mapLink = mapLifecycle(room, {
  connect: (id) => void startSync(id),
  created: (path) => {
    history.replaceState({}, "", path);
    keepMapOutOfSearch(false);
  },
});

let username = localStorage.getItem("username");
if (!username) {
  username = generateRandomAnimal();
  localStorage.setItem("username", username);
}

window.heap.identify(username);

awareness.setLocalStateField("user", {
  name: username,
  color: userColor.color,
  colorLight: userColor.light,
});

bindPresence(awareness);

const linterExtension = linter(togetherScriptLinter());

const startState = EditorState.create({
  doc: yText.toString(),
  extensions: [
    keymap.of(vscodeKeymap),
    basicSetup,
    linterExtension,
    lintGutter(),
    EditorView.lineWrapping,
    Theme,
    yCollab(yText, awareness, { undoManager }),
    EditorView.updateListener.of((e) => {
      if (e.docChanged) {
        mapLink.textChanged(() => e.state.doc.toString());
        handleEditorChange(e.state.doc.toString());
      }
    }),
  ],
});

export const editorView = new EditorView({
  state: startState,
  parent: document.getElementById("editor")!,
});

/** Tints the editor when the map can't follow the text (too many errors). */
const showMapOutOfDate = (outOfDate: boolean): void => {
  document.getElementById("editor")!.classList.toggle("map-out-of-date", outOfDate);
};

/** Replaces the whole map text, as one undoable edit. */
export const replaceText = (text: string) => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: text },
  });
};

/** Adds text to the end of the map, with the cursor after it. */
export const appendText = (text: string) => {
  editorView.dispatch({
    changes: {
      from: editorView.state.doc.length,
      insert: text,
    },
    selection: {
      anchor: editorView.state.doc.length + text.length,
    },
  });
};

/** Writes the components' new places on the canvas into the text, as one undoable edit. */
export const moveComponents = (moves: Move[]) => {
  const changes = moveChanges(editorView.state.doc.toString(), moves.map(toMapCoordinates));
  if (changes.length) editorView.dispatch({ changes });
};

const toMapCoordinates = ({ name, x, y }: Move) => {
  const [evolution, visibility] = MapSingleton.rendererToWardleyCoords(x, y);
  return { name, coordinates: [visibility, evolution] as const };
};

/** Renames a component and its links, as one undoable edit. */
export const renameComponent = (oldName: string, newName: string) => {
  renameInSelection(oldName, newName);
  const changes = renameChanges(editorView.state.doc.toString(), oldName, newName);
  if (changes.length) editorView.dispatch({ changes });
};

/** Deletes the selected components (with their links) and links from the text. */
export const deleteSelection = () => {
  const changes = deletionRanges(editorView.state.doc.toString(), {
    components: [...state.selection.selectionItems],
    edges: [...state.selection.edgeItems].map(linkEnds).filter((ends) => ends !== undefined),
  });
  clearSelection();
  if (changes.length) editorView.dispatch({ changes });
};

const handleEditorChange = debounce((text: string) => {
  setEditorText(text);
}, 32);

/** Draws the map from the text, and tints the editor when the map can't follow it. */
export const redrawMap = () => showMapOutOfDate(!drawMap(state.editor.editorText));

// Every text change redraws the whole map.
subscribe(state.editor, redrawMap);
