#!/usr/bin/env node
// Semver check: shipped changes need a version bump in package.json.
// Run by .githooks/pre-push and CI; see scripts/version/check.mjs.
import { execFileSync } from "node:child_process";
import { run } from "./version/check.mjs";

const io = {
  git: (args) => execFileSync("git", args, { encoding: "utf8" }),
  log: (line) => console.log(line),
};

try {
  process.exitCode = run(process.argv.slice(2), io);
} catch (err) {
  console.error(`\n✗ version check could not run: ${err.message.split("\n")[0]}`);
  process.exitCode = 1;
}
