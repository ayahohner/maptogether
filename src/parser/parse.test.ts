import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { lineStarts, parse, parseMap } from "./parse";
import type { Head, Statement, Value } from "./syntax";

/** A head as text, for short expectations. */
const headText = (head: Head): string => {
  if (head.kind === "component") return head.name.text;
  if (head.kind === "link") return `${head.from.text} -- ${head.to.text}`;
  if (head.kind === "note") return JSON.stringify(head.text.value);
  const subject = head.subject && ("text" in head.subject ? head.subject.text : head.subject.value);
  return `@${head.word.text}${subject ? ` ${subject}` : ""}`;
};

const heads = (text: string) => parse(text).statements.map((s) => headText(s.head));
const problems = (text: string) =>
  parse(text).problems.map(({ line, message }) => ({ line, message }));
const first = (text: string): Statement => parse(text).statements[0];

/** A value without its offsets. */
const plain = (value: Value | undefined): unknown => {
  if (!value) return undefined;
  if (value.kind !== "tuple") return value.value;
  return {
    positional: value.args.positional.map(plain),
    keywords: Object.fromEntries(value.args.keywords.map((k) => [k.key, plain(k.value) ?? true])),
  };
};
const args = (text: string) => plain({ kind: "tuple", args: first(text).args!, from: 0, to: 0 });

describe("parse", () => {
  it("reads the four kinds of head", () => {
    expect(
      heads('Kettle\nKettle -- Power\n"Hot water"\n@map\n@type regulator\n@area "Explore"'),
    ).toEqual([
      "Kettle",
      "Kettle -- Power",
      '"Hot water"',
      "@map",
      "@type regulator",
      "@area Explore",
    ]);
  });

  it("ends names at brackets, braces, links, comments, quotes and semicolons", () => {
    expect(heads('Node.js (beta) [1, 2]\nC#, F# {\n}\nA--B\nTea // hot\nA; B\nx"y"')).toEqual([
      "Node.js (beta)",
      "C#, F#",
      "A -- B",
      "Tea",
      "A",
      "B",
    ]);
    expect(problems('x"y"')).toEqual([
      { line: 1, message: "Expected a new line or ; to end the statement" },
    ]);
  });

  it("reads backtick names", () => {
    expect(heads("`C#--IL` [40, 60]\n`a[1]` -- `@home`")).toEqual(["C#--IL", "a[1] -- @home"]);
    expect(first("`C#--IL` [1, 2]").head).toMatchObject({ name: { from: 0, to: 8 } });
  });

  it("keeps each part's offsets", () => {
    const statement = first('Kettle [33, 50, inertia, label=("K", -4, 1)] // x');
    expect(statement).toMatchObject({
      from: 0,
      to: 44,
      line: 1,
      head: { name: { from: 0, to: 6 } },
    });
    expect(statement.args).toMatchObject({ from: 7, to: 44 });
    expect(statement.args!.positional.map(({ from, to }) => [from, to])).toEqual([
      [8, 10],
      [12, 14],
    ]);
    expect(statement.args!.keywords.map(({ key, from, to }) => [key, from, to])).toEqual([
      ["inertia", 16, 23],
      ["label", 25, 43],
    ]);
  });

  it("reads values: numbers, strings, symbols and tuples", () => {
    expect(
      args('A [33.5, -10, "£1.20", sourcing=build, inertia, label=("K", -40, 10, big)]'),
    ).toEqual({
      positional: [33.5, -10, "£1.20"],
      keywords: {
        sourcing: "build",
        inertia: true,
        label: { positional: ["K", -40, 10], keywords: { big: true } },
      },
    });
  });

  it("reads escapes in strings", () => {
    expect(
      plain(
        first('"a \\"b\\" \\\\ c\\nd"').head.kind === "note"
          ? (first('"a \\"b\\" \\\\ c\\nd"').head as any).text
          : undefined,
      ),
    ).toBe('a "b" \\ c\nd');
  });

  it("separates arguments with commas, spaces or new lines, and allows a trailing comma", () => {
    const expected = { positional: [33, 50], keywords: { inertia: true, evolve: 80 } };
    expect(args("A [33 50 inertia evolve = 80]")).toEqual(expected);
    expect(args("A [\n  33, 50, // here\n  inertia,\n  evolve=80,\n]")).toEqual(expected);
  });

  it("reads `//` in a string as text, not a comment", () => {
    expect(args('A [url="https://x.io/a"]')).toEqual({
      positional: [],
      keywords: { url: "https://x.io/a" },
    });
  });

  it("reads pipelines, with children on their own lines or after ;", () => {
    const [tea] = parse(
      "Tea [55, 73] {\n  Loose Leaf [55, 56]\n\n  Tea Bags [55, 90]\n}\nCup",
    ).statements;
    expect(tea.children!.map((s) => headText(s.head))).toEqual(["Loose Leaf", "Tea Bags"]);
    expect(tea.to).toBe(59);
    expect(first("Tea { A; B }").children!.map((s) => headText(s.head))).toEqual(["A", "B"]);
    expect(first("Tea {}").children).toEqual([]);
    expect(first("Tea").children).toBeUndefined();
  });

  it("reads Windows line endings", () => {
    expect(heads("A [1, 2]\r\nB\r\n")).toEqual(["A", "B"]);
    expect(problems("A [1, 2]\r\nB\r\n")).toEqual([]);
  });

  it("sets aside a statement with an error and keeps the rest", () => {
    const text = "Kettle [33, 50]\nPower [10, x=]\nWater [22, 91]";
    expect(heads(text)).toEqual(["Kettle", "Water"]);
    expect(parse(text).problems).toEqual([
      { from: 16, to: 30, line: 2, message: "Expected a value, not ]" },
    ]);
  });

  it("sets aside the whole of a statement across lines", () => {
    const text = "Kettle [\n  33, 50,\n  Sourcing=build,\n]\nPower";
    expect(heads(text)).toEqual(["Power"]);
    expect(problems(text)).toEqual([
      { line: 3, message: "Keys and symbols are lowercase words, such as inertia" },
    ]);
  });

  it("ends an unclosed [ before the next statement", () => {
    const text = "Kettle [33, 50\nPower [10, 86]\n  Water [1, 2";
    expect(heads(text)).toEqual(["Power"]);
    expect(problems(text).map((p) => p.line)).toEqual([1, 3]);
  });

  it("keeps a pipeline's children when its head has an error", () => {
    const text = "Tea [55, X] {\n  Loose Leaf\n}\nCup";
    expect(heads(text)).toEqual(["Loose Leaf", "Cup"]);
    expect(problems(text).map((p) => p.line)).toEqual([1]);
  });

  it("keeps an unclosed pipeline, and says where it opens", () => {
    const text = "Kettle [33, 50]\nTea [55, 73] {\n  Tea Bags [55, 90]\n";
    expect(heads(text)).toEqual(["Kettle", "Tea"]);
    expect(first("Tea {\n A").children).toHaveLength(1);
    expect(problems(text)).toEqual([
      { line: 2, message: "This { isn't closed: add a } after its last line" },
    ]);
  });

  it("reports a } with no {", () => {
    expect(heads("A\n}\nB")).toEqual(["A", "B"]);
    expect(problems("A\n}\nB")).toEqual([{ line: 2, message: "There's no { for this } to close" }]);
  });

  it.each([
    ["A [1, 2", "This [ isn't closed"],
    ["A [(1, 2]", "Expected a comma or )"],
    ["A [1, )]", 'Expected a number, "text" or a key, not )'],
    ["A [inertia, 3]", "Put values without a key first, before any key=value"],
    ["A [12a]", "Expected a comma or ]"],
    ['A [label="x]', "This string isn't closed: end it with \" on the same line"],
    ['A [label="\\q"]', 'Write \\" for a quote, \\\\ for a backslash or \\n for a new line'],
    ["A [x=Build]", "Keys and symbols are lowercase words, such as inertia"],
    ["A [x=", "Expected a value"],
    ["A [x=#]", "Expected a value, not #"],
    ["A -- @b", "A name can't start with @: put it in backticks"],
    ["A -- ", "Expected a name"],
    ["`A", "This ` isn't closed"],
    ["`  ` [1, 2]", "Expected a name between the backticks"],
    ["@ map", "Expected a word after @, such as @map"],
    ["A -- B -- C", "Expected a new line or ; to end the statement"],
  ])("reports %j", (text, message) => {
    expect(problems(text)).toEqual([{ line: 1, message }]);
  });

  it("skips strings, backtick names and comments when setting a statement aside", () => {
    const text = 'A [x=, label="]\n" // ]\n]\n`b[`] [y=]\nC';
    expect(heads(text)).toEqual(["C"]);
  });

  it("parses the example maps with no problems", () => {
    for (const file of [
      "ev-smart-charging.mt",
      "tea-shop.mt",
      "mapping-features.mt",
      "../docs/syntax/lots-of-components.mt",
    ]) {
      const text = readFileSync(`examples/${file}`, "utf8");
      expect(parse(text).problems, file).toEqual([]);
    }
  });
});

describe("parseMap", () => {
  it("reuses the last result for the same text", () => {
    const result = parseMap("Kettle [33, 50]");
    expect(parseMap("Kettle [33, 50]")).toBe(result);
    expect(parseMap("Power [10, 86]")).not.toBe(result);
  });
});

describe("lineStarts", () => {
  it("gives each line's offset", () => {
    expect(lineStarts("ab\n\ncd")).toEqual([0, 3, 4]);
  });
});
