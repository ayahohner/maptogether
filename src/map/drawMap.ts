import { graph, type NodeAttributes, redrawLinks } from "../state/Graph";
import { parseMap } from "../parser/parse";
import { buildModel, type ComponentModel, type LinkModel, type MapModel } from "../model/model";
import MapSingleton from "./components/MapSingleton";
import { Component } from "./components/Component";
import { Line } from "./components/Line";
import { type ComponentConfig, layoutComponent } from "./components/componentLayout";
import type { LinkStyle } from "./components/symbols";

/** Past this many problems the text is mostly not a map, so the last drawing stays. */
const MAX_PROBLEMS = 50;

/** A component's x in pixels, from its evolution. */
const rendererX = (evolution: number) => MapSingleton.wardleyToRendererCoords(evolution, 0)[0];

/** A component as the canvas draws it, in pixels. */
const toConfig = (component: ComponentModel): ComponentConfig => {
  const {
    name,
    visibility,
    evolution,
    evolve,
    label,
    pipeline,
    bounds,
    form: _form,
    ...drawn
  } = component;
  const [x, y] = MapSingleton.wardleyToRendererCoords(evolution, visibility);
  return {
    ...drawn,
    name,
    x,
    y,
    label: label === name ? undefined : label,
    evolve: evolve && {
      x: rendererX(evolve.evolution),
      label: evolve.label,
      sourcing: evolve.sourcing,
    },
    pipeline: pipeline?.map(rendererX),
    bounds: bounds && [rendererX(bounds[0]), rendererX(bounds[1])],
  };
};

/** What the model puts on the map, in pixels. */
const toConfigs = (model: MapModel) =>
  new Map([...model.components].map(([name, component]) => [name, toConfig(component)]));

/**
 * Draws the map from its text, leaving out statements that don't parse.
 * Returns false, and leaves the last drawing, when too little of the text parses.
 */
export const drawMap = (text: string) => {
  const parsed = parseMap(text);
  if (parsed.problems.length > MAX_PROBLEMS) return false;
  drawModel(buildModel(parsed).model);
  return true;
};

const drawModel = (model: MapModel) => {
  try {
    reconcile(toConfigs(model), model.links);
    MapSingleton.renderIndicator.reset();
  } catch (e) {
    console.error(e);
  }
};

/**
 * Brings the map's Pixi objects in line with the model: unchanged ones stay,
 * moved ones move, and only added or reshaped ones are drawn anew.
 */
const reconcile = (components: Map<string, ComponentConfig>, links: LinkModel[]) => {
  for (const name of graph.filterNodes((name) => !components.has(name))) removeComponent(name);
  for (const config of components.values()) placeComponent(config);
  const wanted = linksToDraw(links, components);
  const stale = (key: string, style: LinkStyle) =>
    !wanted.has(key) || !sameStyle(wanted.get(key)!.style, style);
  for (const edge of graph.filterEdges((_edge, link) => stale(link.nodeKey, link.style))) {
    graph.getEdgeAttribute(edge, "component").removeFromParent();
    graph.dropEdge(edge);
  }
  for (const link of wanted.values()) addLink(link);
  MapSingleton.dirty = true;
};

/** A link as the canvas draws it. */
interface DrawnLink {
  ends: [string, string];
  style: LinkStyle;
}

const sameStyle = (a: LinkStyle, b: LinkStyle) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Each link once, by key, as first written either way round, leaving out
 * links to undeclared components and from a component to itself.
 */
const linksToDraw = (links: LinkModel[], components: Map<string, unknown>) => {
  const wanted = new Map<string, DrawnLink>();
  for (const { ends, ...style } of links) {
    const [a, b] = ends;
    const drawable = a !== b && components.has(a) && components.has(b);
    if (drawable && !wanted.has(`${b}->${a}`) && !wanted.has(`${a}->${b}`))
      wanted.set(`${a}->${b}`, { ends, style });
  }
  return wanted;
};

const placeComponent = (config: ComponentConfig) => {
  const node = graph.hasNode(config.name) ? graph.getNodeAttributes(config.name) : undefined;
  if (node && sameShape(node.config, config)) return moveComponent(node, config);
  if (node) removeComponent(config.name);
  addComponent(config);
};

/**
 * Everything drawn for a component but where it is, relative to it: its
 * marker, label, decorations, its future, and for a pipeline, its box.
 */
const shapeKey = (config: ComponentConfig) => {
  const { x, y, pipeline, evolve, ...drawn } = config;
  const pipe = layoutComponent(config).pipe;
  const future = evolve && { ...evolve, x: evolve.x - x };
  return JSON.stringify({ ...drawn, pipeline: pipeline !== undefined, pipe, future });
};

/** Whether a component can be moved to its new config rather than drawn anew. */
const sameShape = (a: ComponentConfig, b: ComponentConfig) => shapeKey(a) === shapeKey(b);

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

const addLink = ({ ends: [a, b], style }: DrawnLink) => {
  if (graph.hasEdge(a, b)) return;
  const [from, to] = [graph.getNodeAttributes(a).component, graph.getNodeAttributes(b).component];
  const nodeKey = `${a}->${b}`;
  const component = Line(from.x, from.y, to.x, to.y, nodeKey, style);
  graph.addEdge(a, b, { nodeKey, style, component });
  MapSingleton.graphContainer.addChild(component);
};
