import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildModel } from "../model/model";
import { parseMap } from "../parser/parse";
import { importOwm } from "./owm";

const convert = (...lines: string[]) => importOwm(lines.join("\n")).text;

describe("importOwm", () => {
  it("converts components, users, markets and links, scaling positions to 0–100", () => {
    expect(
      convert(
        "anchor Business [0.95, 0.63]",
        "component Cup of Tea [0.79, 0.61] label [19, -4]",
        "market Power [0.1, 0.7] (outsource) // the grid",
        "component Kettle [0.43, 0.35] inertia (ecosystem)",
        "Business->Cup of Tea",
        "Business->Kettle; boils",
        "Kettle+'£1'<>Power",
        "Kettle+>Power",
      ),
    ).toBe(
      [
        "Business [95, 63, type=user]",
        'Cup of Tea [79, 61, label=("Cup of Tea", 19, -4)]',
        "Power [10, 70, type=market, sourcing=outsource] // the grid",
        "Kettle [43, 35, type=ecosystem, inertia]",
        "Business -- Cup of Tea",
        'Business -- Kettle [label="boils"]',
        'Kettle -- Power [flow, label="£1"]',
        "Kettle -- Power [flow]",
      ].join("\n"),
    );
  });

  it("folds evolve, pipeline bounds and sourcing lines into their component", () => {
    expect(
      convert(
        "component Kettle [0.43, 0.35]",
        "evolve Kettle->Electric Kettle 0.62 (buy)",
        "pipeline Kettle [0.3, 0.7]",
        "component Cup [0.73, 0.78]",
        "evolve Cup 0.9",
        "build Cup",
      ),
    ).toBe(
      [
        'Kettle [43, 35, evolve=(62, label="Electric Kettle", sourcing=buy), pipeline=(30, 70)]',
        "Cup [73, 78, sourcing=build, evolve=90]",
      ].join("\n"),
    );
  });

  it("puts a pipeline's components inside it, on its row", () => {
    expect(
      convert(
        "component Tea [0.63, 0.81]",
        "pipeline Tea",
        "{",
        "  component Loose Leaf [0.56]",
        "  component Tea Bags [0.9] (buy)",
        "}",
        "pipeline Hidden",
      ),
    ).toBe(
      ["Tea [63, 81] {", "  Loose Leaf [63, 56]", "  Tea Bags [63, 90, sourcing=buy]", "}"].join(
        "\n",
      ),
    );
  });

  it("gathers settings into @map, and keeps notes and comments", () => {
    expect(
      convert(
        "title Tea Shop",
        "style plain",
        "evolution Uncharted->Emerging->->Industrialised",
        "size [1100, 800]",
        'note Standard "supply" [0.94, 0.38]',
        "/* A block",
        "   comment */",
        "// kept",
      ),
    ).toBe(
      [
        '@map [title="Tea Shop", style=plain, evolution=("Uncharted", "Emerging", "", "Industrialised")]',
        '"Standard \\"supply\\"" [94, 38]',
        "// A block",
        "// comment",
        "// kept",
      ].join("\n"),
    );
  });

  it("writes names v2 would read differently in backticks, and keeps quoted line breaks", () => {
    expect(convert('component "Two\\nlines" [0.2, 0.2]', "component A--B [0.3, 0.3]")).toBe(
      ['Two lines [20, 20, label="Two\\nlines"]', "`A--B` [30, 30]"].join("\n"),
    );
  });

  it("keeps what it can't convert yet as comments, and says why", () => {
    const { text, problems } = importOwm(
      [
        "pioneers [0.59, 0.43, 0.49, 0.63]",
        "evolve Ghost 0.8",
        "mystery line",
        "component Kettle [0.4, 0.3] wobbly",
        "evolve Kettle 0.8 label [5, -10]",
      ].join("\n"),
    );
    expect(text).toBe(
      [
        "// owm: pioneers [0.59, 0.43, 0.49, 0.63]",
        "// owm: evolve Ghost 0.8",
        "// owm: mystery line",
        "Kettle [40, 30, evolve=80]",
      ].join("\n"),
    );
    expect(problems).toEqual([
      { line: 1, message: "pioneers isn't drawn yet, so it's kept as a comment." },
      { line: 2, message: "Ghost isn't a component, so its evolve is kept as a comment." },
      { line: 3, message: "Couldn't convert: mystery line" },
      { line: 4, message: "Left out wobbly on Kettle" },
      { line: 5, message: "Left out where Kettle's future label sits" },
    ]);
  });

  it.each(["component-comment.owm", "component-pipeline-comment.owm"])(
    "converts %s to a map v2 reads without problems",
    (file) => {
      const owm = readFileSync(`examples/owm/${file}`, "utf8");
      const { text, problems } = importOwm(owm);
      expect(problems).toEqual([]);
      expect(parseMap(text).problems).toEqual([]);
      expect(buildModel(parseMap(text)).model.components.size).toBeGreaterThan(30);
    },
  );
});
