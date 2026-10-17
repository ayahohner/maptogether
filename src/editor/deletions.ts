import { parseMap } from "../parser/parse";
import type { Span, Statement } from "../parser/syntax";
import { walk } from "../parser/walk";

export interface Deletion {
  /** Component names: each goes with its links (and a pipeline with its children). */
  components: readonly string[];
  /** Links as `[needer, needed]`; a link written the other way round goes too. */
  edges: readonly (readonly [string, string])[];
}

export type Range = Span;

/** The statements a deletion removes. A pipeline's children go with it, in its range. */
function doomedStatements(statements: readonly Statement[], { components, edges }: Deletion) {
  const names = new Set(components);
  const links = new Set(edges.flatMap(([a, b]) => [`${a}\n${b}`, `${b}\n${a}`]));
  return [...walk(statements)].filter(({ head }) => {
    if (head.kind === "component") return names.has(head.name.text);
    if (head.kind !== "link") return false;
    const [a, b] = [head.from.text, head.to.text];
    return names.has(a) || names.has(b) || links.has(`${a}\n${b}`);
  });
}

const ONLY_A_COMMENT = /^[ \t]*(?:\/\/[^\n]*)?\n?$/;

/**
 * The text to remove for one statement: its whole lines when it has them to
 * itself, or else the statement and a `;` beside it.
 */
function statementRange(text: string, { from, to }: Span): Range {
  const lineFrom = text.lastIndexOf("\n", from - 1) + 1;
  const newline = text.indexOf("\n", to);
  const lineTo = newline === -1 ? text.length : newline + 1;
  const [before, after] = [text.slice(lineFrom, from), text.slice(to, lineTo)];
  if (!before.trim() && ONLY_A_COMMENT.test(after)) return { from: lineFrom, to: lineTo };
  const semicolonAfter = /^[ \t]*;[ \t]*/.exec(after)?.[0].length;
  if (semicolonAfter) return { from, to: to + semicolonAfter };
  const semicolonBefore = /[ \t]*;[ \t]*$/.exec(before)?.[0].length ?? 0;
  return { from: from - semicolonBefore, to };
}

/** Ranges in order, with overlapping and touching ones merged. */
function merged(ranges: Range[]) {
  const out: Range[] = [];
  for (const range of [...ranges].sort((a, b) => a.from - b.from)) {
    const last = out.at(-1);
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else out.push({ ...range });
  }
  return out;
}

/**
 * The text to remove to delete components and links: whole lines where it
 * can, so no blank lines are left behind. Ranges don't overlap and are in order.
 */
export function deletionRanges(text: string, deletion: Deletion): Range[] {
  const doomed = doomedStatements(parseMap(text).statements, deletion);
  const ranges = merged(doomed.map((statement) => statementRange(text, statement)));
  // A deletion at the very end takes the newline before it instead of after.
  const end = ranges.at(-1);
  if (
    end?.to === text.length &&
    end.from > 0 &&
    text[end.from - 1] === "\n" &&
    !text.endsWith("\n")
  ) {
    end.from--;
  }
  return ranges;
}
