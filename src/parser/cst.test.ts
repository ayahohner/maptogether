import { generateCstDts } from "chevrotain";
import { expect, it } from "vitest";

import { wardleyProductions } from "./WardleyParser";

const HEADER =
  "// Generated from the grammar by cst.test.ts. After changing it, run `vitest -u`.\n";

it("WardleyCst.d.ts has the parse tree types of its grammar", async () => {
  await expect(HEADER + generateCstDts(wardleyProductions)).toMatchFileSnapshot(
    "./WardleyCst.d.ts",
  );
});
