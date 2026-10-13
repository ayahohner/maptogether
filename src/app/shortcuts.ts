import { holdLink, holdPan, releaseHeld, setTool } from "../state/Tools";
import { isApple } from "./common/BrowserPlatform";

/** ⌘ on Apple devices, Ctrl elsewhere: hold it to link. */
export const LINK_KEY = isApple ? "Meta" : "Control";

/** Typing in the editor or a name field shouldn't switch tools. */
export const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches("input, textarea, select"));

const isShortcut = (e: KeyboardEvent) =>
  !isEditable(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey;

const holdSpace = (e: KeyboardEvent) => {
  // Space still presses a focused button.
  if (e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  holdPan(true);
};

const keyActions: Record<string, (e: KeyboardEvent) => void> = {
  v: () => setTool("select"),
  h: () => setTool("hand"),
  c: () => setTool("component"),
  l: () => setTool("link"),
  escape: () => setTool("select"),
  " ": holdSpace,
};

export function onKeyDown(e: KeyboardEvent) {
  if (e.key === LINK_KEY) return holdLink(true);
  if (isShortcut(e)) keyActions[e.key.toLowerCase()]?.(e);
}

export function onKeyUp(e: KeyboardEvent) {
  if (e.key === LINK_KEY) holdLink(false);
  if (e.key === " ") holdPan(false);
}

/** What the edit shortcuts call. */
export interface EditActions {
  undo(): void;
  redo(): void;
  deleteSelection(): void;
}

/** ⌘ on Apple devices and Ctrl elsewhere is "mod". */
const editKeys: Record<string, keyof EditActions> = {
  "mod+z": "undo",
  "mod+shift+z": "redo",
  "mod+y": "redo",
  delete: "deleteSelection",
  backspace: "deleteSelection",
};

/** The pressed keys, e.g. "mod+shift+z", if no key other than mod and shift is held. */
const chord = (e: KeyboardEvent) => {
  const [mod, other] = isApple ? [e.metaKey, e.ctrlKey] : [e.ctrlKey, e.metaKey];
  if (other || e.altKey) return undefined;
  return [mod && "mod", e.shiftKey && "shift", e.key.toLowerCase()].filter(Boolean).join("+");
};

/** The edit a key press asks for. Text fields keep their own undo and delete. */
export const editShortcut = (e: KeyboardEvent) => {
  const keys = isEditable(e.target) ? undefined : chord(e);
  return keys ? editKeys[keys] : undefined;
};

/** Edit shortcuts: ⌘Z / Ctrl+Z undo, with Shift (or Y) redo, Delete or Backspace deletes the selection. */
export function bindEditShortcuts(actions: EditActions, target: Window = window) {
  target.addEventListener("keydown", (e) => {
    const action = editShortcut(e);
    if (!action) return;
    e.preventDefault();
    actions[action]();
  });
}

/** Tool shortcuts: V select, H pan, C component, L link, Esc back to select. */
export function bindToolShortcuts(target: Window = window) {
  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", releaseHeld);
}
