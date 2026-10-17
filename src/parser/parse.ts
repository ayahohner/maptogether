/**
 * Parses map text (docs/syntax/proposal-v2.md) into statements that keep
 * their offsets. A statement with an error is set aside whole, from its head
 * to the end of its arguments, and the rest of the map still parses.
 */
import type {
  Args,
  Head,
  Keyword,
  Name,
  NumberValue,
  ParseProblem,
  ParseResult,
  Statement,
  StringValue,
  Value,
} from "./syntax";

class ParseError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message);
  }
}

const BLANK = /(?:[ \t\r\n;]|\/\/[^\n]*)*/y;
const SPACES = /[ \t]*/y;
const SEPARATORS = /(?:[ \t\r\n,]|\/\/[^\n]*)*/y;
const WORD = /[a-z][a-z0-9]*/y;
const NUMBER = /-?\d+(?:\.\d+)?/y;
const NUMBER_START = /-?\d/y;
/** Where a name written without backticks ends. */
const NAME_END = /[[\]{};"\r\n]|--|\/\//g;
const NOT_A_NAME = /^(?:[[\]{};"\r\n@]|--|\/\/)/;
const LOWER = /[a-z]/;
const ARGUMENT_START = /[a-z0-9"(-]/;
const ESCAPES = new Map([
  ['"', '"'],
  ["\\", "\\"],
  ["n", "\n"],
]);
const CLOSES = new Set(["]", ")"]);
/** How each bracket changes the `[`/`(` depth and the `{` depth of a skipped statement. */
const NESTING: Record<string, [number, number]> = {
  "[": [1, 0],
  "(": [1, 0],
  "]": [-1, 0],
  ")": [-1, 0],
  "{": [0, 1],
  "}": [0, -1],
};

/** Where a set-aside statement ends, found by skipping over it. */
interface Skip {
  j: number;
  /** `[` and `(` open. */
  depth: number;
  /** `{` open. */
  braces: number;
  indent: number;
}

export function parse(text: string): ParseResult {
  return new Parser(text).document();
}

let last: { text: string; result: ParseResult } | undefined;

/** parse, cached for the last text: the map, the linter and the edits all parse each change. */
export function parseMap(text: string): ParseResult {
  if (last?.text !== text) last = { text, result: parse(text) };
  return last.result;
}

/** Each line's offset in the text. */
export const lineStarts = (text: string) => {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
  return starts;
};

class Parser {
  private i = 0;
  /** Indent of the line the statement being parsed starts on. */
  private indent = 0;
  private readonly problems: ParseProblem[] = [];
  private readonly starts: number[];

  constructor(private readonly text: string) {
    this.starts = lineStarts(text);
  }

  document(): ParseResult {
    const statements = this.statements(false);
    return { statements, problems: this.problems };
  }

  private statements(inBlock: boolean): Statement[] {
    const out: Statement[] = [];
    for (;;) {
      this.skip(BLANK);
      if (this.atEnd() || (inBlock && this.peek() === "}")) return out;
      if (this.peek() === "}") this.strayBrace();
      else out.push(...this.statement(inBlock));
    }
  }

  private statement(inBlock: boolean): Statement[] {
    const from = this.i;
    this.indent = this.indentOf(from);
    try {
      const head = this.head();
      const args = this.optionalArgs();
      const children = this.optionalBlock();
      const to = this.i;
      this.statementEnd(inBlock);
      return [{ from, to, head, args, children, line: this.lineOf(from) }];
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      return this.setAside(from, e);
    }
  }

  private statementEnd(inBlock: boolean) {
    this.skip(SPACES);
    if (this.text.startsWith("//", this.i) || this.atEnd()) return;
    const c = this.peek();
    if (c === "\n" || c === "\r" || c === ";" || (inBlock && c === "}")) return;
    throw new ParseError("Expected a new line or ; to end the statement", this.i);
  }

  private head(): Head {
    const c = this.peek();
    if (c === "@") return this.directive();
    if (c === '"') return { kind: "note", text: this.string() };
    const name = this.name();
    const end = this.i;
    this.skip(SPACES);
    if (!this.text.startsWith("--", this.i)) {
      this.i = end;
      return { kind: "component", name };
    }
    this.i += 2;
    this.skip(SPACES);
    return { kind: "link", from: name, to: this.name() };
  }

  private directive(): Head {
    this.i++;
    const word = this.word("Expected a word after @, such as @map");
    const end = this.i;
    this.skip(SPACES);
    if (this.peek() === '"') return { kind: "directive", word, subject: this.string() };
    if (this.startsName()) return { kind: "directive", word, subject: this.name() };
    this.i = end;
    return { kind: "directive", word };
  }

  private startsName() {
    return !this.atEnd() && !NOT_A_NAME.test(this.text.slice(this.i, this.i + 2));
  }

  private name(): Name {
    const from = this.i;
    if (this.peek() === "`") return this.backtickName();
    if (this.peek() === "@")
      throw new ParseError("A name can't start with @: put it in backticks", from);
    NAME_END.lastIndex = from;
    const end = NAME_END.exec(this.text)?.index ?? this.text.length;
    const text = this.text.slice(from, end).trimEnd();
    if (!text) throw new ParseError("Expected a name", from);
    this.i = from + text.length;
    return { from, to: this.i, text };
  }

  private backtickName(): Name {
    const from = this.i;
    const close = this.text.indexOf("`", from + 1);
    const text = this.text.slice(from + 1, close);
    if (close === -1 || text.includes("\n")) throw new ParseError("This ` isn't closed", from);
    if (!text.trim()) throw new ParseError("Expected a name between the backticks", from);
    this.i = close + 1;
    return { from, to: this.i, text };
  }

  private word(message: string): Name {
    const from = this.i;
    const match = this.match(WORD);
    if (!match) throw new ParseError(message, from);
    return { from, to: this.i, text: match };
  }

  private string(): StringValue {
    const from = this.i;
    let value = "";
    for (let j = from + 1; j < this.text.length && this.text[j] !== "\n"; j++) {
      const c = this.text[j];
      if (c === '"') {
        this.i = j + 1;
        return { kind: "string", value, from, to: this.i };
      }
      value += c === "\\" ? this.escape(j++) : c;
    }
    throw new ParseError("This string isn't closed: end it with \" on the same line", from);
  }

  private escape(at: number) {
    const escaped = ESCAPES.get(this.text[at + 1]);
    if (escaped === undefined) {
      throw new ParseError('Write \\" for a quote, \\\\ for a backslash or \\n for a new line', at);
    }
    return escaped;
  }

  private optionalArgs(): Args | undefined {
    const end = this.i;
    this.skip(SPACES);
    if (this.peek() === "[") return this.argList("]");
    this.i = end;
    return undefined;
  }

  private argList(close: string): Args {
    const from = this.i++;
    const args: Args = { positional: [], keywords: [], from, to: from };
    for (;;) {
      const start = this.i;
      this.skip(SEPARATORS);
      if (this.atEnd() || this.atNextStatement(start, close)) {
        throw new ParseError(`This ${this.text[from]} isn't closed`, from);
      }
      if (this.peek() === close) break;
      this.argument(args);
      this.expectSeparator(close);
    }
    args.to = ++this.i;
    return args;
  }

  /** Whether the list has run onto a new line that can only be the next statement. */
  private atNextStatement(start: number, close: string) {
    if (!this.text.slice(start, this.i).includes("\n")) return false;
    const c = this.peek();
    return c !== close && !ARGUMENT_START.test(c) && this.indentOf(this.i) <= this.indent;
  }

  private argument(args: Args) {
    if (LOWER.test(this.peek())) {
      args.keywords.push(this.keyword());
      return;
    }
    const value = this.value(false);
    if (args.keywords.length) {
      throw new ParseError("Put values without a key first, before any key=value", value.from);
    }
    args.positional.push(value);
  }

  private keyword(): Keyword {
    const key = this.word("Expected a key");
    const end = this.i;
    this.skip(SPACES);
    if (this.peek() !== "=") {
      this.i = end;
      return { key: key.text, from: key.from, to: key.to };
    }
    this.i++;
    this.skip(SPACES);
    const value = this.value(true);
    return { key: key.text, value, from: key.from, to: value.to };
  }

  private value(symbol: boolean): Value {
    const c = this.peek();
    if (c === '"') return this.string();
    if (c === "(") {
      const args = this.argList(")");
      return { kind: "tuple", args, from: args.from, to: args.to };
    }
    if (this.lookingAt(NUMBER_START)) return this.number();
    if (symbol && LOWER.test(c)) {
      const word = this.word("Expected a value");
      return { kind: "symbol", value: word.text, from: word.from, to: word.to };
    }
    throw new ParseError(unexpected(c, symbol), this.i);
  }

  private number(): NumberValue {
    const from = this.i;
    const value = Number(this.match(NUMBER));
    return { kind: "number", value, from, to: this.i };
  }

  private expectSeparator(close: string) {
    const c = this.peek();
    if (c === close || /^[ \t\r\n,]?$/.test(c) || this.text.startsWith("//", this.i)) return;
    throw new ParseError(`Expected a comma or ${close}`, this.i);
  }

  private optionalBlock(): Statement[] | undefined {
    const end = this.i;
    this.skip(SPACES);
    if (this.peek() !== "{") {
      this.i = end;
      return undefined;
    }
    const open = this.i++;
    const children = this.statements(true);
    if (this.peek() === "}") this.i++;
    else this.problem(open, open + 1, open, "This { isn't closed: add a } after its last line");
    return children;
  }

  private strayBrace() {
    this.problem(this.i, this.i + 1, this.i, "There's no { for this } to close");
    this.i++;
  }

  /** Skips a statement with an error. Statements in a block it opened are kept, outside it. */
  private setAside(from: number, error: ParseError): Statement[] {
    const skip = this.skipStatement(from);
    this.problem(from, skip.j, error.at, error.message);
    this.i = skip.j;
    if (skip.braces <= 0) return [];
    const kept = this.statements(true);
    if (this.peek() === "}") this.i++;
    return kept;
  }

  private skipStatement(from: number): Skip {
    const skip = { j: from, depth: 0, braces: 0, indent: this.indentOf(from) };
    while (skip.j < this.text.length && !this.endsHere(skip)) skip.j = this.skipOne(skip);
    return skip;
  }

  /**
   * Whether a set-aside statement ends at `skip.j`: at a new line once its
   * brackets close, or before a line that looks like the next statement if
   * they never do.
   */
  private endsHere({ j, depth, braces, indent }: Skip) {
    const c = this.text[j];
    if (c === "\n") return depth === 0 || this.nextLineStartsStatement(j, indent);
    if (c === "}") return braces === 0;
    return c === ";" && depth === 0;
  }

  /** Moves past one character, or a whole string, backtick name or comment, counting brackets. */
  private skipOne(skip: Skip) {
    const c = this.text[skip.j];
    if (c === '"' || c === "`") return this.quotedEnd(skip.j, c);
    if (this.text.startsWith("//", skip.j)) return this.lineEnd(skip.j);
    const [depth, braces] = NESTING[c] ?? [0, 0];
    skip.depth = Math.max(0, skip.depth + depth);
    skip.braces += braces;
    return skip.j + 1;
  }

  private quotedEnd(from: number, quote: string) {
    const end = this.lineEnd(from);
    for (let j = from + 1; j < end; j++) {
      if (this.text[j] === quote) return j + 1;
      if (this.text[j] === "\\") j++;
    }
    return end;
  }

  private nextLineStartsStatement(newline: number, indent: number) {
    const line = this.text.slice(newline + 1, this.lineEnd(newline + 1));
    const content = line.trimStart();
    if (!content || content.startsWith("//") || CLOSES.has(content[0])) return false;
    return line.length - content.length <= indent;
  }

  private indentOf(offset: number) {
    const start = this.starts[this.lineOf(offset) - 1];
    return /^[ \t]*/.exec(this.text.slice(start))![0].length;
  }

  private lineEnd(from: number) {
    const end = this.text.indexOf("\n", from);
    return end === -1 ? this.text.length : end;
  }

  private problem(from: number, to: number, at: number, message: string) {
    this.problems.push({ from, to, line: this.lineOf(at), message });
  }

  /** 1-based line of an offset. */
  private lineOf(offset: number) {
    let [lo, hi] = [0, this.starts.length - 1];
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  private peek() {
    return this.text[this.i] ?? "";
  }

  private atEnd() {
    return this.i >= this.text.length;
  }

  private skip(regex: RegExp) {
    this.match(regex);
  }

  private lookingAt(regex: RegExp) {
    regex.lastIndex = this.i;
    return regex.test(this.text);
  }

  /** Matches a sticky regex here and moves past it; "" if it doesn't match. */
  private match(regex: RegExp) {
    regex.lastIndex = this.i;
    const match = regex.exec(this.text);
    if (match) this.i = regex.lastIndex;
    return match?.[0] ?? "";
  }
}

/** Why a value can't start with `c`. */
function unexpected(c: string, symbol: boolean) {
  if (/[A-Z]/.test(c)) return "Keys and symbols are lowercase words, such as inertia";
  if (c === "") return "Expected a value";
  return symbol ? `Expected a value, not ${c}` : `Expected a number, "text" or a key, not ${c}`;
}
