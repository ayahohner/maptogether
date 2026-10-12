import { expect, it, vi } from "vitest";
import { resolveRoom } from "./room";

it("keeps the map id from the URL path", () => {
  const replace = vi.fn();
  expect(resolveRoom({ pathname: "/abc123", search: "?demo" }, replace)).toEqual({
    id: "abc123",
    isNew: false,
    wantsDemo: false,
  });
  expect(replace).not.toHaveBeenCalled();
});

it("creates a new map on the root URL and moves the URL to it", () => {
  const replace = vi.fn();
  expect(resolveRoom({ pathname: "/", search: "" }, replace, () => "new1")).toEqual({
    id: "new1",
    isNew: true,
    wantsDemo: false,
  });
  expect(replace).toHaveBeenCalledWith("/new1");
});

it("starts a new map from the demo when asked", () => {
  const room = resolveRoom({ pathname: "/", search: "?demo" }, vi.fn(), () => "d");
  expect(room.wantsDemo).toBe(true);
});

it("generates an 8-character id by default", () => {
  expect(resolveRoom({ pathname: "/", search: "" }, vi.fn()).id).toHaveLength(8);
});
