import { writeName } from "../parser/names";
import { parseMap } from "../parser/parse";
import type { Statement, Value } from "../parser/syntax";
import { declarations, walk } from "../parser/walk";

export interface Change {
  from: number;
  to: number;
  insert: string;
}

/**
 * Sets a component's position, `[visibility, evolution]`, wherever it's
 * declared. Only the two numbers change, so someone typing elsewhere in the
 * statement isn't overwritten.
 */
export const coordinateChanges = (
  text: string,
  name: string,
  coordinates: readonly [string, string],
): Change[] =>
  declarations(parseMap(text).statements, name).flatMap((statement) =>
    positionChanges(statement, coordinates),
  );

function positionChanges(
  { head, args }: Statement,
  [visibility, evolution]: readonly [string, string],
) {
  const [v, e] = args?.positional ?? [];
  if (v && e) {
    return [
      { from: v.from, to: v.to, insert: visibility },
      { from: e.from, to: e.to, insert: evolution },
    ];
  }
  const position = `${visibility}, ${evolution}`;
  if (v) return [{ from: v.from, to: v.to, insert: position }];
  if (args) {
    const rest = args.keywords.length ? ", " : "";
    return [{ from: args.from + 1, to: args.from + 1, insert: position + rest }];
  }
  const end = head.kind === "component" ? head.name.to : 0;
  return [{ from: end, to: end, insert: ` [${position}]` }];
}

/** A component's new coordinates, `[visibility, evolution]`. */
export interface Placement {
  name: string;
  coordinates: readonly [string, string];
}

/** Sets the coordinates of several components, as one set of changes in document order. */
export const moveChanges = (text: string, placements: readonly Placement[]): Change[] =>
  placements
    .flatMap(({ name, coordinates }) => coordinateChanges(text, name, coordinates))
    .sort((a, b) => a.from - b.from);

/**
 * Renames a component where it's declared and at each end of a link that
 * names it, both ends of a link from the component to itself included.
 */
export const renameChanges = (text: string, oldName: string, newName: string): Change[] => {
  const insert = writeName(newName);
  return [...walk(parseMap(text).statements)]
    .flatMap(({ head }) => {
      if (head.kind === "component") return [head.name];
      return head.kind === "link" ? [head.from, head.to] : [];
    })
    .filter((name) => name.text === oldName)
    .map(({ from, to }) => ({ from, to, insert }));
};

/** `text` as a map string, in quotes. */
const quoted = (text: string) =>
  `"${text.replace(/[\\"\n]/g, (c) => (c === "\n" ? "\\n" : `\\${c}`))}"`;

/**
 * Places a component's label `x, y` px from it, wherever it's declared. Once
 * placed, only the two numbers change, so someone retyping the text while
 * another drags the label edit different characters.
 */
export const labelChanges = (text: string, name: string, [x, y]: readonly [string, string]) =>
  declarations(parseMap(text).statements, name).flatMap((statement) =>
    labelChangesIn(statement, name, x, y),
  );

function labelChangesIn({ head, args }: Statement, name: string, x: string, y: string): Change[] {
  const label = args?.keywords.find((k) => k.key === "label");
  if (!label) return newLabel(head, args, `label=(${quoted(name)}, ${x}, ${y})`);
  return label.value ? relabel(label.value, x, y) : [];
}

/** Places a label that has text, keeping the text. */
function relabel(value: Value, x: string, y: string): Change[] {
  if (value.kind === "string") {
    return [
      { from: value.from, to: value.from, insert: "(" },
      { from: value.to, to: value.to, insert: `, ${x}, ${y})` },
    ];
  }
  const [, dx, dy] = value.kind === "tuple" ? value.args.positional : [];
  if (dx?.kind !== "number" || dy?.kind !== "number") return [];
  return [
    { from: dx.from, to: dx.to, insert: x },
    { from: dy.from, to: dy.to, insert: y },
  ];
}

/** Adds `keyword` after a statement's last argument, or brackets for it. */
function newLabel(head: Statement["head"], args: Statement["args"], keyword: string): Change[] {
  if (!args) {
    const end = head.kind === "component" ? head.name.to : 0;
    return [{ from: end, to: end, insert: ` [${keyword}]` }];
  }
  const last = args.keywords.at(-1) ?? args.positional.at(-1);
  if (!last) return [{ from: args.from + 1, to: args.from + 1, insert: keyword }];
  return [{ from: last.to, to: last.to, insert: `, ${keyword}` }];
}
