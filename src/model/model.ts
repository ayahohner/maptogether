/**
 * Turns parsed statements into what the map draws, and the lints that go
 * with it. The parser knows the shape of statements; this knows what they
 * mean.
 */
import type { Name, ParseResult, Span, Statement, Value } from "../parser/syntax";
import {
  type ComponentKeys,
  type Future,
  type KeyLint,
  readComponentKeys,
  readLinkKeys,
  type Sourcing,
} from "./keys";

/** Where a component written without a position is drawn. */
const DEFAULT_POSITION = { visibility: 10, evolution: 10 } as const;

/** The types the map knows how to draw; `@type` adds others, drawn as one of these. */
const SYMBOLS = ["component", "user", "market", "ecosystem", "submap"] as const;
export type MapSymbol = (typeof SYMBOLS)[number];

export interface ComponentModel {
  name: string;
  /** 0–100. A pipeline's components take the pipeline's. */
  visibility: number;
  /** 0–100. */
  evolution: number;
  /** How it's drawn: its type, or for an `@type`, the type that one is based on. */
  symbol: MapSymbol;
  /** `activity`, `practice`, `data` or `knowledge`. Not drawn yet. */
  form?: string;
  sourcing?: Sourcing;
  inertia: boolean;
  /** Where it's expected to move to, and how it differs there. */
  evolve?: Future;
  /** The text drawn for it: its name, unless `label` says otherwise. */
  label: string;
  /** Where the label sits from the component (px), once it's been placed. */
  labelOffset?: { x: number; y: number };
  /** The pipeline it's in. */
  inPipeline?: string;
  /** For a pipeline, its components' evolutions. A pipeline in a pipeline is drawn empty. */
  pipeline?: number[];
}

export interface LinkModel {
  /** `[needer, needed]`. */
  ends: [string, string];
  constraint: boolean;
  flow: boolean;
  label?: string;
}

export interface MapModel {
  /** Each component where it's first written. */
  components: Map<string, ComponentModel>;
  /** In the order written, links to undeclared components included. */
  links: LinkModel[];
}

export interface Lint extends Span {
  severity: "error" | "warning";
  message: string;
}

const spanOf = ({ from, to }: Span) => ({ from, to });

const SELF_LINK = "A component can't need itself, so the map leaves out this link.";

/** What building the model hands from statement to statement. */
interface Builder {
  model: MapModel;
  lints: Lint[];
  /** Types `@type` declares, and the built-in type each is drawn as. */
  types: Map<string, MapSymbol>;
  /** Each pair of components linked so far, either way round. */
  linked: Set<string>;
}

export function buildModel({ statements }: Pick<ParseResult, "statements">) {
  const builder: Builder = {
    model: { components: new Map(), links: [] },
    lints: [],
    types: declaredTypes(statements),
    linked: new Set(),
  };
  for (const statement of statements) {
    if (statement.head.kind === "component") addComponent(builder, statement);
  }
  for (const statement of statements) {
    if (statement.head.kind === "link") addLink(builder, statement);
  }
  return { model: builder.model, lints: builder.lints };
}

const warning = (lints: Lint[], span: Span, message: string) =>
  lints.push({ ...spanOf(span), severity: "warning", message });

/** Reads keys with `read`, passing its lints on as warnings. */
function keysOf<T>(lints: Lint[], read: (lints: KeyLint[]) => T) {
  const found: KeyLint[] = [];
  const keys = read(found);
  for (const lint of found) warning(lints, lint, lint.message);
  return keys;
}

const isSymbol = (word: string): word is MapSymbol => SYMBOLS.some((s) => s === word);

/** `@type regulator [base=component, …]`: each declared type and the built-in it's based on. */
function declaredTypes(statements: Statement[]) {
  const types = new Map<string, MapSymbol>();
  for (const { head, args } of statements) {
    if (head.kind !== "directive" || head.word.text !== "type") continue;
    if (!head.subject || "kind" in head.subject) continue;
    const base = args?.keywords.find((k) => k.key === "base")?.value;
    types.set(head.subject.text, baseSymbol(base));
  }
  return types;
}

const baseSymbol = (base: Value | undefined): MapSymbol =>
  base?.kind === "symbol" && isSymbol(base.value) ? base.value : "component";

/** A statement whose head is a component's name. */
type ComponentStatement = Statement & { head: { kind: "component" } };

const isComponent = (statement: Statement): statement is ComponentStatement =>
  statement.head.kind === "component";

function addComponent(builder: Builder, statement: Statement, parent?: ComponentModel) {
  if (!isComponent(statement)) return;
  const { name } = statement.head;
  const keys = keysOf(builder.lints, (lints) => readComponentKeys(statement.args, lints));
  const component = describe(builder, statement, keys, parent);
  const children = mapChildren(builder, statement, component);
  if (statement.children && component.symbol === "component")
    component.pipeline = parent ? [] : children.map((c) => position([], c).evolution);
  declare(builder, name, component);
  for (const child of children) addComponent(builder, child, component);
}

/** What a component statement says, as the map draws it. */
function describe(
  builder: Builder,
  statement: ComponentStatement,
  keys: ComponentKeys,
  parent: ComponentModel | undefined,
): ComponentModel {
  const { visibility, evolution } = position(builder.lints, statement);
  const { name } = statement.head;
  const { label } = keys;
  return {
    name: name.text,
    visibility: parent?.visibility ?? visibility,
    evolution,
    symbol: symbolOf(builder, statement, keys.type),
    form: keys.form,
    sourcing: keys.sourcing,
    inertia: keys.inertia === true,
    evolve: keys.evolve,
    label: label?.text ?? name.text,
    labelOffset: label?.x === undefined ? undefined : { x: label.x, y: label.y ?? 0 },
    inPipeline: parent?.name,
  };
}

/** The built-in type a component is drawn as. */
function symbolOf(builder: Builder, statement: Statement, type: string | undefined): MapSymbol {
  if (type === undefined) return "component";
  if (isSymbol(type)) return type;
  const declared = builder.types.get(type);
  if (declared) return declared;
  const keyword = statement.args!.keywords.find((k) => k.key === "type")!;
  const message = `${type} isn't a type: use component, user, market or ecosystem, or add it with @type ${type}.`;
  warning(builder.lints, keyword, message);
  return "component";
}

/**
 * The children drawn on this map: a pipeline's. A submap's children are on
 * its own map, and other types take none.
 */
function mapChildren(builder: Builder, statement: ComponentStatement, component: ComponentModel) {
  if (!statement.children) return [];
  const children = statement.children.filter((child) => child.head.kind === "component");
  if (component.symbol === "component") return children;
  if (component.symbol !== "submap") {
    const message = `A ${component.symbol} can't hold components, so these aren't drawn.`;
    warning(builder.lints, statement.head.name, message);
  }
  return [];
}

/** Adds a component where it's first written; a second one is an error. */
function declare({ model, lints }: Builder, name: Name, component: ComponentModel) {
  if (!model.components.has(name.text)) {
    model.components.set(name.text, component);
    return;
  }
  const message = `${name.text} is already on the map, so this one is left out.`;
  lints.push({ ...spanOf(name), severity: "error", message });
}

/** Warns about values without a key from `extra` on, which nothing reads. */
function ignored(lints: Lint[], extra: Value[], message: string) {
  if (!extra.length) return;
  warning(lints, { from: extra[0].from, to: extra[extra.length - 1].to }, message);
}

const POSITION =
  "A component's position is two numbers, [visibility, evolution], so this is ignored.";

/** `[visibility, evolution]`; anything else without a key is linted. */
function position(lints: Lint[], { args }: Statement) {
  const positional = args?.positional ?? [];
  const [visibility, evolution] = positional;
  if (visibility?.kind !== "number" || evolution?.kind !== "number") {
    ignored(lints, positional, POSITION);
    return DEFAULT_POSITION;
  }
  ignored(lints, positional.slice(2), POSITION);
  return { visibility: visibility.value, evolution: evolution.value };
}

function addLink({ model, lints, linked }: Builder, statement: Statement) {
  if (statement.head.kind !== "link") return;
  const { from, to } = statement.head;
  const keys = keysOf(lints, (found) => readLinkKeys(statement.args, found));
  const positional = statement.args?.positional ?? [];
  ignored(lints, positional, "A link takes only keys, such as flow, so this is ignored.");
  model.links.push({
    ends: [from.text, to.text],
    constraint: keys.constraint === true,
    flow: keys.flow === true,
    label: keys.label,
  });
  if (from.text === to.text) warning(lints, statement, SELF_LINK);
  const pair = JSON.stringify([from.text, to.text].sort());
  if (linked.has(pair)) warning(lints, { from: from.from, to: to.to }, REPEATED_LINK);
  linked.add(pair);
  for (const end of [from, to]) {
    if (!model.components.has(end.text)) warning(lints, end, undeclared(end.text));
  }
}

const REPEATED_LINK =
  "These two are already linked, so the map draws the first link and leaves out this one.";

const undeclared = (name: string) =>
  `${name} isn't on the map, so this link isn't drawn until it is.`;
