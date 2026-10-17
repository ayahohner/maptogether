import { describe, expect, it } from "vitest";

import {
  type Change,
  coordinateChanges,
  labelChanges,
  moveChanges,
  noteTextChanges,
  renameChanges,
} from "./edits";

const apply = (text: string, changes: Change[]) =>
  [...changes].reverse().reduce((t, c) => t.slice(0, c.from) + c.insert + t.slice(c.to), text);

const move = (text: string, name: string, to: [string, string]) =>
  apply(text, coordinateChanges(text, name, to));

describe("coordinateChanges", () => {
  it("replaces only the two numbers, keeping the keywords and what follows", () => {
    const text = 'Kettle [33, 50, inertia, label=("K", 1, 2)] // boils\nPower [10, 86]';
    const changes = coordinateChanges(text, "Kettle", ["40.5", "60"]);
    expect(changes).toEqual([
      { from: 8, to: 10, insert: "40.5" },
      { from: 12, to: 14, insert: "60" },
    ]);
    expect(apply(text, changes)).toBe(
      'Kettle [40.5, 60, inertia, label=("K", 1, 2)] // boils\nPower [10, 86]',
    );
  });

  it("adds a position to a component that has none", () => {
    expect(move("Power\nKettle -- Power", "Power", ["1", "2"])).toBe(
      "Power [1, 2]\nKettle -- Power",
    );
    expect(move("Tea {\n}", "Tea", ["1", "2"])).toBe("Tea [1, 2] {\n}");
    expect(move("Kettle [inertia]", "Kettle", ["1", "2"])).toBe("Kettle [1, 2, inertia]");
    expect(move("Kettle []", "Kettle", ["1", "2"])).toBe("Kettle [1, 2]");
    expect(move("Kettle [5]", "Kettle", ["1", "2"])).toBe("Kettle [1, 2]");
  });

  it("moves a component in a pipeline, and one in backticks", () => {
    const text = "Tea [55, 73] {\n  Loose Leaf [55, 56]\n}\n`C#--IL` [1, 1]";
    expect(move(text, "Loose Leaf", ["55", "60"])).toBe(
      "Tea [55, 73] {\n  Loose Leaf [55, 60]\n}\n`C#--IL` [1, 1]",
    );
    expect(move(text, "C#--IL", ["2", "3"])).toBe(
      "Tea [55, 73] {\n  Loose Leaf [55, 56]\n}\n`C#--IL` [2, 3]",
    );
  });

  it("changes nothing when the component isn't in the text", () => {
    expect(coordinateChanges("Kettle [33, 50]\nKettle -- Power", "Power", ["1", "2"])).toEqual([]);
  });
});

describe("moveChanges", () => {
  it("moves several components in one set of changes, in document order", () => {
    const text = "Power [10, 86]\nKettle [33, 50]\nKettle -- Power";
    const changes = moveChanges(text, [
      { name: "Kettle", coordinates: ["40", "60"] },
      { name: "Power", coordinates: ["1", "2"] },
    ]);
    expect(changes.map((c) => c.from)).toEqual([7, 11, 23, 27]);
    expect(apply(text, changes)).toBe("Power [1, 2]\nKettle [40, 60]\nKettle -- Power");
  });
});

describe("renameChanges", () => {
  it("renames both ends of a link from the component to itself", () => {
    const text = "A\nA -- A";
    expect(apply(text, renameChanges(text, "A", "B"))).toBe("B\nB -- B");
  });

  it("renames the declaration and both sides of its links", () => {
    const text = "Kettle [33, 50]\nKettle--Power\nHot Water -- Kettle [constraint] // heats";
    expect(apply(text, renameChanges(text, "Kettle", "Urn"))).toBe(
      "Urn [33, 50]\nUrn--Power\nHot Water -- Urn [constraint] // heats",
    );
  });

  it("renames a component in a pipeline", () => {
    const text = "Tea {\n  Loose Leaf [55, 56]\n}";
    expect(apply(text, renameChanges(text, "Loose Leaf", "Leaf"))).toBe(
      "Tea {\n  Leaf [55, 56]\n}",
    );
  });

  it("writes backticks when the new name needs them, and drops them when it doesn't", () => {
    const text = "`a;b` [1, 2]\nX -- `a;b`";
    expect(apply(text, renameChanges(text, "a;b", "C--D"))).toBe("`C--D` [1, 2]\nX -- `C--D`");
    expect(apply(text, renameChanges(text, "a;b", "ab"))).toBe("ab [1, 2]\nX -- ab");
  });

  it("leaves components whose names only start the same way, and notes", () => {
    expect(
      renameChanges('Cup of Tea [1, 2]\nCup of Tea -- Tea\n"Cup"\n@map', "Cup", "Mug"),
    ).toEqual([]);
  });
});

describe("labelChanges", () => {
  const place = (text: string, name: string) =>
    apply(text, labelChanges(text, name, ["-40", "12"]));

  it("writes the label's place, copying the name in, the first time it's dragged", () => {
    expect(place("Kettle [33, 50]", "Kettle")).toBe('Kettle [33, 50, label=("Kettle", -40, 12)]');
    expect(place("Kettle [33, 50, inertia] // boils", "Kettle")).toBe(
      'Kettle [33, 50, inertia, label=("Kettle", -40, 12)] // boils',
    );
    expect(place("Kettle", "Kettle")).toBe('Kettle [label=("Kettle", -40, 12)]');
    expect(place("Kettle []", "Kettle")).toBe('Kettle [label=("Kettle", -40, 12)]');
    expect(place('`Say "hi"` [1, 2]', 'Say "hi"')).toBe(
      '`Say "hi"` [1, 2, label=("Say \\"hi\\"", -40, 12)]',
    );
  });

  it("keeps a label's text, and after the first drag changes only the numbers", () => {
    expect(place('Kettle [33, 50, label="Pot", inertia]', "Kettle")).toBe(
      'Kettle [33, 50, label=("Pot", -40, 12), inertia]',
    );
    const placed = 'Kettle [33, 50, label=("Pot", 1, 2)]';
    expect(labelChanges(placed, "Kettle", ["-40", "12"])).toEqual([
      { from: 30, to: 31, insert: "-40" },
      { from: 33, to: 34, insert: "12" },
    ]);
  });

  it("leaves a label it can't read, and components that aren't declared", () => {
    expect(labelChanges("Kettle [label=(1, 2)]", "Kettle", ["1", "2"])).toEqual([]);
    expect(labelChanges("Kettle [label=red]", "Kettle", ["1", "2"])).toEqual([]);
    expect(labelChanges("Kettle -- Power", "Power", ["1", "2"])).toEqual([]);
  });
});

describe("notes", () => {
  const text = '"Hot water" [1, 2]\nKettle\n"Cold"';

  it("moves a note by its key, giving it a position if it has none", () => {
    expect(move(text, '"note 1"', ["5", "6"])).toBe('"Hot water" [5, 6]\nKettle\n"Cold"');
    expect(move(text, '"note 2"', ["5", "6"])).toBe('"Hot water" [1, 2]\nKettle\n"Cold" [5, 6]');
  });

  it("rewrites a note's text, escaping its quotes", () => {
    expect(apply(text, noteTextChanges(text, '"note 2"', 'Say "hi"'))).toBe(
      '"Hot water" [1, 2]\nKettle\n"Say \\"hi\\""',
    );
  });
});
