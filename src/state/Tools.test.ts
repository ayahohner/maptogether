import { beforeEach, expect, it } from "vitest";
import { activeTool, holdLink, holdPan, releaseHeld, setTool, tools } from "./Tools";

beforeEach(() => {
  setTool("select");
  releaseHeld();
});

it("starts with the select tool", () => {
  expect(activeTool()).toBe("select");
});

it("uses the picked tool", () => {
  setTool("component");
  expect(tools.tool).toBe("component");
  expect(activeTool()).toBe("component");
});

it("links while the link key is held, whatever the tool", () => {
  setTool("hand");
  holdLink(true);
  expect(activeTool()).toBe("link");
  holdLink(false);
  expect(activeTool()).toBe("hand");
});

it("pans while space is held", () => {
  holdPan(true);
  expect(activeTool()).toBe("hand");
});

it("links when both keys are held", () => {
  holdPan(true);
  holdLink(true);
  expect(activeTool()).toBe("link");
  releaseHeld();
  expect(activeTool()).toBe("select");
});
