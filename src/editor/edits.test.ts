import { describe, expect, it } from "vitest";

import { type Change, coordinateChanges, renameChanges } from "./edits";

const apply = (text: string, changes: Change[]) =>
  [...changes].reverse().reduce((t, c) => t.slice(0, c.from) + c.insert + t.slice(c.to), text);

describe("coordinateChanges", () => {
  it("replaces existing coordinates and keeps what follows", () => {
    const text = "Kettle [33, 50] (inertia) // boils\nPower [10, 86]";
    expect(apply(text, coordinateChanges(text, "Kettle", ["40.0", "60.0"]))).toBe(
      "Kettle [40.0, 60.0] (inertia) // boils\nPower [10, 86]",
    );
  });

  it("adds coordinates to a component that had none", () => {
    const text = "Power\nKettle.Power";
    expect(apply(text, coordinateChanges(text, "Power", ["1", "2"]))).toBe(
      "Power[1, 2]\nKettle.Power",
    );
  });

  it("keeps the indent of a pipeline component", () => {
    const text = "Tea [55, 73] {\n  Loose Leaf [55, 56]\n}";
    expect(apply(text, coordinateChanges(text, "Loose Leaf", ["55", "60"]))).toBe(
      "Tea [55, 73] {\n  Loose Leaf [55, 60]\n}",
    );
  });

  it("changes nothing when the component isn't in the text", () => {
    expect(coordinateChanges("Kettle [33, 50]", "Power", ["1", "2"])).toEqual([]);
  });
});

describe("renameChanges", () => {
  it("renames the declaration and both sides of its links", () => {
    const text = "Kettle [33, 50]\nKettle.Power\nHot Water.Kettle // heats";
    expect(apply(text, renameChanges(text, "Kettle", "Urn"))).toBe(
      "Urn [33, 50]\nUrn.Power\nHot Water.Urn // heats",
    );
  });

  it("renames an indented pipeline component without touching the indent", () => {
    const text = "Tea {\n  Loose Leaf [55, 56]\n}";
    expect(apply(text, renameChanges(text, "Loose Leaf", "Leaf"))).toBe(
      "Tea {\n  Leaf [55, 56]\n}",
    );
  });

  it("renames inside links that carry attributes", () => {
    const text = "Cup.(dashed) Tea";
    expect(apply(text, renameChanges(text, "Tea", "Chai"))).toBe("Cup.(dashed) Chai");
  });

  it("leaves components whose names only start the same way", () => {
    expect(renameChanges("Cup of Tea [1, 2]\nCup of Tea.Tea", "Cup", "Mug")).toEqual([]);
  });
});
