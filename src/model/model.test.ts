import { describe, expect, it } from "vitest";

import { parse } from "../parser/parse";
import { buildModel } from "./model";

const build = (text: string) => buildModel(parse(text));
const lintMessages = (text: string) =>
  build(text).lints.map(({ message, severity }) => [severity, message]);

describe("buildModel", () => {
  it("reads components, with the default position for those without one", () => {
    const { model, lints } = build("Kettle [33, 50.5]\nPower\nOdd [1]");
    expect([...model.components.values()]).toMatchObject([
      { name: "Kettle", visibility: 33, evolution: 50.5, symbol: "component", label: "Kettle" },
      { name: "Power", visibility: 10, evolution: 10, inertia: false },
      { name: "Odd", visibility: 10, evolution: 10 },
    ]);
    expect(lints.map((l) => l.message)).toEqual([
      "A component's position is two numbers, [visibility, evolution], so this is ignored.",
    ]);
  });

  it("reads a component's keys", () => {
    const text = [
      "Kettle [33, 50, type=market, form=practice, sourcing=buy, inertia,",
      '  evolve=(80, label="Smart Kettle", sourcing=outsource), label=("Pot", -40, 10)]',
      'Cup [1, 2, evolve=70, label="Mug"]',
    ].join("\n");
    const { components } = build(text).model;
    expect(components.get("Kettle")).toMatchObject({
      symbol: "market",
      form: "practice",
      sourcing: "buy",
      inertia: true,
      evolve: { evolution: 80, label: "Smart Kettle", sourcing: "outsource" },
      label: "Pot",
      labelOffset: { x: -40, y: 10 },
    });
    expect(components.get("Cup")).toMatchObject({ evolve: { evolution: 70 }, label: "Mug" });
    expect(components.get("Cup")!.labelOffset).toBeUndefined();
  });

  it("draws an @type as the type it's based on", () => {
    const { model, lints } = build(
      "@type regulator [base=user, shape=hexagon]\n@type body\nA [type=regulator]\nB [type=body]",
    );
    expect(model.components.get("A")!.symbol).toBe("user");
    expect(model.components.get("B")!.symbol).toBe("component");
    expect(lints).toEqual([]);
  });

  it.each([
    ["A [colour=red]", "A component doesn't take colour, so it's ignored."],
    ["A [sourcing=bake]", "sourcing takes build, buy or outsource, so this is ignored."],
    ["A [inertia=1]", "inertia takes no value: write the key alone, so this is ignored."],
    ["A [inertia, inertia]", "inertia is given twice; the first one counts."],
    [
      "A [label=(1, 2)]",
      'label takes text in quotes, or ("text", x, y) to place it too, so this is ignored.',
    ],
    ["A [evolve=(80, colour=red)]", "A future doesn't take colour, so it's ignored."],
    [
      "A [evolve=(80, 90)]",
      "evolve takes an evolution, or (evolution, label=…, sourcing=…), so this is ignored.",
    ],
    [
      "A [pipeline=(1)]",
      "pipeline takes two numbers in brackets, such as (10, 90), so this is ignored.",
    ],
    [
      "A [type=robot]",
      "robot isn't a type: use component, user, market or ecosystem, or add it with @type robot.",
    ],
    [
      "A [1, 2, 3]",
      "A component's position is two numbers, [visibility, evolution], so this is ignored.",
    ],
    ["A [type=user] {\n  B\n}", "A user can't hold components, so these aren't drawn."],
    ["A\nB\nA -- B [1]", "A link takes only keys, such as flow, so this is ignored."],
  ])("lints %j", (text, message) => {
    expect(lintMessages(text)).toEqual([["warning", message]]);
  });

  it("draws neither a user's children nor a submap's on this map", () => {
    const { components } = build("A [type=user] {\n  B\n}\nC [type=submap] {\n  D\n}").model;
    expect([...components.keys()]).toEqual(["A", "C"]);
    expect(components.get("C")!.pipeline).toBeUndefined();
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
    expect(
      build('A -- B [flow, label="£1"]\nA\nB\n@map\n"note"\nB -- A [constraint]').model.links,
    ).toEqual([
      { ends: ["A", "B"], constraint: false, flow: true, label: "£1" },
      { ends: ["B", "A"], constraint: true, flow: false, label: undefined },
    ]);
  });

  it("warns about links to themselves and to undeclared components", () => {
    expect(lintMessages("A\nA -- A\nA -- Teapot")).toEqual([
      ["warning", "A component can't need itself, so the map leaves out this link."],
      ["warning", "Teapot isn't on the map, so this link isn't drawn until it is."],
    ]);
  });
});
