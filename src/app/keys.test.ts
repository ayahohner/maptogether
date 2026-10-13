import { expect, it } from "vitest";

import { keyLabels } from "./keys";

it("uses Mac symbols on Apple devices and Windows conventions elsewhere", () => {
  expect(keyLabels(true)).toEqual({ mod: "⌘", undo: "⌘ Z", redo: "⌘ ⇧ Z", delete: "⌫" });
  expect(keyLabels(false)).toEqual({ mod: "Ctrl", undo: "Ctrl Z", redo: "Ctrl Y", delete: "Del" });
});
