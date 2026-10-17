/**
 * Converts map text from MapTogether's v1 syntax to v2
 * (docs/syntax/proposal-v2.md). It reads v1 line by line, with no parser,
 * so it keeps working after v1's grammar is gone.
 *
 * v1 drew components, positions, pipelines and links; it parsed attributes,
 * commands and notes without drawing them. All of those carry over. A line
 * that can't be converted is kept as a `// v1:` comment and reported.
 */
import type { ImportResult } from "./types";

/** Indent, code and comment of one line, or of several joined by an unclosed "(". */
interface Line {
  /** 1-based number of the line it starts on. */
  number: number;
  indent: string;
  code: string;
  comment: string;
}

export function importV1(text: string): ImportResult {
  const problems: ImportResult["problems"] = [];
  const out = logicalLines(text).map((line) => {
    const converted = convertLine(line);
    if (converted === undefined) {
      problems.push({ line: line.number, message: `Couldn't convert: ${line.code}` });
      return `${line.indent}// v1: ${line.code}${line.comment && ` ${line.comment}`}`;
    }
    const comment = line.comment && (converted ? ` ${line.comment}` : line.comment);
    return `${line.indent}${converted}${comment}`;
  });
  return { text: out.join("\n"), problems };
}

/** Splits text into lines, joining a line that leaves "(" open with the ones that close it. */
function logicalLines(text: string): Line[] {
  const lines: Line[] = [];
  const physical = text.split(/\r?\n/);
  for (let i = 0; i < physical.length; i++) {
    const number = i + 1;
    let { code, comment } = splitComment(physical[i]);
    while (parensOpen(code) > 0 && i + 1 < physical.length) {
      const next = splitComment(physical[++i]);
      code = `${code} ${next.code.trim()}`;
      comment = [comment, next.comment].filter(Boolean).join(" ");
    }
    const indent = /^\s*/.exec(code)![0];
    lines.push({ number, indent, code: code.trim(), comment });
  }
  return lines;
}

/** The code before `//` and the comment from it. Quotes count only inside "( )", as in v1. */
function splitComment(line: string) {
  const state = { depth: 0, quote: "" };
  for (let i = 0; i < line.length; i++) {
    if (!state.quote && line.startsWith("//", i)) {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
    step(state, line[i]);
  }
  return { code: line, comment: "" };
}

const QUOTES = new Set(['"', "'"]);

function step(state: { depth: number; quote: string }, c: string) {
  if (state.quote) state.quote = c === state.quote ? "" : state.quote;
  else if (c === "(" || c === ")") state.depth += c === "(" ? 1 : -1;
  else if (state.depth > 0 && QUOTES.has(c)) state.quote = c;
}

function parensOpen(code: string) {
  return (code.match(/\(/g)?.length ?? 0) - (code.match(/\)/g)?.length ?? 0);
}

/** v1 identifier characters, less those that start other v1 tokens. */
const NAME = String.raw`[^.\[\](){}#:,=/^]+?`;
const NUMBER = String.raw`-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?`;
const POSITION = String.raw`\[\s*(${NUMBER})\s*,\s*(${NUMBER})\s*\]`;
const ATTRIBUTES = String.raw`\(([^)]*)\)`;

const COMPONENT = new RegExp(
  `^(${NAME})(?::(\\d+))?\\s*(?:${POSITION})?\\s*(?:${ATTRIBUTES})?\\s*(\\{)?$`,
);
const LINK = new RegExp(`^(${NAME})\\s*\\.\\s*(?:${ATTRIBUTES})?\\s*(${NAME})$`);
const NOTE = new RegExp(`^#\\s*(${NAME})\\s*(?:${POSITION})?$`);
const COMMAND = new RegExp(`^/mapstyle\\s*(?:${ATTRIBUTES})?$`);

/** The v2 code for one line: "" for a line with no code, undefined if it can't be converted. */
function convertLine({ code }: Line): string | undefined {
  if (code === "" || code === "}") return code;
  const converters = [convertCommand, convertNote, convertLink, convertComponent];
  for (const convert of converters) {
    const converted = convert(code);
    if (converted !== null) return converted;
  }
  return undefined;
}

/** null: not this kind of line. undefined: this kind, but it can't be converted. */
type Converted = string | undefined | null;

function convertComponent(code: string): Converted {
  const match = COMPONENT.exec(code);
  if (!match) return null;
  const [, rawName, definition, visibility, evolution, attributes, brace] = match;
  const base = rawName.trim();
  const name = definition ? `${base} ${definition}` : base;
  const args = [
    ...position(visibility, evolution),
    ...(definition ? [`label=${writeString(base)}`] : []),
    ...convertAttributes(attributes, { kind: "component", name }),
  ];
  return statement(writeName(name), args, brace);
}

function convertLink(code: string): Converted {
  const match = LINK.exec(code);
  if (!match) return null;
  const [, rawFrom, attributes, rawTo] = match;
  const [from, to] = [writeName(rawFrom.trim()), writeName(rawTo.trim())];
  const head = from && to ? `${from} -- ${to}` : undefined;
  return statement(head, convertAttributes(attributes, { kind: "link" }));
}

function convertNote(code: string): Converted {
  const match = NOTE.exec(code);
  if (!match) return null;
  const [, text, visibility, evolution] = match;
  return statement(writeString(text.trim()), position(visibility, evolution));
}

function convertCommand(code: string): Converted {
  if (!code.startsWith("/")) return null;
  const match = COMMAND.exec(code);
  if (!match) return undefined;
  return statement("@map", convertAttributes(match[1], { kind: "map" }));
}

const position = (visibility?: string, evolution?: string) =>
  visibility === undefined ? [] : [visibility, evolution as string];

/** A v2 statement, or undefined if its head or any argument couldn't be converted. */
function statement(head: string | undefined, args: string[], brace = "") {
  if (head === undefined || args.includes(UNCONVERTIBLE)) return undefined;
  const list = args.length ? `[${args.join(", ")}]` : "";
  return [head, list, brace].filter(Boolean).join(" ");
}

/** What the attributes are on, which changes what some of them mean. */
interface Context {
  kind: "component" | "link" | "map";
  /** The component's name. */
  name?: string;
}

const UNCONVERTIBLE = "\0";

const ATTRIBUTE = new RegExp(
  String.raw`\s*([A-Za-z_][\w-]*)(?:\s*=\s*("[^"]*"|'[^']*'|${NUMBER}(?:\s*,\s*${NUMBER})?|[\w-]+(?::${NUMBER})?(?:\s*,\s*[\w-]+(?::${NUMBER})?)*))?`,
  "y",
);

/** v1 attributes as v2 keyword arguments, with UNCONVERTIBLE for any that have no v2 form. */
function convertAttributes(source: string | undefined, context: Context): string[] {
  if (!source?.trim()) return [];
  const args: string[] = [];
  let end = 0;
  for (;;) {
    ATTRIBUTE.lastIndex = end;
    const match = ATTRIBUTE.exec(source);
    if (!match) break;
    end = ATTRIBUTE.lastIndex;
    args.push(convertAttribute(match[1], match[2], context) ?? UNCONVERTIBLE);
  }
  const rest = source.slice(end).trim();
  return rest ? [...args, UNCONVERTIBLE] : args;
}

const WORD = /^[a-z][a-z0-9]*$/;
const PAIR = new RegExp(`^(${NUMBER})\\s*,\\s*(${NUMBER})$`);

/** Attributes that mean something different in v2, by `kind key`. */
const SPECIAL: Record<string, (value: string, context: Context) => string | undefined> = {
  // a.(t=constraint)b
  "link t": (value) => (WORD.test(value) ? value : undefined),
  // (label=-40,10): an offset, which v2 writes with the text
  "component label": (value, { name }) => {
    const pair = PAIR.exec(value);
    return pair ? `label=(${writeString(name as string)}, ${pair[1]}, ${pair[2]})` : undefined;
  },
  "map evolutionlabels": evolutionLabels,
};

function convertAttribute(key: string, value: string | undefined, context: Context) {
  const special =
    value === undefined ? undefined : SPECIAL[`${context.kind} ${key}`]?.(value, context);
  if (special !== undefined) return special;
  if (!WORD.test(key)) return undefined;
  if (value === undefined) return key;
  const converted = convertValue(value);
  return converted === undefined ? undefined : `${key}=${converted}`;
}

function convertValue(value: string) {
  const quoted = /^"([^"]*)"$|^'([^']*)'$/.exec(value);
  if (quoted) return writeString(quoted[1] ?? quoted[2]);
  if (new RegExp(`^${NUMBER}$`).test(value)) return value;
  const pair = PAIR.exec(value);
  if (pair) return `(${pair[1]}, ${pair[2]})`;
  return WORD.test(value) ? value : undefined;
}

/** `genesis:10,emerging:25` to `evolution=("genesis", "emerging")`. v1 never drew the widths. */
function evolutionLabels(value: string) {
  const labels = value.split(",").map((part) => writeString(part.split(":")[0].trim()));
  return `evolution=(${labels.join(", ")})`;
}

/** A v2 string literal. v1 strings had no escapes, so every backslash is literal. */
function writeString(text: string) {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** A v2 name: as it is, or in backticks if v2 would read it differently. Undefined if it can't be written. */
function writeName(name: string) {
  if (!/--|\/\/|;|"|^@|`/.test(name)) return name;
  return name.includes("`") ? undefined : `\`${name}\``;
}
