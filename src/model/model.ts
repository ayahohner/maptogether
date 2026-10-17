/**
 * Turns parsed statements into what the map draws, and the lints that go
 * with it. The parser knows the shape of statements; this knows what they
 * mean.
 */
import type { Name, ParseResult, Span, Statement } from "../parser/syntax";

/** Where a component written without a position is drawn. */
const DEFAULT_POSITION = { visibility: 10, evolution: 10 } as const;

export interface ComponentModel {
  name: string;
  /** 0–100. A pipeline's components take the pipeline's. */
  visibility: number;
  /** 0–100. */
  evolution: number;
  /** The pipeline it's in. */
  inPipeline?: string;
  /** For a pipeline, its components' evolutions. A pipeline in a pipeline is drawn empty. */
  pipeline?: number[];
}

export interface MapModel {
  /** Each component where it's first written. */
  components: Map<string, ComponentModel>;
  /** `[needer, needed]`, in the order written, links to undeclared components included. */
  links: [string, string][];
}

export interface Lint extends Span {
  severity: "error" | "warning";
  message: string;
}

const spanOf = ({ from, to }: Span) => ({ from, to });

const SELF_LINK = "A component can't need itself, so the map leaves out this link.";

export function buildModel({ statements }: Pick<ParseResult, "statements">) {
  const model: MapModel = { components: new Map(), links: [] };
  const lints: Lint[] = [];
  const add = (statement: Statement, parent?: ComponentModel) =>
    addComponent(model, lints, statement, parent);
  for (const statement of statements) {
    if (statement.head.kind === "component") add(statement);
  }
  for (const statement of statements) {
    if (statement.head.kind === "link") addLink(model, lints, statement);
  }
  return { model, lints };
}

function addComponent(
  model: MapModel,
  lints: Lint[],
  statement: Statement,
  parent?: ComponentModel,
) {
  if (statement.head.kind !== "component") return;
  const { name } = statement.head;
  const { visibility, evolution } = position(statement);
  const component: ComponentModel = {
    name: name.text,
    visibility: parent?.visibility ?? visibility,
    evolution,
    inPipeline: parent?.name,
  };
  const children = (statement.children ?? []).filter((child) => child.head.kind === "component");
  if (statement.children)
    component.pipeline = parent ? [] : children.map((c) => position(c).evolution);
  declare(model, lints, name, component);
  for (const child of children) addComponent(model, lints, child, component);
}

/** Adds a component where it's first written; a second one is an error. */
function declare(model: MapModel, lints: Lint[], name: Name, component: ComponentModel) {
  if (!model.components.has(name.text)) {
    model.components.set(name.text, component);
    return;
  }
  const message = `${name.text} is already on the map, so this one is left out.`;
  lints.push({ ...spanOf(name), severity: "error", message });
}

function position({ args }: Statement) {
  const [visibility, evolution] = args?.positional ?? [];
  if (visibility?.kind !== "number" || evolution?.kind !== "number") return DEFAULT_POSITION;
  return { visibility: visibility.value, evolution: evolution.value };
}

function addLink(model: MapModel, lints: Lint[], statement: Statement) {
  if (statement.head.kind !== "link") return;
  const { from, to } = statement.head;
  model.links.push([from.text, to.text]);
  if (from.text === to.text)
    lints.push({ ...spanOf(statement), severity: "warning", message: SELF_LINK });
  for (const end of [from, to]) {
    if (model.components.has(end.text)) continue;
    lints.push({ ...spanOf(end), severity: "warning", message: undeclared(end.text) });
  }
}

const undeclared = (name: string) =>
  `${name} isn't on the map, so this link isn't drawn until it is.`;
