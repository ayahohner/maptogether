import { expect, it, vi } from "vitest";
import { checkVersion, compareVersions, run, shipsCode } from "./check.mjs";

it("compares versions part by part", () => {
  expect(compareVersions("3.3.0", "3.2.9")).toBeGreaterThan(0);
  expect(compareVersions("3.2.0", "3.10.0")).toBeLessThan(0);
  expect(compareVersions("3.2", "3.2.0")).toBe(0);
  expect(compareVersions("4.0.0-beta", "3.9.9")).toBeGreaterThan(0);
});

it("counts app and relay code as shipped, but not tests or tooling", () => {
  expect(shipsCode(["src/app/room.ts"])).toBe(true);
  expect(shipsCode(["index.html"])).toBe(true);
  expect(shipsCode(["relay/src/index.ts"])).toBe(true);
  expect(shipsCode(["src/app/room.test.ts", "README.md", "scripts/x.mjs", "relay/README.md"])).toBe(
    false,
  );
});

it("needs a higher version only when shipped files change", () => {
  expect(checkVersion({ base: "3.2.0", head: "3.2.0", files: ["README.md"] }).ok).toBe(true);
  expect(checkVersion({ base: "3.2.0", head: "3.3.0", files: ["src/a.ts"] }).ok).toBe(true);
  const stale = checkVersion({ base: "3.2.0", head: "3.2.0", files: ["src/a.ts"] });
  expect(stale.ok).toBe(false);
  expect(stale.message).toContain("minor");
});

const git = (head) =>
  vi.fn((args) => {
    if (args[0] === "merge-base") return "abc\n";
    if (args[0] === "diff") return "src/a.ts\n";
    return JSON.stringify({ version: args[1].startsWith("HEAD") ? head : "3.2.0" });
  });

it("reads versions and changes from git", () => {
  const io = { git: git("3.3.0"), log: vi.fn() };
  expect(run([], io)).toBe(0);
  expect(io.git).toHaveBeenCalledWith(["diff", "--name-only", "abc", "HEAD"]);
  expect(io.log).toHaveBeenCalledWith("version check: 3.2.0 → 3.3.0");
});

it("fails a push that forgot the bump, against a given base", () => {
  const io = { git: git("3.2.0"), log: vi.fn() };
  expect(run(["--base", "main"], io)).toBe(1);
  expect(io.git).not.toHaveBeenCalledWith(["merge-base", "HEAD", "origin/HEAD"]);
});
