import type { Statement } from "./syntax";

/** Every statement, those in blocks included, in the order written. */
export function* walk(statements: readonly Statement[]): Generator<Statement> {
  for (const statement of statements) {
    yield statement;
    if (statement.children) yield* walk(statement.children);
  }
}

/** The statements that declare the component `name`. */
export const declarations = (statements: readonly Statement[], name: string) =>
  [...walk(statements)].filter(
    (statement) => statement.head.kind === "component" && statement.head.name.text === name,
  );
