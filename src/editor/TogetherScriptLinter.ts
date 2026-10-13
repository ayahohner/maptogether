import type { Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { parseMap } from "../parser/lenient";
import type { DefaultCstNode } from "../parser/TogetherCst";
import type { ParseProblem } from "../parser/TogetherParser";

const SELF_LINK = "A component can't need itself, so the map leaves out this link.";

/** A diagnostic covering the whole of a line (or the last line, past the end). */
const onLine = (doc: Text, line: number, message: string, severity: Diagnostic["severity"]) => {
  const { from, to } = doc.line(Math.min(line, doc.lines));
  return { from, to, message, severity };
};

/** One error per problem, covering its whole line. */
export const toDiagnostics = (doc: Text, problems: readonly ParseProblem[]): Diagnostic[] =>
  problems.map(({ line, message }) => onLine(doc, line, message, "error"));

/** The lines of links from a component to itself, which a find-and-replace can leave. */
export const selfLinkLines = (cst: DefaultCstNode): number[] =>
  (cst.children.statement ?? []).flatMap((statement) => {
    const [link] = statement.children.edgeDeclaration ?? [];
    if (!link) return [];
    const [lhs] = link.children.LHS;
    const [rhs] = link.children.RHS;
    return lhs.image === rhs.image ? [lhs.startLine ?? 1] : [];
  });

/** Marks the lines the map leaves out: errors where they don't parse, warnings for self-links. */
export const togetherScriptLinter = () => (view: EditorView) => {
  const { doc } = view.state;
  const { cst, problems } = parseMap(doc.toString());
  const selfLinks = cst ? selfLinkLines(cst) : [];
  return [
    ...toDiagnostics(doc, problems),
    ...selfLinks.map((line) => onLine(doc, line, SELF_LINK, "warning")),
  ];
};
