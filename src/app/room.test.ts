import { expect, it, vi } from "vitest";
import { mapLifecycle, resolveRoom } from "./room";

it("keeps the map id from the URL path", () => {
  expect(resolveRoom({ pathname: "/abc123", search: "?demo" })).toEqual({
    id: "abc123",
    isNew: false,
    wantsDemo: false,
    wantsImport: false,
  });
});

it("treats the root URL as a draft with no id yet", () => {
  expect(resolveRoom({ pathname: "/", search: "" })).toEqual({
    isNew: true,
    wantsDemo: false,
    wantsImport: false,
  });
  expect(resolveRoom({ pathname: "/", search: "?demo" }).wantsDemo).toBe(true);
  expect(resolveRoom({ pathname: "/", search: "?import" }).wantsImport).toBe(true);
});

const hooks = () => ({ connect: vi.fn(), created: vi.fn(), makeId: () => "new1" });

it("connects an existing map straight away", () => {
  const h = hooks();
  const lifecycle = mapLifecycle(
    { id: "abc", isNew: false, wantsDemo: false, wantsImport: false },
    h,
  );
  expect(h.connect).toHaveBeenCalledWith("abc");
  expect(lifecycle.create()).toBe("/abc");
  lifecycle.textChanged(() => "Tea [1, 2]");
  expect(h.created).not.toHaveBeenCalled();
  expect(h.connect).toHaveBeenCalledOnce();
});

it("creates a draft map on its first edit, once", () => {
  const h = hooks();
  const room = resolveRoom({ pathname: "/", search: "" });
  const lifecycle = mapLifecycle(room, h);
  lifecycle.textChanged(() => "  \n");
  expect(h.connect).not.toHaveBeenCalled();
  lifecycle.textChanged(() => "Tea");
  lifecycle.textChanged(() => "Tea [1, 2]");
  expect(room.id).toBe("new1");
  expect(h.created).toHaveBeenCalledOnce();
  expect(h.created).toHaveBeenCalledWith("/new1");
  expect(h.connect).toHaveBeenCalledWith("new1");
});

it("doesn't count loading the demo as an edit", () => {
  const h = hooks();
  const lifecycle = mapLifecycle({ isNew: true, wantsDemo: true, wantsImport: false }, h);
  lifecycle.setUnedited("Demo");
  lifecycle.textChanged(() => "Demo");
  expect(h.connect).not.toHaveBeenCalled();
  lifecycle.textChanged(() => "Demo!");
  expect(h.connect).toHaveBeenCalledOnce();
});

it("creates a draft map when it is shared", () => {
  const h = hooks();
  expect(mapLifecycle({ isNew: true, wantsDemo: false, wantsImport: false }, h).create()).toBe(
    "/new1",
  );
  expect(h.connect).toHaveBeenCalledWith("new1");
});

it("generates an 8-character id by default", () => {
  const room = resolveRoom({ pathname: "/", search: "" });
  mapLifecycle(room, { connect: vi.fn(), created: vi.fn() }).create();
  expect(room.id).toHaveLength(8);
});
