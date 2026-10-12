import { isApple } from "./common/BrowserPlatform";

/** How shortcut keys are labelled: Mac symbols, or Windows and Linux names. */
export interface KeyLabels {
  /** Hold to link; with Z to undo. */
  mod: string;
  undo: string;
  redo: string;
  delete: string;
}

export const keyLabels = (apple: boolean): KeyLabels =>
  apple
    ? { mod: "⌘", undo: "⌘ Z", redo: "⌘ ⇧ Z", delete: "⌫" }
    : { mod: "Ctrl", undo: "Ctrl Z", redo: "Ctrl Y", delete: "Del" };

export const keys = keyLabels(isApple);
