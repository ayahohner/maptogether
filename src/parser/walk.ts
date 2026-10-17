import type { Statement } from "./syntax";

/** Every statement, those in blocks included, in the order written. */
export function* walk(statements: readonly Statement[]): Generator<Statement> {
  for (const statement of statements) {
    yield statement;
    if (statement.children) yield* walk(statement.children);
  }
}

/**
 * A note's key on the canvas, from its place among the map's notes. It's in
 * quotes, which a name can't use, so it never matches a component.
 */
export const noteKey = (index: number) => `"note ${index + 1}"`;

export const isNoteKey = (key: string) => key.startsWith('"');

/** The map's notes, in the order written. Notes in braces aren't drawn, so aren't counted. */
export const notes = (statements: readonly Statement[]) =>
  statements.filter((statement) => statement.head.kind === "note");

/** The statements that declare the component `name`, or the note whose key it is. */
export const declarations = (statements: readonly Statement[], name: string) =>
  isNoteKey(name)
    ? notes(statements).filter((_note, i) => noteKey(i) === name)
    : [...walk(statements)].filter(
        (statement) => statement.head.kind === "component" && statement.head.name.text === name,
      );
