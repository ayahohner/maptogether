import { generateCstDts } from "chevrotain";
import { expect, it } from "vitest";

import { togetherProductions } from "./TogetherParser";
import { wardleyProductions } from "./WardleyParser";

const HEADER =
  "// Generated from the grammar by cst.test.ts. After changing it, run `vitest -u`.\n";

it.each([
  ["TogetherCst.d.ts", togetherProductions],
  ["WardleyCst.d.ts", wardleyProductions],
])("%s has the parse tree types of its grammar", async (file, productions) => {
  await expect(HEADER + generateCstDts(productions)).toMatchFileSnapshot(`./${file}`);
});
