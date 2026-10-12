/**
 * Help content. Canvas help depends on the input: a mouse and keyboard, or
 * touch. Each step is a list of parts: plain words, or keys to draw as
 * keycaps ({ key }).
 */
import type { KeyLabels } from "../app/keys";

export type Input = "mouse" | "touch";
export type Part = string | { key: string };
export interface HelpRow {
  action: string;
  how: Part[];
}
export interface HelpSection {
  title: string;
  rows: HelpRow[];
}

/** "⌘ ⇧ Z" as keycaps. */
const keycaps = (keys: string): Part[] => keys.split(" ").map((key) => ({ key }));

const mouseHelp = ({ mod, undo, redo }: KeyLabels): HelpSection[] => [
  {
    title: "Create",
    rows: [
      { action: "Add a component", how: ["Double-click the canvas, or", { key: "C" }, "and click"] },
      { action: "Rename a component", how: ["Double-click it"] },
      { action: "Link two components", how: ["Hold", { key: mod }, "and click both, or", { key: "L" }] },
    ],
  },
  {
    title: "Select and move",
    rows: [
      { action: "Move", how: ["Drag a component or selection"] },
      { action: "Select several", how: ["Drag on empty canvas;", { key: "Shift" }, "adds"] },
      { action: "Delete", how: [{ key: "Delete" }, "or", { key: "Backspace" }] },
      { action: "Undo / redo", how: [...keycaps(undo), "/", ...keycaps(redo)] },
    ],
  },
  {
    title: "Navigate",
    rows: [
      { action: "Pan", how: ["Scroll, drag with", { key: "Space" }, "held, or", { key: "H" }] },
      { action: "Zoom", how: ["Pinch, or", { key: mod }, "+ scroll"] },
      { action: "Back to normal tool", how: [{ key: "V" }, "or", { key: "Esc" }] },
    ],
  },
];

const touchHelp: HelpSection[] = [
  {
    title: "Create",
    rows: [
      { action: "Add a component", how: ["Double-tap the canvas, then type a name"] },
      { action: "Rename a component", how: ["Double-tap it"] },
      { action: "Link two components", how: ["Tap the link tool, then tap both"] },
    ],
  },
  {
    title: "Select and move",
    rows: [
      { action: "Select", how: ["Tap a component"] },
      { action: "Move", how: ["Press and hold a component, then drag"] },
      { action: "Delete", how: ["Select it, then tap the bin in the toolbar"] },
    ],
  },
  {
    title: "Navigate",
    rows: [
      { action: "Pan", how: ["Drag the canvas with one finger"] },
      { action: "Zoom", how: ["Pinch with two fingers"] },
      { action: "Show the code", how: ["Tap the divider on the right edge"] },
    ],
  },
];

export const canvasHelp = (input: Input, keys: KeyLabels) =>
  input === "touch" ? touchHelp : mouseHelp(keys);

export interface SyntaxExample {
  title: string;
  code: string;
  explanation: string;
}

export const syntaxHelp: SyntaxExample[] = [
  {
    title: "Component",
    code: "Kettle [33, 50]",
    explanation:
      "A name, then [visibility, evolution]. Both run from 0 to 100: visibility from hidden infrastructure up to the user, evolution from Genesis across to Commodity.",
  },
  {
    title: "Dependency",
    code: "Cup of Tea.Kettle",
    explanation: "needer.needed draws a line from a component to one it depends on.",
  },
  {
    title: "Pipeline",
    code: "Tea [55, 73] {\n  Loose Leaf [55, 56]\n  Tea Bags [55, 90]\n}",
    explanation:
      "Braces after a component make a pipeline: one need met at several stages of evolution. Children sit on the pipeline's row, so only their evolution counts.",
  },
  {
    title: "Comment",
    code: "// Ignored by the map",
    explanation: "Lines starting with // are notes for people.",
  },
];
