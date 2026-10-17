import { writeName } from "../parser/names";
import { parseMap } from "../parser/parse";
import type { Statement } from "../parser/syntax";
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
