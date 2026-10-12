import Combokeys from "combokeys";

import { isApple } from "./common/BrowserPlatform";

import { deleteComponents, undoManager } from "../editor/Editor";

import { state, stopSelecting } from "../state/State";
import { releaseHeld } from "../state/Tools";
import { bindToolShortcuts } from "./shortcuts";

var combokeys = new Combokeys(document.documentElement);
// Allow hotkeys when focused on inputs
combokeys.stopCallback = () => false;

const ctrlCmd = isApple ? "command" : "ctrl";

const resetInteractiveStates = () => {
  releaseHeld();
  stopSelecting();
};

export const initializeUserEvents = () => {
  combokeys.bind(`${ctrlCmd}+z`, (event) => {
    if (!(event.target as Element).classList.contains("cm-content")) {
      event.preventDefault();
      undoManager.undo();
    }
  });
  combokeys.bind([`${ctrlCmd}+shift+z`, `${ctrlCmd}+y`], (event) => {
    if (!(event.target as Element).classList.contains("cm-content")) {
      event.preventDefault();
      undoManager.redo();
    }
  });
  bindToolShortcuts();

  combokeys.bind(
    ["del", "backspace"],
    (e: KeyboardEvent) => {
      if (
        !(e.target as Element).classList.contains("cm-content") &&
        !(e.target as Element).classList.contains("componentInput")
      ) {
        // Delete item
        deleteComponents(Array.from(state.selection.selectionItems.values()));
      }
    },
    "keydown"
  );

  window.addEventListener("blur", resetInteractiveStates);
};
