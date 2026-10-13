import type {
  ComponentDeclarationCstChildren,
  ComponentDeclarationCstNode,
  CoordinatesCstChildren,
  DefaultCstChildren,
  DefaultCstNode,
  EdgeDeclarationCstChildren,
  ICstNodeVisitor,
  PipelineCstChildren,
  StatementCstChildren,
} from "../parser/TogetherCst";
import { graph, type NodeAttributes, redrawLinks } from "../state/Graph";
import { BaseTogetherVisitor } from "../parser/TogetherParser";
import { parseMap } from "../parser/lenient";
import MapSingleton from "./components/MapSingleton";
import { Component } from "./components/Component";
import { Line } from "./components/Line";
import { type ComponentConfig, layoutComponent } from "./components/componentLayout";

/** What the text puts on the map: each component where it is first written, and the links. */
export interface MapModel {
  components: Map<string, ComponentConfig>;
  links: [string, string][];
}

type Coordinates = [number, number];

/** Where a component written without coordinates is drawn. */
const DEFAULT_COORDINATES: Coordinates = [10, 10];

/** Reads the map's components and links from the parsed text. */
class TogetherVisitorToModel
  extends BaseTogetherVisitor
  implements ICstNodeVisitor<ComponentDeclarationCstChildren, unknown>
{
  private model: MapModel = { components: new Map(), links: [] };

  constructor() {
    super();
    // Throws if a grammar rule has no visit method, or a visit method no rule.
    this.validateVisitor();
  }

  default(ctx: DefaultCstChildren): MapModel {
    this.model = { components: new Map(), links: [] };
    for (const statement of ctx.statement ?? []) this.visit(statement);
    return this.model;
  }

  statement(ctx: StatementCstChildren) {
    if (ctx.componentDeclaration) this.visit(ctx.componentDeclaration[0]);
    else if (ctx.edgeDeclaration) this.model.links.push(this.visit(ctx.edgeDeclaration[0]));
  }

  // Commands, attributes and notes are parsed but not drawn.
  command() {}

  attributes() {}

  attribute() {}

  note() {}

  edgeDeclaration(ctx: EdgeDeclarationCstChildren): [string, string] {
    return [ctx.LHS[0].image, ctx.RHS[0].image];
  }

  /** Adds a component; `parent` is the pipeline's component, for a component in a pipeline. */
  componentDeclaration(
    ctx: ComponentDeclarationCstChildren,
    parent?: ComponentDeclarationCstChildren,
  ) {
    const children = this.pipelineChildren(ctx, parent);
    const [visibility, evolution] = this.coordinatesOf(ctx);
    // A pipeline's components sit at the pipeline's visibility.
    const rowVisibility = parent ? this.coordinatesOf(parent)[0] : visibility;
    const [x, y] = MapSingleton.wardleyToRendererCoords(evolution, rowVisibility);

    const name = ctx.Identifier[0].image;
    // A name written twice is drawn once, where it is first written.
    if (this.model.components.has(name)) return;
    this.model.components.set(name, {
      x,
      y,
      name,
      inPipeline: parent?.Identifier[0].image,
      pipeline: children?.map((child) => this.rendererX(child.children)),
    });
  }

  /** A component's x in pixels, from its evolution. */
  private rendererX(ctx: ComponentDeclarationCstChildren) {
    return MapSingleton.wardleyToRendererCoords(this.coordinatesOf(ctx)[1], 0)[0];
  }

  /** `[visibility, evolution]`, or the default for a component written without them. */
  private coordinatesOf(ctx: ComponentDeclarationCstChildren): Coordinates {
    return ctx.coordinates ? this.visit(ctx.coordinates) : DEFAULT_COORDINATES;
  }

  /** The components a pipeline holds. A pipeline nested in another is drawn empty. */
  private pipelineChildren(
    ctx: ComponentDeclarationCstChildren,
    parent?: ComponentDeclarationCstChildren,
  ): ComponentDeclarationCstNode[] | undefined {
    if (!ctx.pipeline) return undefined;
    const children = this.visit(ctx.pipeline, ctx);
    return parent ? [] : children;
  }

  /** Adds a pipeline's components, in `parent`'s pipeline; returns their parse nodes. */
  pipeline(ctx: PipelineCstChildren, parent?: ComponentDeclarationCstChildren) {
    const declarations = (ctx.statement ?? []).flatMap(
      (statement) => statement.children.componentDeclaration ?? [],
    );
    for (const declaration of declarations) this.visit(declaration, parent);
    return declarations;
  }

  coordinates(ctx: CoordinatesCstChildren): Coordinates {
    return [Number(ctx.LHS[0].image), Number(ctx.RHS[0].image)];
  }
}

const visitor = new TogetherVisitorToModel();

/**
 * Draws the map from its text, leaving out lines that don't parse. Returns
 * false, and leaves the last drawing, when too little of the text parses.
 */
export const drawMap = (text: string) => {
  const { cst } = parseMap(text);
  if (cst) drawModel(cst);
  return Boolean(cst);
};

const drawModel = (cst: DefaultCstNode) => {
  try {
    reconcile(visitor.visit(cst));
    MapSingleton.renderIndicator.reset();
  } catch (e) {
    console.error(e);
  }
};

/**
 * Brings the map's Pixi objects in line with the model: unchanged ones stay,
 * moved ones move, and only added or reshaped ones are drawn anew.
 */
const reconcile = ({ components, links }: MapModel) => {
  for (const name of graph.filterNodes((name) => !components.has(name))) removeComponent(name);
  for (const config of components.values()) placeComponent(config);
  const wanted = linksToDraw(links, components);
  for (const edge of graph.filterEdges((_edge, link) => !wanted.has(link.nodeKey))) {
    graph.getEdgeAttribute(edge, "component").removeFromParent();
    graph.dropEdge(edge);
  }
  for (const [a, b] of wanted.values()) addLink(a, b);
  MapSingleton.dirty = true;
};

/** Each link once, by key, leaving out links to undeclared components and from a component to itself. */
const linksToDraw = (links: [string, string][], components: Map<string, unknown>) => {
  const wanted = new Map<string, [string, string]>();
  for (const [a, b] of links) {
    const drawable = a !== b && components.has(a) && components.has(b);
    if (drawable && !wanted.has(`${b}->${a}`)) wanted.set(`${a}->${b}`, [a, b]);
  }
  return wanted;
};

const placeComponent = (config: ComponentConfig) => {
  const node = graph.hasNode(config.name) ? graph.getNodeAttributes(config.name) : undefined;
  if (node && sameShape(node.config, config)) return moveComponent(node, config);
  if (node) removeComponent(config.name);
  addComponent(config);
};

/** A pipeline's box, relative to the pipeline, as a string to compare. */
const box = (config: ComponentConfig) => JSON.stringify(layoutComponent(config).pipe);

/**
 * Whether a component can be moved to its new config rather than drawn anew:
 * in the same pipeline, the same marker, and for a pipeline, a box in the same
 * place relative to it.
 */
const sameShape = (a: ComponentConfig, b: ComponentConfig) =>
  a.inPipeline === b.inPipeline &&
  (a.pipeline === undefined) === (b.pipeline === undefined) &&
  box(a) === box(b);

const moveComponent = (node: NodeAttributes, config: ComponentConfig) => {
  const { x, y } = config;
  node.config = config;
  if (node.coordinates.x === x && node.coordinates.y === y) return;
  node.coordinates = { x, y };
  node.component.position.set(x, layoutComponent(config).y);
  redrawLinks(node.nodeKey);
};

const addComponent = (config: ComponentConfig) => {
  const component = Component(config);
  const { name, x, y } = config;
  graph.addNode(name, { nodeKey: name, coordinates: { x, y }, config, component });
  MapSingleton.graphContainer.addChild(component);
};

/** Removes a component, its links, and their Pixi objects. */
const removeComponent = (name: string) => {
  graph.forEachEdge(name, (_edge, link) => link.component.removeFromParent());
  graph.getNodeAttribute(name, "component").removeFromParent();
  graph.dropNode(name);
};

const addLink = (a: string, b: string) => {
  if (graph.hasEdge(a, b)) return;
  const [from, to] = [graph.getNodeAttributes(a).component, graph.getNodeAttributes(b).component];
  const nodeKey = `${a}->${b}`;
  const component = Line(from.x, from.y, to.x, to.y, nodeKey);
  graph.addEdge(a, b, { nodeKey, component });
  MapSingleton.graphContainer.addChild(component);
};
