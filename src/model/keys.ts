/**
 * The keys each kind of statement takes, and how to read their values
 * (docs/syntax/proposal-v2.md). The parser accepts any key; this is where a
 * key gets its meaning, or a lint saying it's ignored.
 */
import type { Args, Span, Value } from "../parser/syntax";

const SOURCING = ["build", "buy", "outsource"] as const;
export type Sourcing = (typeof SOURCING)[number];

/** The four things that evolve (Wardley). */
const FORMS = ["activity", "practice", "data", "knowledge"] as const;

/** A value read for a key, or undefined when it isn't one the key takes. */
type Read = (value: Value | undefined) => unknown;

interface Reader {
  read: Read;
  /** What the key takes, for the lint when it gets something else. */
  takes: string;
}

const flag: Reader = {
  read: (value) => (value === undefined ? true : undefined),
  takes: "no value: write the key alone",
};

const text: Reader = {
  read: (value) => (value?.kind === "string" ? value.value : undefined),
  takes: 'text in quotes, such as "Kettle"',
};

const symbol: Reader = {
  read: (value) => (value?.kind === "symbol" ? value.value : undefined),
  takes: "a word, such as user",
};

const listed = (words: string[]) =>
  `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;

const oneOf = (symbols: readonly string[]): Reader => ({
  read: (value) =>
    value?.kind === "symbol" && symbols.includes(value.value) ? value.value : undefined,
  takes: listed([...symbols]),
});

const numbers = (value: Value | undefined, count: number) => {
  if (value?.kind !== "tuple" || value.args.keywords.length) return undefined;
  const values = value.args.positional;
  if (values.length !== count || values.some((v) => v.kind !== "number")) return undefined;
  return values.map((v) => (v.kind === "number" ? v.value : 0));
};

/** `("text", x, y)`: a label and where it sits. */
const placedLabel = (args: Args) => {
  const [text, x, y, ...rest] = args.positional;
  if (args.keywords.length || rest.length || text?.kind !== "string") return undefined;
  if (x?.kind !== "number" || y?.kind !== "number") return undefined;
  return { text: text.value, x: x.value, y: y.value };
};

/** `label="text"`, or `label=("text", x, y)` to place it too. */
const label: Reader = {
  read: (value) => {
    if (value?.kind === "string") return { text: value.value };
    return value?.kind === "tuple" ? placedLabel(value.args) : undefined;
  },
  takes: 'text in quotes, or ("text", x, y) to place it too',
};

const range: Reader = {
  read: (value) => numbers(value, 2),
  takes: "two numbers in brackets, such as (10, 90)",
};

/** What a component's future takes, in `evolve=(80, …)`. */
const FUTURE_KEYS: Record<string, Reader> = {
  label: text,
  sourcing: oneOf(SOURCING),
};

export interface Future {
  evolution: number;
  label?: string;
  sourcing?: Sourcing;
}

/** Lints found while reading keys, before they're given a severity. */
export interface KeyLint extends Span {
  message: string;
}

/** `evolve=80`, or `evolve=(80, label=…, sourcing=…)` when the future differs. */
const evolve = (lints: KeyLint[]): Reader => ({
  read: (value) => {
    if (value?.kind === "number") return { evolution: value.value };
    if (value?.kind !== "tuple") return undefined;
    const [evolution, ...rest] = value.args.positional;
    if (evolution?.kind !== "number" || rest.length) return undefined;
    const keys = readKeys(value.args, FUTURE_KEYS, "A future", lints);
    return { evolution: evolution.value, ...keys };
  },
  takes: "an evolution, or (evolution, label=…, sourcing=…)",
});

const componentKeys = (lints: KeyLint[]): Record<string, Reader> => ({
  type: symbol,
  form: oneOf(FORMS),
  sourcing: oneOf(SOURCING),
  inertia: flag,
  evolve: evolve(lints),
  label,
  pipeline: range,
  // Read later (proposal-v2.md, "Later"); taken now so maps that use them aren't linted.
  future: flag,
  owner: text,
  description: text,
  url: text,
});

const LINK_KEYS: Record<string, Reader> = {
  constraint: flag,
  flow: flag,
  label: text,
  future: flag,
};

/**
 * Reads `args`' keywords by `table`. A key that isn't in the table, a value
 * the key doesn't take, and a key given twice are linted and left out; the
 * first of a repeated key counts.
 */
function readKeys(
  args: Args | undefined,
  table: Record<string, Reader>,
  owner: string,
  lints: KeyLint[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const keyword of args?.keywords ?? []) {
    const reader = Object.hasOwn(table, keyword.key) ? table[keyword.key] : undefined;
    const value = reader?.read(keyword.value);
    if (!reader) lints.push({ ...span(keyword), message: unknownKey(owner, keyword.key) });
    else if (Object.hasOwn(values, keyword.key))
      lints.push({
        ...span(keyword),
        message: `${keyword.key} is given twice; the first one counts.`,
      });
    else if (value === undefined)
      lints.push({
        ...span(keyword),
        message: `${keyword.key} takes ${reader.takes}, so this is ignored.`,
      });
    else values[keyword.key] = value;
  }
  return values;
}

const span = ({ from, to }: Span) => ({ from, to });

const unknownKey = (owner: string, key: string) => `${owner} doesn't take ${key}, so it's ignored.`;

/** A component's keys, read. */
export interface ComponentKeys {
  type?: string;
  form?: (typeof FORMS)[number];
  sourcing?: Sourcing;
  inertia?: true;
  evolve?: Future;
  label?: { text: string; x?: number; y?: number };
  pipeline?: [number, number];
}

export const readComponentKeys = (args: Args | undefined, lints: KeyLint[]) =>
  readKeys(args, componentKeys(lints), "A component", lints) as ComponentKeys;

export interface LinkKeys {
  constraint?: true;
  flow?: true;
  label?: string;
  future?: true;
}

export const readLinkKeys = (args: Args | undefined, lints: KeyLint[]) =>
  readKeys(args, LINK_KEYS, "A link", lints) as LinkKeys;

/** Notes take no keys yet; `on=`, for numbered annotations, comes later (proposal-v2.md). */
export const readNoteKeys = (args: Args | undefined, lints: KeyLint[]) => {
  readKeys(args, {}, "A note", lints);
};
