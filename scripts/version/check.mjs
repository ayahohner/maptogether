/** Files that end up in the app or the relay, so changing them needs a release. */
const SHIPPED = /^(src|public|examples|relay\/src)\/|^index\.html$/;
const TEST = /\.test\.[cm]?[jt]sx?$/;

export const USAGE = `Usage: version-check [--base <ref>]

Fails when the commits since <ref> (default: merge-base with origin/HEAD) change
shipped files (src/, public/, examples/, relay/src/, index.html) without raising
"version" in package.json. Pick the bump by semver:

  patch  bug fixes only
  minor  new features; existing maps, links and map text still work
  major  existing maps, links or map text no longer work as before`;

export const shipsCode = (files) => files.some((file) => SHIPPED.test(file) && !TEST.test(file));

const parts = (version) => version.split(".").map((part) => parseInt(part, 10) || 0);

/** Positive when version `a` is later than `b`, negative when earlier, else 0. */
export function compareVersions(a, b) {
  const [x, y] = [parts(a), parts(b)];
  return [0, 1, 2].map((i) => (x[i] ?? 0) - (y[i] ?? 0)).find((d) => d !== 0) ?? 0;
}

/** The verdict for a push: `{ ok, message }`. */
export function checkVersion({ base, head, files }) {
  if (!shipsCode(files)) return { ok: true, message: "version check: nothing shipped changed" };
  if (compareVersions(head, base) > 0) return { ok: true, message: `version check: ${base} → ${head}` };
  return {
    ok: false,
    message: `✗ version check: shipped files changed but package.json is still ${head} (was ${base}).\n\n${USAGE}`,
  };
}

/** Runs the check through `io` (git and logging). Returns the exit code. */
export function run(argv, io) {
  const at = argv.indexOf("--base");
  const base = at >= 0 ? argv[at + 1] : io.git(["merge-base", "HEAD", "origin/HEAD"]).trim();
  const version = (ref) => JSON.parse(io.git(["show", `${ref}:package.json`])).version;
  const files = io.git(["diff", "--name-only", base, "HEAD"]).split("\n").filter(Boolean);
  const { ok, message } = checkVersion({ base: version(base), head: version("HEAD"), files });
  io.log(message);
  return ok ? 0 : 1;
}
