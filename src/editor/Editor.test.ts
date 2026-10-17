import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  document.body.innerHTML = '<div id="editor"></div>';
  window.heap = { identify: vi.fn() } as unknown as typeof window.heap;
});
vi.mock("../sync/connect", () => ({
  connectSync: vi.fn(() => Promise.reject(new Error("offline"))),
}));
vi.mock("../map/drawMap", () => ({ drawMap: vi.fn(() => true) }));
// Pixels are map percentages here, with y pointing down.
vi.mock("../map/components/MapSingleton", () => ({
  default: {
    rendererToWardleyCoords: (x: number, y: number) => [x.toFixed(1), (100 - y).toFixed(1)],
  },
}));

import { drawMap } from "../map/drawMap";
import { replaceSelection } from "../state/State";
import { connectSync } from "../sync/connect";
import { collaboration } from "../sync/presence";
import {
  appendText,
  deleteSelection,
  editorView,
  moveComponents,
  renameComponent,
  replaceText,
  undoManager,
} from "./Editor";

const text = () => editorView.state.doc.toString();
const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Editor", () => {
  it("saves and shares a new map from its first edit", async () => {
    expect(collaboration.status).toBe("draft");
    vi.spyOn(console, "error").mockImplementation(() => {});

    appendText("Kettle [33, 50]");
    expect(editorView.state.selection.main.head).toBe(text().length);
    const id = location.pathname.slice(1);
    expect(id).toMatch(/^[\w-]{8}$/);
    expect(connectSync).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      id,
      expect.anything(),
    );
    await settle();
    expect(collaboration.status).toBe("error");
  });

  it("writes moves, renames and deletions into the text, each as one undoable edit", () => {
    replaceText("Kettle [33, 50]\nPower [10, 86]\nKettle -- Power");
    undoManager.stopCapturing();

    moveComponents([
      { name: "Kettle", x: 60, y: 30 },
      { name: "Power", x: 20, y: 90 },
    ]);
    expect(text()).toBe("Kettle [70.0, 60.0]\nPower [10.0, 20.0]\nKettle -- Power");
    undoManager.undo();
    expect(text()).toBe("Kettle [33, 50]\nPower [10, 86]\nKettle -- Power");
    // A component that isn't in the text moves nothing.
    const edits = undoManager.undoStack.length;
    moveComponents([{ name: "Cup", x: 1, y: 1 }]);
    expect(undoManager.undoStack).toHaveLength(edits);

    renameComponent("Kettle", "Pot");
    expect(text()).toBe("Pot [33, 50]\nPower [10, 86]\nPot -- Power");
    undoManager.stopCapturing();

    replaceSelection(["Power"]);
    deleteSelection();
    expect(text()).toBe("Pot [33, 50]");
    undoManager.undo();
    expect(text()).toBe("Pot [33, 50]\nPower [10, 86]\nPot -- Power");
  });

  it("redraws the map once typing settles, tinting the editor when the map can't follow", async () => {
    vi.mocked(drawMap).mockReturnValue(false);
    appendText("\n(");
    await settle(50);
    expect(drawMap).toHaveBeenLastCalledWith(text());
    expect(document.getElementById("editor")!.classList).toContain("map-out-of-date");
  });
});
