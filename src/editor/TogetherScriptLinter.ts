import type { Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { parseMap } from "../parser/lenient";
import type { ParseProblem } from "../parser/TogetherParser";

/** One error per problem, covering its whole line. */
export const toDiagnostics = (doc: Text, problems: readonly ParseProblem[]): Diagnostic[] =>
  problems.map(({ line, message }) => {
    const { from, to } = doc.line(Math.min(line, doc.lines));
    return { from, to, message, severity: "error" };
  });

/** Marks the lines the map leaves out because they don't parse. */
export const togetherScriptLinter = () => (view: EditorView) =>
  toDiagnostics(view.state.doc, parseMap(view.state.doc.toString()).problems);
