import { describe, expect, it } from "vitest";

import { deletionRanges, edgeEnds, type Deletion } from "./deletions";

/** The text left after deleting. */
const remove = (text: string, deletion: Partial<Deletion>) => {
  const ranges = deletionRanges(text, { components: [], edges: [], ...deletion });
  return ranges.reduceRight((rest, { from, to }) => rest.slice(0, from) + rest.slice(to), text);
};

const map = [
  "Cup of Tea [80, 62]",
  "Tea [55, 73] {",
  "  Loose Leaf [55, 56]",
  "  Tea Bags [55, 90]",
  "}",
  "Kettle [33, 50]",
  "Cup of Tea.Tea",
  "Cup of Tea.Kettle // boils",
  "Kettle.Power",
].join("\n");

describe("deletionRanges", () => {
  it("deletes a component's line and its links, leaving no blank lines", () => {
    expect(remove(map, { components: ["Kettle"] })).toBe(
      [
        "Cup of Tea [80, 62]",
        "Tea [55, 73] {",
        "  Loose Leaf [55, 56]",
        "  Tea Bags [55, 90]",
        "}",
        "Cup of Tea.Tea",
      ].join("\n"),
    );
  });

  it("deletes a pipeline child without breaking the pipeline", () => {
    expect(remove(map, { components: ["Loose Leaf"] })).toContain(
      "Tea [55, 73] {\n  Tea Bags [55, 90]\n}",
    );
  });

  it("deletes a pipeline with its children", () => {
    expect(remove(map, { components: ["Tea"] })).toBe(
      ["Cup of Tea [80, 62]", "Kettle [33, 50]", "Cup of Tea.Kettle // boils", "Kettle.Power"].join(
        "\n",
      ),
    );
  });

  it("ignores braces and comment marks in quotes, and braces in comments", () => {
    expect(remove('A (note="{")\nB [1, 2]', { components: ["A"] })).toBe("B [1, 2]");
    expect(remove("A (note='}') {\n  C\n}\nB", { components: ["A"] })).toBe("B");
    expect(remove('A (note="//") {\n  C\n}\nB', { components: ["A"] })).toBe("B");
    expect(remove("A // {\nB", { components: ["A"] })).toBe("B");
  });

  it("deletes a link written either way round, with attributes or a comment", () => {
    expect(remove(map, { edges: ["Kettle->Cup of Tea"] })).not.toContain("Cup of Tea.Kettle");
    expect(remove("A [1, 2]\nA.(weight=2)B\nB [3, 4]", { edges: ["A->B"] })).toBe(
      "A [1, 2]\nB [3, 4]",
    );
  });

  it("leaves other links alone", () => {
    expect(remove("A.B\nA.BC\nAB.B", { edges: ["A->B"] })).toBe("A.BC\nAB.B");
  });

  it("takes the newline before a deletion at the very end", () => {
    expect(remove("A [1, 2]\nB [3, 4]", { components: ["B"] })).toBe("A [1, 2]");
    expect(remove("A [1, 2]\nB [3, 4]\n", { components: ["B"] })).toBe("A [1, 2]\n");
    expect(remove("A [1, 2]", { components: ["A"] })).toBe("");
  });

  it("finds nothing to delete for unknown names", () => {
    expect(deletionRanges(map, { components: ["Teapot"], edges: ["X->Y"] })).toEqual([]);
  });
});

describe("edgeEnds", () => {
  it("splits a link key at the first arrow", () => {
    expect(edgeEnds("Cup of Tea->Tea")).toEqual(["Cup of Tea", "Tea"]);
    expect(edgeEnds("A-->B")).toEqual(["A-", "B"]);
  });
});
