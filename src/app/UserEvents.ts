import Combokeys from "combokeys";

import { isApple } from "./common/BrowserPlatform";

import { deleteSelection, undoManager } from "../editor/Editor";

import { stopSelecting } from "../state/State";
import { releaseHeld } from "../state/Tools";
import { bindToolShortcuts, isEditable } from "./shortcuts";

const combokeys = new Combokeys(document.documentElement);
// Shortcuts also work while a text field has focus.
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
      if (!isEditable(e.target)) deleteSelection();
    },
    "keydown",
  );

  window.addEventListener("blur", resetInteractiveStates);
};
