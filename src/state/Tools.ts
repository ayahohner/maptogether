import { proxy } from "valtio/vanilla";

/** Canvas tools, as on the toolbar. */
export type Tool = "select" | "hand" | "component" | "link";

export const tools = proxy({
  /** The tool picked on the toolbar or with its shortcut. */
  tool: "select" as Tool,
  /** ⌘/Ctrl held: link while held. */
  linkHeld: false,
  /** Space held: pan while held. */
  panHeld: false,
});

/** The tool in effect: a held key wins over the picked tool. */
export const activeTool = (t: typeof tools = tools): Tool => {
  if (t.linkHeld) return "link";
  return t.panHeld ? "hand" : t.tool;
};

export const setTool = (tool: Tool) => {
  tools.tool = tool;
};

export const holdLink = (held: boolean) => {
  tools.linkHeld = held;
};

export const holdPan = (held: boolean) => {
  tools.panHeld = held;
};

/** Lets go of held keys, e.g. when the window loses focus mid-press. */
export const releaseHeld = () => {
  holdLink(false);
  holdPan(false);
};
