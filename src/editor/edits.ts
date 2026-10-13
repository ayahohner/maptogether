import {
  matchComponentRegex,
  matchEdgeFromRegex,
  matchEdgeToRegex,
} from "../parser/TogetherParser";
import { lineStarts } from "./deletions";

export interface Change {
  from: number;
  to: number;
  insert: string;
}

/** Every line that `pattern` matches, with the offset of the line in `text`. */
function lineMatches(text: string, pattern: string) {
  const regex = new RegExp(pattern);
  const lines = text.split("\n");
  const starts = lineStarts(lines);
  return lines.flatMap((line, i) => {
    const match = regex.exec(line);
    return match ? [{ at: starts[i], match }] : [];
  });
}

const joined = (parts: (string | undefined)[]) => parts.map((part) => part ?? "").join("");

/**
 * Sets a component's coordinates, `[visibility, evolution]`, on each line
 * that declares it, replacing any it had.
 */
export const coordinateChanges = (
  text: string,
  name: string,
  [visibility, evolution]: readonly [string, string],
): Change[] =>
  lineMatches(text, matchComponentRegex(name)).map(({ at, match }) => {
    // Indent, name, definition specifier and the space before the coordinates.
    const head = joined(match.slice(1, 5));
    const old = match[5] ?? "";
    return {
      from: at,
      to: at + head.length + old.length,
      insert: `${head}[${visibility}, ${evolution}]`,
    };
  });

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
 * Renames a component where it is declared and at each end of a link that
 * names it, both ends of a link from the component to itself included.
 */
export const renameChanges = (text: string, oldName: string, newName: string): Change[] => {
  const rename = (from: number) => ({ from, to: from + oldName.length, insert: newName });
  return [
    ...lineMatches(text, matchComponentRegex(oldName)).map(({ at, match }) =>
      rename(at + joined([match[1]]).length),
    ),
    ...lineMatches(text, matchEdgeFromRegex(oldName)).map(({ at, match }) =>
      rename(at + joined([match[1]]).length),
    ),
    // Group 3, the label, is inside group 2.
    ...lineMatches(text, matchEdgeToRegex(oldName)).map(({ at, match }) =>
      rename(at + joined([match[1], match[2], match[4]]).length),
    ),
  ].sort((a, b) => a.from - b.from);
};
