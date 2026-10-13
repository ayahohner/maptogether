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

/** Tool shortcuts: V select, H pan, C component, L link, Esc back to select. */
export function bindToolShortcuts(target: Window = window) {
  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", releaseHeld);
}
