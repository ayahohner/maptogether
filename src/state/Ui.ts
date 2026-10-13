import { proxy } from "valtio/vanilla";

/** Which half of the app the help panel explains. */
export type HelpTopic = "canvas" | "code";

/** UI chrome state, separate from map state so menus never rerender the map. */
export const ui = proxy({
  help: { open: false, topic: "canvas" as HelpTopic },
});

export const openHelp = (topic: HelpTopic = "canvas") => {
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
