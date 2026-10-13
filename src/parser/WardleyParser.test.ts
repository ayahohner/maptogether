import { parseToAST } from "./WardleyParser";

import { it, expect, describe } from "vitest";

describe("parseInput with whitespace", () => {
  it("works with an empty string", () => {
    expect(parseToAST("")).toStrictEqual([]);
  });

  it("works with a space", () => {
    expect(parseToAST(" ")).toStrictEqual([]);
  });

  it("works with a newline", () => {
    expect(parseToAST("\n")).toStrictEqual([]);
  });

  it("works with multiple newlines", () => {
    expect(parseToAST("\n\n\n\r\n")).toStrictEqual([]);
  });
});

describe("parseInput with component declarations", () => {
  it("single component declaration", () => {
    expect(parseToAST("component apples")).toStrictEqual([
      {
        componentName: "apples",
        coordinates: undefined,
        type: "componentDeclaration",
      },
    ]);
  });

  it("odd characters", () => {
    expect(parseToAST("component _apples 1h92+:_")).toStrictEqual([
      {
        componentName: "_apples 1h92+:_",
        coordinates: undefined,
        type: "componentDeclaration",
      },
    ]);
  });

  it("extra whitespace", () => {
    expect(parseToAST("component _apples 1h92+   \t ")).toStrictEqual([
      {
        componentName: "_apples 1h92+",
        coordinates: undefined,
        type: "componentDeclaration",
      },
    ]);
  });

  it("with coordinates", () => {
    expect(parseToAST("component _apples 1h92+   \t [-1,2.3e1]")).toStrictEqual([
      {
        componentName: "_apples 1h92+",
        coordinates: [-1, 2.3e1],
        type: "componentDeclaration",
      },
    ]);
  });

  it("fails with coordinates that aren't numbers", () => {
    expect(() => parseToAST('component _apples 1h92+   \t [aoo,"2"]')).toThrowError(
      "NumberLiteral",
    );
  });
});

describe("parseInput with edge statement", () => {
  it("single edge statement", () => {
    expect(parseToAST(" apples -> oranges ")).toStrictEqual([
      {
        lhs: "apples",
        rhs: "oranges",
        type: "edgeDeclaration",
      },
    ]);
  });
});
