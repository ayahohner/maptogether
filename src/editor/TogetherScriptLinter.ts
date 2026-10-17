import type { Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";

import { buildModel } from "../model/model";
import { parseMap } from "../parser/parse";

/**
 * Marks what the map leaves out: errors over statements that don't parse,
 * and the model's lints, such as warnings for links it can't draw.
 */
export const mapDiagnostics = (text: string): Diagnostic[] => {
  const parsed = parseMap(text);
  const problems = parsed.problems.map(({ from, to, message }) => ({
    from,
    to,
    message,
    severity: "error" as const,
  }));
  return [...problems, ...buildModel(parsed).lints];
};

export const togetherScriptLinter = () => (view: EditorView) =>
  mapDiagnostics(view.state.doc.toString());
