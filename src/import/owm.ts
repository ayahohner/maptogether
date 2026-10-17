/**
 * Converts OnlineWardleyMaps text to MapTogether's v2 syntax, as mapped in
 * docs/syntax/proposal-v2.md ("Importing from OnlineWardleyMaps"). It reads
 * line by line, as OnlineWardleyMaps' own parser does, so it takes what that
 * accepts rather than what a grammar would.
 *
 * OnlineWardleyMaps says things about a component on other lines (`evolve`,
 * `pipeline`, `build`); v2 says them on the component, so those lines are
 * folded into it. A line it can't carry over yet is kept as an `// owm:`
 * comment and reported, so nothing is lost.
 */
import type { ImportResult } from "./types";

const NUMBER = String.raw`-?\d*\.?\d+`;
const PAIR = String.raw`\[\s*(${NUMBER})\s*,\s*(${NUMBER})\s*\]`;

/** A component, as it will be written. */
interface Component {
  name: string;
  /** OnlineWardleyMaps' [visibility, maturity], 0–1; a pipeline's child has no visibility. */
  visibility?: string;
  maturity?: string;
  /** v2 keys, in the order written. */
  keys: Map<string, string>;
  children: Component[];
  /** A comment from the end of its line. */
  comment?: string;
}

/** One line's v2 text, or the component it declares, which is written once every line is read. */
type Out = string | Component;

interface Reader {
  components: Map<string, Component>;
  settings: string[];
  problems: ImportResult["problems"];
  /** The line being read, 1-based. */
  line: number;
}

export function importOwm(text: string): ImportResult {
  const reader: Reader = { components: new Map(), settings: [], problems: [], line: 0 };
  const out: Out[] = [];
  const lines = withoutBlockComments(text.split(/\r?\n/));
  for (let i = 0; i < lines.length; i++) {
    reader.line = i + 1;
    const block = pipelineBlock(lines, i);
    if (block) {
      out.push(...readPipelineBlock(reader, lines.slice(i, block.end + 1)));
      i = block.end;
    } else out.push(...readLine(reader, lines[i]));
  }
  const written = out.map((line) => (typeof line === "string" ? line : writeComponent(line)));
  const settings = reader.settings.length ? [`@map [${reader.settings.join(", ")}]`] : [];
  return { text: [...settings, ...written].join("\n"), problems: reader.problems };
}

/** `/* … *\/` comments as `//` on each line. */
function withoutBlockComments(lines: string[]) {
  let inside = false;
  return lines.map((line) => {
    const opens = !inside && /^\s*\/\*/.test(line);
    if (!inside && !opens) return line;
    inside = !line.includes("*/");
    const comment = line.replace(/^\s*\/\*+|\*+\/\s*$|^\s*\*(?!\/)/g, "").trim();
    return comment ? `// ${comment}` : "//";
  });
}

/** The code before a `//` comment, and the comment. A `//` in a URL isn't one. */
function splitComment(line: string) {
  const at = line.search(/(^|\s)\/\//);
  if (at === -1) return { code: line.trim(), comment: "" };
  return { code: line.slice(0, at).trim(), comment: line.slice(at).trim() };
}

/** Where a `pipeline X {` block, its brace perhaps on the next line, ends. */
function pipelineBlock(lines: string[], start: number) {
  const { code } = splitComment(lines[start]);
  if (!/^pipeline\s/.test(code)) return undefined;
  const braceOnNext = splitComment(lines[start + 1] ?? "").code === "{";
  if (!code.endsWith("{") && !braceOnNext) return undefined;
  const close = lines.findIndex((line, i) => i > start && splitComment(line).code === "}");
  return close === -1 ? undefined : { end: close };
}

/** Converters for each kind of line, tried in order. */
const LINES: [RegExp, (reader: Reader, match: RegExpExecArray, line: string) => Out[]][] = [
  [/^$/, () => [""]],
  [new RegExp(`^(component|anchor|market|ecosystem)\\s+(.+?)\\s*(?:${PAIR}(.*))?$`), component],
  [new RegExp(`^evolve\\s+(.+?)\\s+(${NUMBER})(\\s.*)?$`), evolve],
  [new RegExp(`^pipeline\\s+(.+?)\\s*(?:${PAIR})?$`), pipeline],
  [/^(build|buy|outsource)\s+(.+)$/, sourcing],
  [new RegExp(`^note\\s+(.+?)\\s*${PAIR}$`), note],
  [/^title\s+(.+)$/, (r, m) => setting(r, `title=${writeString(m[1])}`)],
  [/^style\s+(\w+)$/, (r, m) => setting(r, `style=${m[1]}`)],
  [/^evolution\s+(.+)$/, evolution],
  [/^valuechain\s+--hide$/, (r) => setting(r, "visibility=hidden")],
  [/^size\s*\[.*\]$/, () => []],
  [/^(annotations?|pioneers|settlers|townplanners|accelerator|deaccelerator|submap|url)\b/, later],
  [/^(.+?)\s*(\+(?:'([^']*)')?(?:<>|>|<)|->)\s*(.+?)(?:\s*;\s*(.*))?$/, link],
];

function readLine(reader: Reader, line: string): Out[] {
  const { code, comment } = splitComment(line);
  const indent = /^\s*/.exec(line)![0];
  for (const [pattern, convert] of LINES) {
    const match = pattern.exec(code);
    if (match) return withComment(convert(reader, match, code), indent, comment);
  }
  return [keep(reader, code, `Couldn't convert: ${code}`, comment)];
}

/** Puts a line's comment back after it, or on its own line if the line is folded into another. */
function withComment(out: Out[], indent: string, comment: string): Out[] {
  if (!comment) return out.map((line) => (typeof line === "string" && line ? indent + line : line));
  const last = out.at(-1);
  if (last === undefined) return [`${indent}${comment}`];
  if (typeof last !== "string") return [...out.slice(0, -1), { ...last, comment }];
  return [...out.slice(0, -1), `${indent}${last}${last ? " " : ""}${comment}`];
}

/** Keeps a line OnlineWardleyMaps can draw and v2 can't yet, as a comment. */
function keep(reader: Reader, code: string, message: string, comment = "") {
  reader.problems.push({ line: reader.line, message });
  return `// owm: ${code}${comment && ` ${comment}`}`;
}

function later(reader: Reader, match: RegExpExecArray, code: string): Out[] {
  return [keep(reader, code, `${match[1]} isn't drawn yet, so it's kept as a comment.`)];
}

const TYPES: Record<string, string> = { anchor: "user", market: "market", ecosystem: "ecosystem" };

/** `component Kettle [0.33, 0.5] label [-40, 10] inertia (build)`. */
function component(reader: Reader, match: RegExpExecArray): Out[] {
  const [, kind, rawName, visibility, maturity, rest] = match;
  const { name, label } = readName(rawName);
  const found: Component = { name, visibility, maturity, keys: new Map(), children: [] };
  if (TYPES[kind]) found.keys.set("type", TYPES[kind]);
  if (label) found.keys.set("label", writeString(label));
  decorate(reader, found, rest ?? "");
  if (!reader.components.has(name)) reader.components.set(name, found);
  return [found];
}

/** A quoted name keeps its line breaks in its label; the name itself has spaces. */
function readName(raw: string) {
  const quoted = /^"(.*)"$/.exec(raw);
  if (!quoted) return { name: raw };
  const label = quoted[1].replace(/\\n/g, "\n");
  return {
    name: label.replace(/\s+/g, " ").trim(),
    label: label.includes("\n") ? label : undefined,
  };
}

const DECORATION = new RegExp(`label\\s*${PAIR}|inertia|\\((\\w+)\\)|\\S+`, "g");

/** What follows a component's position: its label's place, inertia, sourcing and type. */
function decorate(reader: Reader, component: Component, rest: string) {
  for (const [token, x, y, word] of rest.matchAll(DECORATION)) {
    if (x !== undefined) placeLabel(component, x, y);
    else if (token === "inertia" || word === "inertia") component.keys.set("inertia", "");
    else if (word && /^(build|buy|outsource)$/.test(word)) component.keys.set("sourcing", word);
    else if (word && /^(market|ecosystem)$/.test(word)) component.keys.set("type", word);
    else
      reader.problems.push({
        line: reader.line,
        message: `Left out ${token} on ${component.name}`,
      });
  }
}

function placeLabel(component: Component, x: string, y: string) {
  const text = component.keys.get("label") ?? writeString(component.name);
  component.keys.set("label", `(${text}, ${x}, ${y})`);
}

/** `evolve Kettle->Smart Kettle 0.8 label [5, -10] (buy)`, folded into Kettle. */
function evolve(reader: Reader, match: RegExpExecArray, code: string): Out[] {
  const [, names, maturity, rest = ""] = match;
  const [name, renamed] = names.split(/\s*->\s*/);
  const target = reader.components.get(name);
  if (!target)
    return [keep(reader, code, `${name} isn't a component, so its evolve is kept as a comment.`)];
  const future = [percent(maturity)];
  if (renamed) future.push(`label=${writeString(renamed)}`);
  const sourced = /\((build|buy|outsource)\)/.exec(rest);
  if (sourced) future.push(`sourcing=${sourced[1]}`);
  if (/label\s*\[/.test(rest))
    reader.problems.push({
      line: reader.line,
      message: `Left out where ${name}'s future label sits`,
    });
  target.keys.set("evolve", future.length > 1 ? `(${future.join(", ")})` : future[0]);
  return [];
}

/** `pipeline Tea [0.15, 0.9]`, folded into Tea; without bounds, OnlineWardleyMaps doesn't draw it. */
function pipeline(reader: Reader, match: RegExpExecArray, code: string): Out[] {
  const [, name, from, to] = match;
  if (from === undefined) return [];
  const target = reader.components.get(name);
  if (!target)
    return [keep(reader, code, `${name} isn't a component, so its pipeline is kept as a comment.`)];
  target.keys.set("pipeline", `(${percent(from)}, ${percent(to)})`);
  return [];
}

/** `pipeline Tea { component Loose Leaf [0.56] … }`: the components go inside Tea. */
function readPipelineBlock(reader: Reader, lines: string[]): Out[] {
  const head = new RegExp(`^pipeline\\s+(.+?)\\s*(?:${PAIR})?\\s*\\{?$`).exec(
    splitComment(lines[0]).code,
  );
  const target = head && reader.components.get(head[1]);
  if (!head || !target) {
    const code = splitComment(lines[0]).code;
    return lines.map((line, i) =>
      i
        ? `// owm: ${line.trim()}`
        : keep(
            reader,
            code,
            `${head?.[1]} isn't a component, so its pipeline is kept as a comment.`,
          ),
    );
  }
  if (head[2] !== undefined)
    target.keys.set("pipeline", `(${percent(head[2])}, ${percent(head[3])})`);
  const child = new RegExp(`^component\\s+(.+?)\\s*\\[\\s*(${NUMBER})\\s*\\](\\s.*)?$`);
  for (const line of lines.slice(1, -1)) {
    const match = child.exec(splitComment(line).code);
    if (!match) continue;
    const { name } = readName(match[1]);
    const found: Component = { name, maturity: match[2], keys: new Map(), children: [] };
    decorate(reader, found, match[3] ?? "");
    target.children.push(found);
    reader.components.set(name, found);
  }
  return [];
}

/** `build Kettle` on its own line, folded into Kettle. */
function sourcing(reader: Reader, match: RegExpExecArray, code: string): Out[] {
  const target = reader.components.get(match[2]);
  if (!target)
    return [keep(reader, code, `${match[2]} isn't a component, so this is kept as a comment.`)];
  target.keys.set("sourcing", match[1]);
  return [];
}

function note(_reader: Reader, [, text, visibility, maturity]: RegExpExecArray): Out[] {
  return [`${writeString(text)} [${percent(visibility)}, ${percent(maturity)}]`];
}

function setting(reader: Reader, value: string): Out[] {
  reader.settings.push(value);
  return [];
}

/** `evolution A->B->->D`: four stage names, a blank one included. */
function evolution(reader: Reader, match: RegExpExecArray, code: string): Out[] {
  if (match[1] === "--hide") return setting(reader, "evolution=hidden");
  const names = match[1].split("->").map((name) => writeString(name.trim()));
  if (names.length !== 4) return [keep(reader, code, "evolution takes four stage names")];
  return setting(reader, `evolution=(${names.join(", ")})`);
}

/** `A->B`, `A->B; text`, and flows: `A+<>B`, `A+'£1'>B`. */
function link(_reader: Reader, [, from, arrow, flowLabel, to, context]: RegExpExecArray): Out[] {
  const flow = arrow.startsWith("+");
  const label = [flowLabel, context].filter(Boolean).join(" ");
  const keys = [...(flow ? ["flow"] : []), ...(label ? [`label=${writeString(label)}`] : [])];
  const head = `${writeName(from)} -- ${writeName(to)}`;
  return [keys.length ? `${head} [${keys.join(", ")}]` : head];
}

/** OnlineWardleyMaps' 0–1 as v2's 0–100. */
const percent = (value: string) => String(Number((Number(value) * 100).toFixed(2)));

const KEY_ORDER = ["type", "sourcing", "inertia", "evolve", "label", "pipeline"];

function writeComponent(component: Component, visibility?: string): string {
  const keys = KEY_ORDER.filter((key) => component.keys.has(key)).map((key) => {
    const value = component.keys.get(key);
    return value ? `${key}=${value}` : key;
  });
  const at = visibility ?? component.visibility;
  const position = at === undefined ? [] : [percent(at), percent(component.maturity ?? "0")];
  const args = [...position, ...keys];
  const line = `${writeName(component.name)}${args.length ? ` [${args.join(", ")}]` : ""}`;
  const comment = component.comment ? ` ${component.comment}` : "";
  if (!component.children.length) return line + comment;
  const children = component.children.map((child) => `  ${writeComponent(child, at)}`);
  return [`${line} {${comment}`, ...children, "}"].join("\n");
}

/** A v2 string literal. */
function writeString(text: string) {
  return `"${text.replace(/[\\"]/g, (c) => `\\${c}`).replace(/\n/g, "\\n")}"`;
}

/** A v2 name: as it is, or in backticks if v2 would read it differently. */
function writeName(name: string) {
  return /--|\/\/|[;"[\]{}`]|^@/.test(name) ? `\`${name.replace(/`/g, "'")}\`` : name;
}
