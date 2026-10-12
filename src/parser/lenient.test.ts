import { describe, expect, it } from "vitest";

import { MAX_PROBLEMS, parseLeniently, parseMap } from "./lenient";

/** Names of the top-level components in a parse. */
const components = (text: string) =>
  (parseLeniently(text).cst?.children.statement ?? []).flatMap((s: any) =>
    (s.children.componentDeclaration ?? []).map((c: any) => c.children.Identifier[0].image),
  );

const problemLines = (text: string) => parseLeniently(text).problems.map((p) => p.line);

describe("parseLeniently", () => {
  it("parses good text with no problems", () => {
    expect(parseLeniently("Kettle [33, 50]\nPower [10, 86]").problems).toEqual([]);
    expect(components("Kettle [33, 50]\nPower [10, 86]")).toEqual(["Kettle", "Power"]);
  });

  it("sets aside a line that doesn't parse and keeps the rest", () => {
    const text = "Kettle [33, 50]\nPower [10,\nWater [22, 91]";
    expect(components(text)).toEqual(["Kettle", "Water"]);
    expect(problemLines(text)).toEqual([2]);
  });

  it("sets aside every bad line, one parse at a time", () => {
    const text = "Kettle [\nPower [10, 86]\nWater ]\nTea";
    expect(components(text)).toEqual(["Power", "Tea"]);
    expect(problemLines(text)).toEqual([1, 3]);
  });

  it("sets aside lines that can't be tokenized", () => {
    const text = "Kettle [33, 50]\nCafé [10, 86]";
    expect(components(text)).toEqual(["Kettle"]);
    expect(problemLines(text)).toEqual([2]);
  });

  it("blames the line before the end for an unclosed pipeline", () => {
    const text = "Kettle [33, 50]\nTea [55, 73] {\n  Tea Bags [55, 90]\n\n";
    expect(components(text)).toEqual(["Kettle"]);
    expect(problemLines(text)).toEqual([3, 2]);
  });

  it("gives up after too many problems", () => {
    const text = Array.from({ length: MAX_PROBLEMS + 5 }, () => "Bad [").join("\n");
    const result = parseLeniently(text);
    expect(result.cst).toBeUndefined();
    expect(result.problems).toHaveLength(MAX_PROBLEMS);
  });
});

describe("parseMap", () => {
  it("reuses the last result for the same text", () => {
    const first = parseMap("Kettle [33, 50]");
    expect(parseMap("Kettle [33, 50]")).toBe(first);
    expect(parseMap("Power [10, 86]")).not.toBe(first);
  });
});
