import { matchComponentRegex, matchEdgeRegex } from "../parser/TogetherParser";
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
    return { from: at, to: at + head.length + old.length, insert: `${head}[${visibility}, ${evolution}]` };
  });

/** Offset of the component name in a link line, on whichever side it is. */
function nameInLink(match: RegExpExecArray) {
  // Groups 1–2 match the name on the left of the ".", groups 5–9 on the right.
  if (match[2] !== undefined) return joined([match[1]]).length;
  return joined([match[5], match[6], match[8]]).length;
}

/** Renames a component where it is declared and in each link to or from it. */
export const renameChanges = (text: string, oldName: string, newName: string): Change[] => {
  const rename = (from: number) => ({ from, to: from + oldName.length, insert: newName });
  return [
    ...lineMatches(text, matchComponentRegex(oldName)).map(({ at, match }) =>
      rename(at + joined([match[1]]).length),
    ),
    ...lineMatches(text, matchEdgeRegex(oldName)).map(({ at, match }) =>
      rename(at + nameInLink(match)),
    ),
  ].sort((a, b) => a.from - b.from);
};
