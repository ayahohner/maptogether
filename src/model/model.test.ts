import { describe, expect, it } from "vitest";

import { parse } from "../parser/parse";
import { buildModel } from "./model";

const build = (text: string) => buildModel(parse(text));
const lintMessages = (text: string) =>
  build(text).lints.map(({ message, severity }) => [severity, message]);

describe("buildModel", () => {
  it("reads components, with the default position for those without one", () => {
    expect([...build("Kettle [33, 50.5]\nPower\nOdd [1]").model.components.values()]).toEqual([
      { name: "Kettle", visibility: 33, evolution: 50.5, inPipeline: undefined },
      { name: "Power", visibility: 10, evolution: 10, inPipeline: undefined },
      { name: "Odd", visibility: 10, evolution: 10, inPipeline: undefined },
    ]);
  });

  it("puts a pipeline's components on its row, and draws a nested pipeline empty", () => {
    const { components } = build(
      'Tea [55, 73] {\n  Leaf [20, 56]\n  Bags {\n    Dust [1, 2]\n  }\n  "note"\n}',
    ).model;
    expect(components.get("Tea")).toMatchObject({ pipeline: [56, 10] });
    expect(components.get("Leaf")).toMatchObject({
      visibility: 55,
      evolution: 56,
      inPipeline: "Tea",
    });
    expect(components.get("Bags")).toMatchObject({
      visibility: 55,
      inPipeline: "Tea",
      pipeline: [],
    });
    expect(components.get("Dust")).toMatchObject({ visibility: 55, inPipeline: "Bags" });
  });

  it("keeps the first of two components with the same name", () => {
    const { model, lints } = build("Kettle [1, 2]\nKettle [3, 4]");
    expect(model.components.get("Kettle")).toMatchObject({ visibility: 1 });
    expect(lints).toEqual([
      {
        from: 14,
        to: 20,
        severity: "error",
        message: "Kettle is already on the map, so this one is left out.",
      },
    ]);
  });

  it("reads links, links to components declared later included", () => {
    expect(build('A -- B\nA\nB\n@map\n"note"').model.links).toEqual([["A", "B"]]);
  });

  it("warns about links to themselves and to undeclared components", () => {
    expect(lintMessages("A\nA -- A\nA -- Teapot")).toEqual([
      ["warning", "A component can't need itself, so the map leaves out this link."],
      ["warning", "Teapot isn't on the map, so this link isn't drawn until it is."],
    ]);
  });
});
