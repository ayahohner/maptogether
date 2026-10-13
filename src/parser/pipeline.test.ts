import { describe, expect, it } from "vitest";

import { tryParse } from "./TogetherParser";

const pipelineChildren = (text: string) => {
  const cst: any = tryParse(text).cst;
  const pipeline = cst.children.statement[0].children.componentDeclaration[0].children.pipeline[0];
  return (pipeline.children.statement ?? []).map(
    (s: any) => s.children.componentDeclaration[0].children.Identifier[0].image,
  );
};

describe("pipelines", () => {
  it.each([
    ["no blank lines", "Tea [55, 73] {\n  Loose Leaf [55, 56]\n  Tea Bags [55, 90]\n}"],
    ["a blank line first", "Tea [55, 73] {\n\n  Loose Leaf [55, 56]\n  Tea Bags [55, 90]\n}"],
    [
      "blank lines between and after",
      "Tea [55, 73] {\n  Loose Leaf [55, 56]\n\n  \n  Tea Bags [55, 90]\n\n}",
    ],
  ])("parses with %s", (_, text) => {
    expect(pipelineChildren(text)).toEqual(["Loose Leaf", "Tea Bags"]);
  });

  it("parses an empty pipeline", () => {
    expect(pipelineChildren("Tea {\n\n}")).toEqual([]);
    expect(pipelineChildren("Tea {}")).toEqual([]);
  });
});
