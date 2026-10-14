import { expect, it } from "vitest";
import { type ExportScene, type Measure, mapSvg } from "./mapSvg";

/** Every character 8 px wide; boxes 20 px high, 15 above the baseline. */
const measure: Measure = (text) => ({ width: text.length * 8, ascent: 15, descent: 5 });

const scene = (overrides: Partial<ExportScene> = {}): ExportScene => ({
  width: 400,
  height: 300,
  components: [],
  links: [],
  ...overrides,
});

const viewBox = (svg: string) =>
  svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(" ")
    .map(Number);

it("draws the axes, the evolution stages and the logotype on the canvas colour", () => {
  const { svg } = mapSvg(scene(), measure);
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(svg).toContain('fill="#f7f7f8"');
  for (const stage of ["Genesis", "Custom", "Product", "Commodity", "Visibility"]) {
    expect(svg).toContain(`>${stage}</text>`);
  }
  expect(svg).toContain(">maptogether.io</text>");
  // Stage boundaries at 17.4%, 40% and 70% of the width.
  expect(svg).toContain('x1="70.1"');
  expect(svg).toContain('x1="160.5"');
  expect(svg).toContain('x1="280.5"');
});

it("frames the map with a margin, and room beneath it for the logotype", () => {
  const { width, height, svg } = mapSvg(scene(), measure);
  expect(viewBox(svg)).toEqual([-24, -24, width, height]);
  expect(width).toBe(448);
  expect(height).toBeGreaterThan(300 + 2 * 24);
});

it("grows to fit labels that run off the map", () => {
  const components = [{ name: "A very long name", x: 390, y: 150 }];
  const { width } = mapSvg(scene({ components }), measure);
  // The label starts 9 px right of the component: 390 + 9 + 16 × 8, plus the margin.
  expect(width).toBe(390 + 9 + 128 + 24 + 24);
});

it("draws a component as a circle with its name on a patch of canvas", () => {
  const { svg } = mapSvg(scene({ components: [{ name: "Kettle", x: 100, y: 200 }] }), measure);
  expect(svg).toContain('<g transform="translate(100 200)">');
  expect(svg).toContain('<rect width="48" height="20" fill="#f7f7f8"/>');
  expect(svg).toContain('<text y="15" font-size="16">Kettle</text>');
  expect(svg).toContain('<circle r="5.5"');
});

it("draws a pipeline as a square in a box, with its components' labels at an angle", () => {
  const components = [
    { name: "Tea", x: 200, y: 100, pipeline: [150, 250] },
    { name: "Loose Leaf", x: 150, y: 100, inPipeline: "Tea" },
  ];
  const { svg } = mapSvg(scene({ components }), measure);
  expect(svg).toContain('<rect x="-4.5" y="-4.5" width="9" height="9"');
  // The box runs from 10 px before the first component to 10 px past the last.
  expect(svg).toContain('<rect x="-59.5" y="2.5" width="119" height="19"');
  // A pipeline's component sits 12 px below the row.
  expect(svg).toContain('<g transform="translate(150 112)">');
  expect(svg).toContain("rotate(30)");
});

it("draws links between their ends", () => {
  const { svg } = mapSvg(scene({ links: [[10, 20, 30.456, 40]] }), measure);
  expect(svg).toContain('<line x1="10" y1="20" x2="30.46" y2="40"/>');
});

it("escapes names for XML", () => {
  const { svg } = mapSvg(scene({ components: [{ name: `R&D <"core">`, x: 0, y: 0 }] }), measure);
  expect(svg).toContain(">R&amp;D &lt;&quot;core&quot;&gt;</text>");
});

it("embeds the typeface only when given one", () => {
  expect(mapSvg(scene(), measure).svg).not.toContain("<style>");
  expect(mapSvg(scene(), measure, "@font-face{}").svg).toContain(
    "<defs><style>@font-face{}</style></defs>",
  );
});
