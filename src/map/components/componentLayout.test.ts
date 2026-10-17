import { describe, expect, it } from "vitest";

import type { StateT } from "../../state/State";
import {
  type ComponentConfig,
  layoutComponent,
  modeOf,
  pipelineBox,
  squareHalfSide,
} from "./componentLayout";

describe("layoutComponent", () => {
  it("puts a component's label above and to its right", () => {
    expect(layoutComponent({ x: 50, y: 40, name: "Kettle" })).toEqual({
      y: 40,
      zIndex: 0,
      pipe: undefined,
      label: { x: 9, y: -16, rotation: 0 },
    });
  });

  it("lowers a pipeline's component into its box, with an angled label in front", () => {
    expect(layoutComponent({ x: 50, y: 40, name: "Tea Bags", inPipeline: "Tea" })).toEqual({
      y: 52,
      zIndex: 1,
      pipe: undefined,
      label: { x: 9, y: 10, rotation: Math.PI / 6 },
    });
  });

  it("draws a box for a pipeline that holds components, and lifts its label clear", () => {
    const layout = layoutComponent({ x: 50, y: 40, name: "Tea", pipeline: [20, 80] });
    expect(layout.pipe).toEqual({ offset: -40, width: 80 });
    expect(layout.label.y).toBe(-18);
  });

  it("starts a label clear of sourcing and inertia, lifted over an arrow to the future", () => {
    const label = (config: Partial<ComponentConfig>) =>
      layoutComponent({ x: 50, y: 40, name: "Kettle", ...config }).label;
    expect(label({ sourcing: "build" })).toMatchObject({ x: 17, y: -16 });
    expect(label({ inertia: true })).toMatchObject({ x: 18 });
    expect(label({ sourcing: "build", inertia: true })).toMatchObject({ x: 26 });
    expect(label({ symbol: "market" })).toMatchObject({ x: 12, y: -19 });
    expect(label({ evolve: { x: 80 } })).toMatchObject({ y: -22 });
    expect(label({ evolve: { x: 20 } })).toMatchObject({ y: -16 });
    expect(label({ inertia: true, labelOffset: { x: -40, y: 10 } })).toEqual({
      x: -40,
      y: 10,
      rotation: 0,
    });
    expect(label({ inPipeline: "Tea", labelOffset: { x: 1, y: 2 } })).toEqual({
      x: 1,
      y: 2,
      rotation: 0,
    });
  });

  it("draws no box for a pipeline with no components", () => {
    expect(layoutComponent({ x: 50, y: 40, name: "Tea", pipeline: [] }).pipe).toBeUndefined();
  });
});

describe("pipelineBox", () => {
  it("spans the pipeline's components with padding either side", () => {
    expect(pipelineBox(50, [30, 70, 40])).toEqual({ offset: -30, width: 60 });
  });

  it("stretches to the pipeline itself when it lies outside its components", () => {
    expect(pipelineBox(10, [30, 70])).toEqual({ offset: -10, width: 80 });
    expect(pipelineBox(90, [30, 70])).toEqual({ offset: -70, width: 80 });
  });

  it("covers its bounds at least, and its components where they lie outside them", () => {
    expect(pipelineBox(50, [], [0, 200])).toEqual({ offset: -50, width: 200 });
    expect(pipelineBox(50, [40, 250], [0, 200])).toEqual({ offset: -50, width: 260 });
  });
});

const stateWith = (linking: Partial<StateT["linking"]>, selected: string[] = []) =>
  ({
    linking: { isLinkModeEnabled: false, initialLinkTarget: undefined, ...linking },
    selection: { selectionItems: new Set(selected), edgeItems: new Set() },
  }) as unknown as StateT;

describe("modeOf", () => {
  it("marks selected components outside link mode", () => {
    expect(modeOf(stateWith({}, ["Kettle"]), "Kettle")).toBe("selected");
    expect(modeOf(stateWith({}, ["Kettle"]), "Power")).toBe("default");
  });

  it("marks every component a link can go to in link mode, and the link's source", () => {
    const linking = stateWith({ isLinkModeEnabled: true, initialLinkTarget: "Kettle" }, ["Power"]);
    expect(modeOf(linking, "Kettle")).toBe("targeted");
    expect(modeOf(linking, "Power")).toBe("targetable");
  });
});

it("grows a pipeline's square with its border", () => {
  expect(squareHalfSide("default")).toBe(5);
  expect(squareHalfSide("selected")).toBe(5.5);
});
