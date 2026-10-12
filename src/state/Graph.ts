import Graph from "graphology";

import MapSingleton from "../map/components/MapSingleton";
import { Component } from "../map/components/Component";
import { Line } from "../map/components/Line";
import { ComponentT, LineT } from "../map/components/types";

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

export type WardleyGraph = Graph<
  NodeAttributes,
  EdgeAttributes,
  GraphAttributes
>;

export const graph: WardleyGraph = new Graph({ type: "undirected" });

// Allow adding to window object
// declare global {
//   interface Window {
//     graph: Graph<NodeAttributes, EdgeAttributes, GraphAttributes>;
//   }
// }
// window.graph = graph

interface IAddComponentConfig {
  x: number;
  y: number;
  name: NodeAttributes["nodeKey"];
  type: NodeAttributes["type"];
  parent?: Object;
  labelX?: number;
  labelY?: number;
  children?: Object[];
}

// ACTIONS
export const addComponent = (config: IAddComponentConfig) => {
  let { x, y, name, type } = config;
  const component = Component(config); // ->Renderer

  // TODO: Find out what characters aren't possible in nodeKeys and prevent them from being used in Identifiers
  try {
    graph.addNode(name, {
      nodeKey: name,
      type,
      coordinates: { x, y },
      component,
      mounted: true,
    });
  } catch (e) {
    console.error(e);
  }

  MapSingleton.graphContainer.addChild(component); // ->Renderer
  MapSingleton.dirty = true; // ->Renderer
};

export const updateComponentPosition = (
  nodeKey: string,
  x: number,
  y: number
) => {
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

export const updateComponentPositionOffset = (
  nodeKey: string,
  x: number,
  y: number
) => {
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

export const addEdge = (componentAKey: string, componentBKey: string) => {
  let componentA: NodeAttributes | undefined;
  let componentB: NodeAttributes | undefined;

  try {
    componentA = graph.getNodeAttributes(componentAKey);
  } catch (error) {
    console.error(
      `Node ${componentAKey} not found. Check to make sure it's declared in the graph.\n${error}`
    );
  }
  try {
    componentB = graph.getNodeAttributes(componentBKey);
  } catch (error) {
    console.error(
      `Node ${componentBKey} not found. Check to make sure it's declared in the graph.\n${error}`
    );
  }

  if (!(componentA || componentB)) {
    return;
  }

  // If reverse edge already exists
  if (graph.hasEdge(componentBKey, componentAKey)) {
    return;
  }

  if (componentA?.mounted && componentB?.mounted) {
    const componentAx = componentA.component.x;
    const componentAy = componentA.component.y;
    const componentBx = componentB.component.x;
    const componentBy = componentB.component.y;
    const nodeKey = `${componentA.nodeKey}->${componentB.nodeKey}`;
    const component = Line(
      componentAx,
      componentAy,
      componentBx,
      componentBy,
      nodeKey
    ); // ->Renderer

    MapSingleton.graphContainer.addChild(component); // ->Renderer
    MapSingleton.dirty = true; // ->Renderer

    graph.addEdge(componentA.nodeKey, componentB.nodeKey, {
      type: "edge",
      coordinates: {
        start: { x: componentA.coordinates.x, y: componentA.coordinates.y },
        stop: { x: componentB.coordinates.x, y: componentB.coordinates.y },
      },
      nodeKey,
      mounted: true,
      component,
    });
  }
};

const updateEdgePosition = (
  edge: string,
  attributes: EdgeAttributes,
  source: string,
  target: string,
  sourceAttributes: NodeAttributes,
  targetAttributes: NodeAttributes,
  undirected: boolean
) => {
  attributes.coordinates.start.x = sourceAttributes.component.x;
  attributes.coordinates.start.y = sourceAttributes.component.y;
  attributes.coordinates.stop.x = targetAttributes.component.x;
  attributes.coordinates.stop.y = targetAttributes.component.y;

  attributes.component.updateLine(
    attributes.coordinates.start.x,
    attributes.coordinates.start.y,
    attributes.coordinates.stop.x,
    attributes.coordinates.stop.y
  ); // ->Renderer
  MapSingleton.dirty = true; // ->Renderer
};

// SUBSCRIPTIONS
export class TogetherVisitorToGraph extends BaseTogetherVisitor {
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
    let children = undefined; // No pipeline
    if (ctx.pipeline) {
      children = this.visit(ctx.pipeline, ctx);

      // prevent nested pipelines for now, but still display as pipeline without children
      if (children && parentComponent) {
        children = [];
      }
    }

    let coordinates = [10, 10];
    if (ctx.coordinates) {
      coordinates = this.visit(ctx.coordinates);
    }

    let parentCoordinates = undefined;
    if (parentComponent && parentComponent.coordinates) {
      parentCoordinates = this.visit(parentComponent.coordinates);
    } else if (parentComponent) {
      parentCoordinates = [10, 10];
    }
    // wardleyscript has coordinates backwards
    const rendererCoords = MapSingleton.wardleyToRendererCoords(
      coordinates[1],
      parentCoordinates ? parentCoordinates[0] : coordinates[0] // if we're a child of a pipeline we want to use parent's y
    ); // <-Renderer

    addComponent({
      x: rendererCoords[0],
      y: rendererCoords[1],
      name: ctx.Identifier[0].image,
      type: "normal",
      parent: parentComponent ?? undefined,
      labelY: parentComponent ? 26 : undefined,
      children,
    });
  }

  pipeline(ctx: any, parentComponent?: Object | undefined) {
    let components: any[] = [];

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

graph.on("cleared", function () {
  MapSingleton.graphContainer.removeChildren(); // ->Renderer
});
