import { proxy } from "valtio/vanilla";

/** Which half of the app the help panel explains. */
export type HelpTopic = "canvas" | "code";

/** UI chrome state, separate from map state so menus never rerender the map. */
export const ui = proxy({
  help: { open: false, topic: "canvas" as HelpTopic },
  /** The pane the user last worked in; the help panel opens on its topic. */
  lastTopic: "canvas" as HelpTopic,
});

export const openHelp = (topic: HelpTopic = ui.lastTopic) => {
  ui.help.topic = topic;
  ui.help.open = true;
};

export const closeHelp = () => {
  ui.help.open = false;
};

export const toggleHelp = () => {
  if (ui.help.open) closeHelp();
  else openHelp();
};

export const setHelpTopic = (topic: HelpTopic) => {
  ui.help.topic = topic;
};

/** Remembers whether the user last pressed in the editor or on the canvas. */
export const trackHelpTopic = (root: Document = document) => {
  const onPointerDown = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.closest?.("#editorContainer")) ui.lastTopic = "code";
    else if (target?.closest?.("#map")) ui.lastTopic = "canvas";
  };
  root.addEventListener("pointerdown", onPointerDown, true);
  root.addEventListener("focusin", onPointerDown, true);
  return () => {
    root.removeEventListener("pointerdown", onPointerDown, true);
    root.removeEventListener("focusin", onPointerDown, true);
  };
};
