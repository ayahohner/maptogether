import { matchComponentRegex, matchEdgeBetweenRegex, matchEdgeRegex } from "../parser/TogetherParser";

export interface Deletion {
  /** Component names: each goes with its links (and a pipeline with its children). */
  components: readonly string[];
  /** Link keys, "needer->needed". */
  edges: readonly string[];
}

export interface Range {
  from: number;
  to: number;
}

/** A link's key ("A->B") as its two components. Names can't contain ">". */
export const edgeEnds = (key: string): [string, string] => {
  const i = key.indexOf("->");
  return [key.slice(0, i), key.slice(i + 2)];
};

const patterns = ({ components, edges }: Deletion) =>
  [
    ...components.flatMap((name) => [matchComponentRegex(name), matchEdgeRegex(name)]),
    ...edges.map((key) => matchEdgeBetweenRegex(...edgeEnds(key))),
  ].map((pattern) => new RegExp(pattern));

const count = (text: string, char: RegExp) => text.match(char)?.length ?? 0;

/** Braces a line leaves open, ignoring any comment. */
const opens = (line: string) => {
  const code = line.replace(/\/\/.*/, "");
  return count(code, /\{/g) - count(code, /\}/g);
};

/** Indexes of the lines to delete: matches, and the rest of any pipeline a match opens. */
function doomedLines(lines: readonly string[], deletion: Deletion) {
  const tests = patterns(deletion);
  const doomed = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (!tests.some((test) => test.test(lines[i]))) continue;
    let depth = 0;
    do {
      doomed.add(i);
      depth += opens(lines[i]);
    } while (depth > 0 && ++i < lines.length);
  }
  return doomed;
}

const lineStarts = (lines: readonly string[]) => {
  let offset = 0;
  return lines.map((line) => {
    const start = offset;
    offset += line.length + 1;
    return start;
  });
};

/** Whole-line ranges for the given lines, with neighbours merged. */
function lineRanges(starts: readonly number[], doomed: Set<number>, length: number) {
  const ranges: Range[] = [];
  for (const i of [...doomed].sort((x, y) => x - y)) {
    const to = starts[i + 1] ?? length;
    const last = ranges.at(-1);
    if (last?.to === starts[i]) last.to = to;
    else ranges.push({ from: starts[i], to });
  }
  return ranges;
}

/**
 * The text to remove to delete components and links: whole lines, so no
 * blank lines are left behind. Ranges don't overlap and are in order.
 */
export function deletionRanges(text: string, deletion: Deletion): Range[] {
  const lines = text.split("\n");
  const ranges = lineRanges(lineStarts(lines), doomedLines(lines, deletion), text.length);
  // A deletion at the very end takes the newline before it instead of after.
  const end = ranges.at(-1);
  if (end?.to === text.length && end.from > 0 && !text.endsWith("\n")) end.from--;
  return ranges;
}
