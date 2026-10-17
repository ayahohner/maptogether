/**
 * What the parser reads map text into (docs/syntax/proposal-v2.md). Every
 * statement has the same shape, `head [arguments] { children }`, and every
 * part keeps its place in the text, so edits can replace exact ranges.
 */

/** Offsets into the text: `from` inclusive, `to` exclusive. */
export interface Span {
  from: number;
  to: number;
}

export interface NumberValue extends Span {
  kind: "number";
  value: number;
}

export interface StringValue extends Span {
  kind: "string";
  /** The text, with escapes read. */
  value: string;
}

/** A bare word after `=`, as in `sourcing=build`. */
export interface SymbolValue extends Span {
  kind: "symbol";
  value: string;
}

/** `( … )`: an argument list used as a value. */
export interface TupleValue extends Span {
  kind: "tuple";
  args: Args;
}

export type Value = NumberValue | StringValue | SymbolValue | TupleValue;

/** `key=value`, or a boolean keyword (`inertia`) with no value. */
export interface Keyword extends Span {
  key: string;
  value?: Value;
}

/** `[ … ]` or `( … )`, brackets included in the span. */
export interface Args extends Span {
  positional: Value[];
  keywords: Keyword[];
}

/** A component's name. A backtick name's span includes the backticks. */
export interface Name extends Span {
  text: string;
}

export type Head =
  | { kind: "component"; name: Name }
  | { kind: "link"; from: Name; to: Name }
  | { kind: "note"; text: StringValue }
  | { kind: "directive"; word: Name; subject?: Name | StringValue };

export interface Statement extends Span {
  head: Head;
  args?: Args;
  /** The statements in `{ }`, if it has a block. */
  children?: Statement[];
  /** 1-based line the statement starts on. */
  line: number;
}

/** Text the parser set aside: a statement, or a stray `}`. */
export interface ParseProblem extends Span {
  /** 1-based line of the error itself. */
  line: number;
  message: string;
}

export interface ParseResult {
  statements: Statement[];
  problems: ParseProblem[];
}
