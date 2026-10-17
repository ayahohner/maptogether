import { describe, expect, it } from "vitest";
import { importV1 } from "./v1";

const convert = (text: string) => importV1(text).text;

describe("importV1", () => {
  it("converts the tea shop", () => {
    const v1 = [
      "// name [visibility, evolution], needer.needed",
      "Business [95, 46]",
      "Tea [55, 73] {",
      "  Loose Leaf [55,56]",
      "}",
      "",
      "Business.Tea",
      "Tea . Loose Leaf",
    ].join("\n");
    expect(importV1(v1)).toEqual({
      text: [
        "// name [visibility, evolution], needer.needed",
        "Business [95, 46]",
        "Tea [55, 73] {",
        "  Loose Leaf [55, 56]",
        "}",
        "",
        "Business -- Tea",
        "Tea -- Loose Leaf",
      ].join("\n"),
      problems: [],
    });
  });

  it("keeps components with no position, and names that run into the position", () => {
    expect(convert("online mapping tool[82.4,50.3]\nKettle")).toBe(
      "online mapping tool [82.4, 50.3]\nKettle",
    );
  });

  it("keeps trailing comments", () => {
    expect(convert("Kettle [33, 50] // electric\nKettle.Power   // mains")).toBe(
      "Kettle [33, 50] // electric\nKettle -- Power // mains",
    );
  });

  it("moves a label offset into the label tuple, with the name as its text", () => {
    expect(convert("Kettle [33, 50] (label=-40,10)")).toBe(
      'Kettle [33, 50, label=("Kettle", -40, 10)]',
    );
  });

  it("converts other attributes to keywords", () => {
    expect(convert("Kettle [33, 50] (inertia sourcing=build label='Big \"K\"' size=3)")).toBe(
      'Kettle [33, 50, inertia, sourcing=build, label="Big \\"K\\"", size=3]',
    );
    expect(convert("Kettle (offset=1,2)")).toBe("Kettle [offset=(1, 2)]");
  });

  it("names a definition by its number, keeping the text as the label", () => {
    expect(convert("government:2 [40, 20]")).toBe('government 2 [40, 20, label="government"]');
  });

  it("converts link types", () => {
    expect(convert("Hot Water.(t=constraint)Kettle")).toBe("Hot Water -- Kettle [constraint]");
  });

  it("converts notes", () => {
    expect(convert("# Hot water is obvious [48, 85]\n#Tea\\ leaves")).toBe(
      '"Hot water is obvious" [48, 85]\n"Tea\\\\ leaves"',
    );
  });

  it("converts the map style, across lines", () => {
    const v1 = [
      "/mapstyle(",
      '  title="Society" // the whole map',
      "  style=wardley",
      "  evolutionlabels=genesis:10,emerging:25",
      ")",
      "Kettle",
    ].join("\n");
    expect(importV1(v1)).toEqual({
      text: [
        '@map [title="Society", style=wardley, evolution=("genesis", "emerging")] // the whole map',
        "Kettle",
      ].join("\n"),
      problems: [],
    });
  });

  it("puts names in backticks when v2 would read them differently", () => {
    expect(convert("C--IL [40, 60]\n@home.a;b")).toBe("`C--IL` [40, 60]\n`@home` -- `a;b`");
  });

  it("keeps a line it can't convert as a comment, and reports it", () => {
    const v1 = [
      "/other(x=1)",
      "Kettle [33, 50] (y-axis)",
      "Kettle [33, 50] (label=Big)",
      "Kettle.(t=Thick)Power",
      "`odd` [1, 2] // why",
      "Kettle^",
      "Kettle [33, 50] (a=1 +)",
    ].join("\n");
    const { text, problems } = importV1(v1);
    expect(text).toBe(
      [
        "// v1: /other(x=1)",
        "// v1: Kettle [33, 50] (y-axis)",
        "// v1: Kettle [33, 50] (label=Big)",
        "// v1: Kettle.(t=Thick)Power",
        "// v1: `odd` [1, 2] // why",
        "// v1: Kettle^",
        "// v1: Kettle [33, 50] (a=1 +)",
      ].join("\n"),
    );
    expect(problems.map((p) => p.line)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(problems[0].message).toBe("Couldn't convert: /other(x=1)");
  });

  it("reads Windows line endings and an empty map", () => {
    expect(convert("A [1, 2]\r\nA.B")).toBe("A [1, 2]\nA -- B");
    expect(convert("")).toBe("");
  });

  it("keeps a parenthesis that never closes on its own line", () => {
    expect(importV1("Kettle (label=1").problems).toEqual([
      { line: 1, message: "Couldn't convert: Kettle (label=1" },
    ]);
  });
});
