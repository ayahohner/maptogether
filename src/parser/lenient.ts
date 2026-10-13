import { tryParse, type ParseProblem, type ParseResult } from "./TogetherParser";

/** The most lines set aside before the map stops drawing. Each one costs another parse. */
export const MAX_PROBLEMS = 50;

const isBlank = (line: string) => line.trim() === "";
const blank = (line: string) => " ".repeat(line.length);

/** Index of the line to set aside: the problem's, or the nearest non-blank one above. */
const lineToSetAside = (lines: string[], line: number) => {
  let i = Math.min(line, lines.length) - 1;
  while (i > 0 && isBlank(lines[i])) i--;
  return i;
};

/**
 * Parses map text, setting aside each line with an error and parsing again,
 * so one bad line doesn't stop the rest of the map from drawing. Set-aside
 * lines are blanked rather than removed, so line numbers stay put. Gives up
 * (no `cst`) after MAX_PROBLEMS problems.
 */
export function parseLeniently(text: string): ParseResult {
  const lines = text.split("\n");
  const problems: ParseProblem[] = [];
  for (;;) {
    const result = tryParse(lines.join("\n"));
    if (result.problems.length === 0) return { cst: result.cst, problems };
    if (problems.length >= MAX_PROBLEMS) return { cst: undefined, problems };
    for (const problem of result.problems) {
      const i = lineToSetAside(lines, problem.line);
      lines[i] = blank(lines[i]);
      problems.push({ ...problem, line: i + 1 });
    }
  }
}

let last: { text: string; result: ParseResult } | undefined;

/** parseLeniently, cached for the last text: the map and the linter both parse each change. */
export function parseMap(text: string): ParseResult {
  if (last?.text !== text) last = { text, result: parseLeniently(text) };
  return last.result;
}
