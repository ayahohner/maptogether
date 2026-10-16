import { describe, expect, it } from "vitest";

import { isComponentName, matchComponentRegex, matchEdgeRegex } from "./TogetherParser";

const match = (pattern: string, line: string) => new RegExp(pattern).exec(line);

describe("matchComponentRegex", () => {
  it.each([
    "corn",
    "corn// comment",
    "corn  \t// comment",
    "corn [-1.3, 2.3e1]",
    " corn [-1.3, 2.3e1] ",
    "corn[-1.3,2.3]//[0.3,0.5]",
  ])("matches a line declaring corn: %j", (line) => {
    expect(match(matchComponentRegex("corn"), line)).not.toBeNull();
  });

  it.each(["corn  hole", "corn  hole [0.3, 0.4]", "corn \t hole ///", "cornhole", "corn.Power"])(
    "doesn't match another component or a link: %j",
    (line) => {
      expect(match(matchComponentRegex("corn"), line)).toBeNull();
    },
  );

  it("captures each part of the line", () => {
    const groups = match(
      matchComponentRegex("Tea"),
      "  Tea:2 [55, 73] (inertia) { // drinks",
    )!.slice(1);
    expect(groups).toEqual([
      "  ",
      "Tea",
      ":2",
      " ",
      "[55, 73]",
      " ",
      "(inertia)",
      " ",
      "{ // drinks",
      undefined,
      undefined,
    ]);
  });

  it("treats the name literally, not as a pattern", () => {
    expect(match(matchComponentRegex("C++ (beta)"), "C++ (beta) [1, 2]")).not.toBeNull();
    expect(match(matchComponentRegex("a.c"), "abc")).toBeNull();
  });
});

describe("matchEdgeRegex", () => {
  it("matches a link with the name on the left, in groups 1–4", () => {
    const m = match(matchEdgeRegex("Kettle"), "  Kettle.Power // boils")!;
    expect(m.slice(1, 5)).toEqual(["  ", "Kettle", undefined, "Power // boils"]);
  });

  it("matches a link with the name on the right, in group 9", () => {
    const m = match(matchEdgeRegex("Power"), "Kettle.(heat)Power // boils")!;
    expect([m[5], m[6], m[9], m[11]]).toEqual(["Kettle", ".(heat)", "Power", "// boils"]);
  });

  it("doesn't match the component's own declaration", () => {
    expect(match(matchEdgeRegex("Kettle"), "Kettle [33, 50]")).toBeNull();
  });
});

describe("isComponentName", () => {
  it("takes names in any script, with spaces and symbols between words", () => {
    for (const name of ["Tea", "Tea Bags", "2nd hand", "R&D", "Café", "東京", "𠀀 root"])
      expect(isComponentName(name)).toBe(true);
  });

  it("refuses names the syntax would read otherwise", () => {
    for (const name of ["", "Node.js", "C#", "Web/API", "a, b", "Tea (hot)", "42", " Tea", "Tea "])
      expect(isComponentName(name)).toBe(false);
  });
});
