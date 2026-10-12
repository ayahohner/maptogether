import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { toDiagnostics } from "./TogetherScriptLinter";

describe("toDiagnostics", () => {
  const doc = Text.of(["Kettle [33, 50]", "Power [10,", "Water [22, 91]"]);

  it("covers the whole line of each problem", () => {
    expect(toDiagnostics(doc, [{ line: 2, message: "bad" }])).toEqual([
      { from: 16, to: 26, message: "bad", severity: "error" },
    ]);
  });

  it("puts problems past the end on the last line", () => {
    expect(toDiagnostics(doc, [{ line: Infinity, message: "end" }])[0]).toMatchObject({ from: 27, to: 41 });
  });
});
