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
      {
        action: "Add a component",
        how: ["Double-click the canvas, or", { key: "C" }, "and click"],
      },
      { action: "Rename a component", how: ["Double-click it"] },
      {
        action: "Link two components",
        how: ["Hold", { key: mod }, "and click both, or", { key: "L" }],
      },
    ],
  },
  {
    title: "Select and move",
    rows: [
      { action: "Move", how: ["Drag a component or selection"] },
      { action: "Select a link", how: ["Click the line"] },
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
      { action: "Select", how: ["Tap a component or link"] },
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
    code: "Cup of Tea -- Kettle",
    explanation:
      'needer -- needed draws a line from a component to one it depends on. Add [constraint] for a thick line, [flow] for value moving along it, or [label="pays"].',
  },
  {
    title: "Type",
    code: "Business [95, 46, type=user]\nPower [10, 86, type=market]",
    explanation:
      "type=user, type=market or type=ecosystem changes a component's symbol. Leave it out for a plain component.",
  },
  {
    title: "Sourcing and inertia",
    code: "Staff [62, 28, sourcing=build, inertia]",
    explanation:
      "sourcing=build, buy or outsource shades a circle behind the component, darker the further it's sourced. inertia draws a bar: something resists the component evolving.",
  },
  {
    title: "Evolve",
    code: 'Kettle [33, 50, evolve=80]\nKettle [33, 50, evolve=(80, label="Smart Kettle")]',
    explanation:
      "Where a component is expected to move to, drawn in red with a dashed arrow. Give the future its own label or sourcing in brackets.",
  },
  {
    title: "Label",
    code: 'Kettle [33, 50, label=("Electric kettle", -40, 10)]',
    explanation:
      'label="text" changes the text drawn. Drag a label on the map to move it, which writes the tuple form with where it sits, in pixels from the component.',
  },
  {
    title: "Pipeline",
    code: "Tea [55, 73] {\n  Loose Leaf [55, 56]\n  Tea Bags [55, 90]\n}",
    explanation:
      "Braces after a component make a pipeline: one need met at several stages of evolution. Children sit on the pipeline's row, so only their evolution counts. pipeline=(from, to) widens its box to span those evolutions.",
  },
  {
    title: "Note",
    code: '"Hot water is obvious" [48, 85]',
    explanation:
      "Text in quotes is a note: prose on the map, not a component. Drag it like one, and double-click it to rewrite it.",
  },
  {
    title: "Map settings",
    code: '@map [\n  title="Tea Shop",\n  style=plain,\n  evolution=("Novel", "Emerging", "Good", "Best"),\n]',
    explanation:
      '@map, at the top, sets the title (the tab and the export are named after it), style=wardley or plain, the stage names (evolution=), where the stages begin (stages=(17.4, 40, 70)), and visibility=("Visible", "Invisible"). evolution=hidden or visibility=hidden hides an axis\'s labels.',
  },
  {
    title: "Comment",
    code: "// Ignored by the map",
    explanation: "Lines starting with // are notes for people.",
  },
];
