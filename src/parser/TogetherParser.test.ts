import { matchComponentRegex } from "./TogetherParser";

import { it, expect, describe } from "vitest";

const testRegex = (componentName: string, testString: string) => {
  const regexp = new RegExp(matchComponentRegex(componentName), "gm");
  return regexp.test(testString);
};

const genTruthyTest = (componentName: string, testString: string) => {
  return it(`matches component "${componentName}" in "${testString.replace(/\n|\r/g, "")}"`, () => {
    expect(testRegex(componentName, testString)).toBeTruthy();
  });
};

const genFalsyTest = (componentName: string, testString: string) => {
  return it(`doesn't match component "${componentName}" in "${testString.replace(
    /\n|\r/g,
    "",
  )}"`, () => {
    expect(testRegex(componentName, testString)).toBeFalsy();
  });
};

describe("replaceCoordinatesRegex", () => {
  genTruthyTest("corn", "corn");
  genTruthyTest("corn", "corn// comment");
  genTruthyTest("corn", "corn // comment");
  genTruthyTest("corn", "corn  // comment");
  genTruthyTest("corn", "corn  \t// comment");
  genTruthyTest("corn", "corn [-1.3, 2.3e1]");
  genTruthyTest("corn", " corn [-1.3, 2.3e1]");
  genTruthyTest("corn", "corn[-1.3,2.3]");
  genTruthyTest("corn", "corn[-1.3,2.3]//[0.3,0.5]");
  genTruthyTest("corn", "corn [-1.3, 2.3e1] ");
  genFalsyTest("corn", "corn  hole");
  genFalsyTest("corn", "corn  hole [0.3, 0.4]");
  genFalsyTest("corn", "corn \t hole ///");
  genFalsyTest("corn", "corn hole//comment");
  genFalsyTest("corn", "cornhole");
});
