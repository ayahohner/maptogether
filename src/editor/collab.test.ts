import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, it } from "vitest";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";

import { moveChanges } from "./edits";

/** An editor bound to its own Y.Doc, with that doc's updates sent to `peer`. */
const collaborator = (peer: Y.Doc, text: string) => {
  const doc = new Y.Doc();
  const yText = doc.getText("maptogether");
  yText.insert(0, text);
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));
  doc.on("update", (update) => Y.applyUpdate(peer, update));
  const undoManager = new Y.UndoManager(yText);
  const view = new EditorView({
    state: EditorState.create({ doc: text, extensions: [yCollab(yText, null, { undoManager })] }),
  });
  return { view, undoManager };
};

it("sends a move of several components to peers as one edit, undone in one step", () => {
  const text = "Power [10, 86]\nKettle [33, 50]\nKettle -- Power\nCup [80, 20]";
  const peer = new Y.Doc();
  const { view, undoManager } = collaborator(peer, text);

  view.dispatch({
    changes: moveChanges(text, [
      { name: "Cup", coordinates: ["5", "6"] },
      { name: "Power", coordinates: ["1", "2"] },
      { name: "Kettle", coordinates: ["40", "60"] },
    ]),
  });

  const moved = "Power [1, 2]\nKettle [40, 60]\nKettle -- Power\nCup [5, 6]";
  expect(view.state.doc.toString()).toBe(moved);
  expect(peer.getText("maptogether").toString()).toBe(moved);
  undoManager.undo();
  expect(peer.getText("maptogether").toString()).toBe(text);
});
