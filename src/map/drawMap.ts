import type { CstNode } from "chevrotain";

import { graph, type NodeAttributes } from "../state/Graph";
import { BaseTogetherVisitor } from "../parser/TogetherParser";
import { parseMap } from "../parser/lenient";
import MapSingleton from "./components/MapSingleton";
import { Component } from "./components/Component";
import { Line } from "./components/Line";
import type { ComponentConfig } from "./components/componentLayout";

type AddComponentConfig = ComponentConfig & { type: NodeAttributes["type"] };

/** Draws a component. A name already on the map is drawn once, where it is first written. */
export const addComponent = (config: AddComponentConfig) => {
  const { x, y, name, type } = config;
  if (graph.hasNode(name)) return;
  const component = Component(config);
  graph.addNode(name, { nodeKey: name, type, coordinates: { x, y }, component, mounted: true });
  MapSingleton.graphContainer.addChild(component);
  MapSingleton.dirty = true;
};

/** A component's attributes, if it is on the map. */
const mountedNode = (nodeKey: string) =>
  graph.hasNode(nodeKey) && graph.getNodeAttribute(nodeKey, "mounted")
    ? graph.getNodeAttributes(nodeKey)
    : undefined;

/**
 * Draws a link. Links to undeclared components, from a component to itself
 * (the editor warns of these), and repeated links are skipped.
 */
export const addEdge = (componentAKey: string, componentBKey: string) => {
  const a = mountedNode(componentAKey);
  const b = mountedNode(componentBKey);
  if (!a || !b || a === b || graph.hasEdge(componentAKey, componentBKey)) return;

  const nodeKey = `${a.nodeKey}->${b.nodeKey}`;
  const component = Line(a.component.x, a.component.y, b.component.x, b.component.y, nodeKey);
  MapSingleton.graphContainer.addChild(component);
  MapSingleton.dirty = true;

  graph.addEdge(a.nodeKey, b.nodeKey, {
    type: "edge",
    coordinates: {
      start: { ...a.coordinates },
      stop: { ...b.coordinates },
    },
    nodeKey,
    mounted: true,
    component,
  });
};

/** Where a component written without coordinates is drawn. */
const DEFAULT_COORDINATES = [10, 10];

/** Builds the graph, and the map's Pixi objects, from the parsed text. */
class TogetherVisitorToGraph extends BaseTogetherVisitor {
  constructor() {
    super();
    // Throws if a grammar rule has no visit method, or a visit method no rule.
    this.validateVisitor();
  }

  default(ctx: any) {
    graph.clear();
    // Links are drawn after every component, so a link may come before the components it joins.
    const links = (ctx.statement ?? []).map((statement: CstNode) => this.visit(statement));
    for (const link of links.filter(Boolean)) addEdge(link.lhs, link.rhs);
    MapSingleton.dirty = true;
  }

  /** Draws a component, or returns a link to draw once every component is drawn. */
  statement(ctx: any) {
    if (ctx.componentDeclaration) this.visit(ctx.componentDeclaration[0]);
    else if (ctx.edgeDeclaration) return this.visit(ctx.edgeDeclaration[0]);
  }

  // Commands, attributes and notes are parsed but not drawn.
  command(_ctx: any) {}

  attributes(ctx: any) {
    return ctx.attributes;
  }

  attribute(_ctx: any) {}

  note(_ctx: any) {}

  edgeDeclaration(ctx: any) {
    return { lhs: ctx.LHS[0].image, rhs: ctx.RHS[0].image };
  }

  componentDeclaration(ctx: any, parentComponent?: any) {
    const children: CstNode[] | undefined = this.pipelineChildren(ctx, parentComponent);
    const [visibility, evolution] = this.coordinatesOf(ctx);
    // A pipeline's components sit at the pipeline's visibility.
    const rowVisibility = parentComponent ? this.coordinatesOf(parentComponent)[0] : visibility;
    const [x, y] = MapSingleton.wardleyToRendererCoords(evolution, rowVisibility);

    addComponent({
      x,
      y,
      name: ctx.Identifier[0].image,
      type: "normal",
      inPipeline: Boolean(parentComponent),
      pipeline: children?.map((child) => this.rendererX(child.children)),
    });
  }

  /** A component's x in pixels, from its evolution. */
  private rendererX(ctx: any) {
    return MapSingleton.wardleyToRendererCoords(this.coordinatesOf(ctx)[1], 0)[0];
  }

  /** `[visibility, evolution]`, or the default for a component written without them. */
  private coordinatesOf(ctx: any): number[] {
    return ctx.coordinates ? this.visit(ctx.coordinates) : DEFAULT_COORDINATES;
  }

  /** The components a pipeline holds. A pipeline nested in another is drawn empty. */
  private pipelineChildren(ctx: any, parentComponent?: any) {
    if (!ctx.pipeline) return undefined;
    const children = this.visit(ctx.pipeline, ctx);
    return parentComponent ? [] : children;
  }

  /** Draws a pipeline's components; returns their parse nodes. */
  pipeline(ctx: any, parentComponent?: unknown) {
    const declarations: CstNode[] = (ctx.statement ?? []).flatMap(
      (statement: CstNode) => statement.children.componentDeclaration ?? [],
    );
    for (const declaration of declarations) this.visit(declaration, parentComponent);
    return declarations;
  }

  coordinates(ctx: any) {
    return [Number(ctx.LHS[0].image), Number(ctx.RHS[0].image)];
  }
}

const visitorInstance = new TogetherVisitorToGraph();

/**
 * Draws the map from its text, leaving out lines that don't parse. Returns
 * false, and leaves the last drawing, when too little of the text parses.
 */
export const drawMap = (text: string) => {
  const { cst } = parseMap(text);
  if (cst) drawGraph(cst);
  return Boolean(cst);
};

const drawGraph = (cst: CstNode) => {
  try {
    visitorInstance.visit(cst);
    MapSingleton.renderIndicator.reset();
  } catch (e) {
    console.error(e);
  }
};

graph.on("cleared", () => {
  MapSingleton.graphContainer.removeChildren();
});
