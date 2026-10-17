import { describe, expect, it } from "vitest";

import { mapDiagnostics } from "./TogetherScriptLinter";

describe("mapDiagnostics", () => {
  it("marks a statement that doesn't parse as an error, over the whole statement", () => {
    expect(mapDiagnostics("Kettle [33, 50]\nPower [10,\nWater [22, 91]")).toEqual([
      { from: 16, to: 26, message: "This [ isn't closed", severity: "error" },
    ]);
  });

  it("adds the model's lints", () => {
    expect(mapDiagnostics("A\nA -- A").map((d) => d.severity)).toEqual(["warning"]);
  });
});
