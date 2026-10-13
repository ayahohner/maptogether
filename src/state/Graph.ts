import Graph from "graphology";

import MapSingleton from "../map/components/MapSingleton";
import { Component } from "../map/components/Component";
import { Line } from "../map/components/Line";
import type { ComponentConfig } from "../map/components/componentLayout";
import type { ComponentT, LineT } from "../map/components/types";

import { state, setInitialLinkTarget } from "./State";
import type { CstNode } from "chevrotain";
import { BaseTogetherVisitor } from "../parser/TogetherParser";
import { parseMap } from "../parser/lenient";
import { showMapOutOfDate } from "../editor/Editor";

export type NodeAttributes = {
  type: "normal";
  nodeKey: string;
  coordinates: { x: number; y: number };
  component: ComponentT;
  mounted: boolean;
};

export type EdgeAttributes = {
  type: "edge";
  nodeKey: string;
  coordinates: {
    start: { x: number; y: number };
    stop: { x: number; y: number };
  };
  component: LineT;
  mounted: boolean;
};

export type GraphAttributes = {
  name?: string;
};

export type WardleyGraph = Graph<NodeAttributes, EdgeAttributes, GraphAttributes>;

export const graph: WardleyGraph = new Graph({ type: "undirected" });

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

export const updateComponentPosition = (nodeKey: string, x: number, y: number) => {
  const node = graph.getNodeAttributes(nodeKey);
  if (node) {
    node.component.position.x = x; // ->Renderer
    node.component.position.y = y; // ->Renderer
    node.coordinates.x = x;
    node.coordinates.y = y;
    MapSingleton.dirty = true; // ->Renderer
    graph.forEachEdge(nodeKey, updateEdgePosition);
  }
};

export const updateComponentPositionOffset = (nodeKey: string, x: number, y: number) => {
  const node = graph.getNodeAttributes(nodeKey);
  if (node) {
    node.component.position.x += x; // ->Renderer
    node.component.position.y += y; // ->Renderer
    node.coordinates.x += x;
    node.coordinates.y += y;
    MapSingleton.dirty = true; // ->Renderer
    graph.forEachEdge(nodeKey, updateEdgePosition);
  }
};

/** A component's attributes, if it is on the map. */
const mountedNode = (nodeKey: string) =>
  graph.hasNode(nodeKey) && graph.getNodeAttribute(nodeKey, "mounted")
    ? graph.getNodeAttributes(nodeKey)
    : undefined;

/** Draws a link. Links to undeclared components, and repeated links, are skipped. */
export const addEdge = (componentAKey: string, componentBKey: string) => {
  const a = mountedNode(componentAKey);
  const b = mountedNode(componentBKey);
  if (!a || !b || graph.hasEdge(componentAKey, componentBKey)) return;

  const nodeKey = `${a.nodeKey}->${b.nodeKey}`;
  const component = Line(a.component.x, a.component.y, b.component.x, b.component.y, nodeKey); // ->Renderer
  MapSingleton.graphContainer.addChild(component); // ->Renderer
  MapSingleton.dirty = true; // ->Renderer

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

const updateEdgePosition = (
  edge: string,
  attributes: EdgeAttributes,
  source: string,
  target: string,
  sourceAttributes: NodeAttributes,
  targetAttributes: NodeAttributes,
  undirected: boolean,
) => {
  attributes.coordinates.start.x = sourceAttributes.component.x;
  attributes.coordinates.start.y = sourceAttributes.component.y;
  attributes.coordinates.stop.x = targetAttributes.component.x;
  attributes.coordinates.stop.y = targetAttributes.component.y;

  attributes.component.updateLine(
    attributes.coordinates.start.x,
    attributes.coordinates.start.y,
    attributes.coordinates.stop.x,
    attributes.coordinates.stop.y,
  ); // ->Renderer
  MapSingleton.dirty = true; // ->Renderer
};

/** Where a component written without coordinates is drawn. */
const DEFAULT_COORDINATES = [10, 10];

/** Builds the graph, and the map's Pixi objects, from the parsed text. */
class TogetherVisitorToGraph extends BaseTogetherVisitor {
  // <-Parser
  // Local reference to graph for speed
  graph: WardleyGraph;

  constructor(graph: WardleyGraph) {
    super();

    this.graph = graph;

    // The "validateVisitor" method is a helper utility which performs static analysis
    // to detect missing or redundant visitor methods
    this.validateVisitor();
  }

  /* Visit methods */
  default(ctx: any) {
    // Don't keep reference to deleted item
    setInitialLinkTarget(undefined); // <-State
    graph.clear();

    if (ctx.statement) {
      const edgeDecs: any = [];

      ctx.statement.forEach((dec: any) => {
        // Only edgeDeclarations return objects to the top level
        const edgeDec = this.visit(dec);

        if (edgeDec) {
          edgeDecs.push(edgeDec);
        }
      });

      // render edges last to allow edges to be declared before components
      edgeDecs.forEach((edgeDec: any) => {
        addEdge(edgeDec.lhs, edgeDec.rhs);
      });
    } else {
      // If map is empty, rerender once
      MapSingleton.dirty = true; // ->Renderer
    }
  }

  statement(ctx: any) {
    if (ctx.componentDeclaration) {
      this.visit(ctx.componentDeclaration[0]);
      return;
    } else if (ctx.edgeDeclaration) {
      // we only return edgeDecs because they need to be created last
      // so pass them to the top level function which will run last
      return this.visit(ctx.edgeDeclaration[0]);
    }
    // TODO: add command and note
  }

  command(ctx: any) {
    return;
  }

  attributes(ctx: any) {
    return ctx.attributes;
  }

  attribute(ctx: any) {
    return;
  }

  edgeDeclaration(ctx: any) {
    return {
      type: "edgeDeclaration",
      lhs: ctx.LHS[0].image,
      rhs: ctx.RHS[0].image,
    };
  }

  componentDeclaration(ctx: any, parentComponent?: any) {
    const children: CstNode[] | undefined = this.pipelineChildren(ctx, parentComponent);
    const [visibility, evolution] = this.coordinatesOf(ctx);
    // A pipeline's components sit at the pipeline's visibility.
    const rowVisibility = parentComponent ? this.coordinatesOf(parentComponent)[0] : visibility;
    const [x, y] = MapSingleton.wardleyToRendererCoords(evolution, rowVisibility); // <-Renderer

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

  pipeline(ctx: any, parentComponent?: Object | undefined) {
    const components: any[] = [];

    if (ctx.statement) {
      ctx.statement.forEach((statement: any) => {
        // Only visit componentDeclarations for now
        if (statement?.children?.componentDeclaration) {
          this.visit(statement.children.componentDeclaration, parentComponent);
          components.push(statement.children.componentDeclaration[0]);
        }
      });
    }
    return components;
  }

  coordinates(ctx: any) {
    return [Number(ctx.LHS[0].image), Number(ctx.RHS[0].image)];
  }

  note(ctx: any) {
    return;
  }
}

const visitorInstance = new TogetherVisitorToGraph(graph);

/** Draws the map from its text, leaving out lines that don't parse. */
export const rerenderGraph = () => {
  const { cst } = parseMap(state.editor.editorText); // <-State
  showMapOutOfDate(!cst); // ->Editor
  if (cst) drawGraph(cst);
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
  MapSingleton.graphContainer.removeChildren(); // ->Renderer
});
