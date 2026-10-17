import { type ComponentConfig, layoutComponent } from "../map/components/componentLayout";
import {
  decorations,
  type LinkStyle,
  linkShapes,
  markerShapes,
  type Shape,
  type TextShape,
} from "../map/components/symbols";
import { evolutionStages, stageBoundaries, stageEdges } from "../map/MapAxes";
import { MAP_TOKENS } from "../map/tokens";

export interface TextMetrics {
  width: number;
  /** Above and below the baseline: the label's box is their sum high. */
  ascent: number;
  descent: number;
}

/** Measures `text` at `size` px in the label typeface. */
export type Measure = (text: string, size: number) => TextMetrics;

/** What is on the map, in pixels, as the canvas draws it at zoom 1. */
export interface ExportScene {
  /** The map's size: evolution 0–100 across it, visibility 100–0 down it. */
  width: number;
  height: number;
  /** In drawing order: later ones paint over earlier ones. */
  components: ComponentConfig[];
  /** Each link's ends, `[ax, ay, bx, by]`, and how it's drawn. */
  links: { ends: [number, number, number, number]; style: LinkStyle }[];
}

export interface MapSvg {
  svg: string;
  /** The picture's size, in CSS pixels. */
  width: number;
  height: number;
}

/** The canvas's colours (see design.css, map.css and tokens.ts). */
const COLORS = {
  canvas: MAP_TOKENS.canvas,
  ink: MAP_TOKENS.ink,
  axis: "#a1a1aa",
  axisText: "#71717a",
  divider: "#c4c4c8",
  logotype: "#a1a1aa",
};

const LABEL_SIZE = 16;
const AXIS_SIZE = 11;
const LOGOTYPE_SIZE = 11;
const LOGOTYPE = "maptogether.io";
/** Space around the map and its labels. */
const MARGIN = 24;
/** From the bottom of the map to the logotype's baseline. */
const LOGOTYPE_DROP = 22;

const FONT_FAMILY = "'Instrument Sans', Helvetica, Arial, sans-serif";

/** Rounds to two decimal places, which is plenty for pixels and keeps the file small. */
const n = (value: number) => Number(value.toFixed(2));

const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

type Point = [number, number];

/** Where a component's label box's corners land, after its rotation. */
const labelCorners = (config: ComponentConfig, measure: Measure): Point[] => {
  const { y, label } = layoutComponent(config);
  const { width, ascent, descent } = measure(labelText(config), LABEL_SIZE);
  const [cos, sin] = [Math.cos(label.rotation), Math.sin(label.rotation)];
  const box: Point[] = [
    [0, 0],
    [width, 0],
    [0, ascent + descent],
    [width, ascent + descent],
  ];
  return box.map(([u, v]) => [
    config.x + label.x + u * cos - v * sin,
    y + label.y + u * sin + v * cos,
  ]);
};

const labelText = (config: ComponentConfig) => config.label ?? config.name;

/** The corners of a shape's box, relative to its component. */
const cornersOf = (shape: Shape): Point[] => {
  switch (shape.kind) {
    case "circle":
      return [
        [shape.x - shape.r, shape.y - shape.r],
        [shape.x + shape.r, shape.y + shape.r],
      ];
    case "rect":
      return [
        [shape.x, shape.y],
        [shape.x + shape.width, shape.y + shape.height],
      ];
    default: {
      const [x1, y1, x2, y2] = shape.points;
      return [
        [x1, y1],
        [x2, y2],
      ];
    }
  }
};

/** The corners of everything drawn for a component but its label, and for a pipeline, its box. */
const shapeCorners = (config: ComponentConfig, measure: Measure): Point[] => {
  const { y, pipe } = layoutComponent(config);
  const { behind, front, texts } = decorations(config);
  const shapes = [...markerShapes(config, "default"), ...behind, ...front];
  const corners = shapes.flatMap(cornersOf);
  for (const text of texts) {
    const { width, ascent, descent } = measure(text.text, LABEL_SIZE);
    corners.push([text.x, text.y], [text.x + width, text.y + ascent + descent]);
  }
  if (pipe) corners.push([pipe.offset + pipe.width, 22], [pipe.offset, 0]);
  return corners.map(([x, dy]) => [config.x + x, y + dy]);
};

/** The smallest box holding the map and everything drawn on it, labels included. */
const contentBounds = (scene: ExportScene, measure: Measure) => {
  const points: Point[] = [
    [0, 0],
    [scene.width, scene.height],
    ...scene.components.flatMap((c) => [...labelCorners(c, measure), ...shapeCorners(c, measure)]),
    ...scene.links.flatMap((l) => linkCorners(l, measure)),
  ];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

/** Dashed stage boundaries, drawn up from just below the x-axis so each ends on a dash. */
const stageDividers = ({ width, height }: ExportScene) =>
  stageBoundaries
    .map((boundary) => {
      const x = n((boundary / 100) * width + 0.5);
      return `<line x1="${x}" y1="${n(height - 15.5)}" x2="${x}" y2="0" stroke="${COLORS.divider}" stroke-dasharray="4 4"/>`;
    })
    .join("");

/** The visibility (y) and evolution (x) axes with their arrowheads and labels, as map.css draws them. */
const axes = ({ width, height }: ExportScene) => {
  const axisY = n(height - 19.5);
  const stroke = `fill="none" stroke="${COLORS.axis}"`;
  const stages = evolutionStages
    .map((stage, i) => {
      const x = n((stageEdges[i] / 100) * width + (i === 0 ? 14 : 6));
      return `<text x="${x}" y="${n(height - 6)}">${stage.name}</text>`;
    })
    .join("");
  return [
    `<path d="M8.5 4V${n(height - 20)}M4.5 8.5L8.5 4.5L12.5 8.5" ${stroke}/>`,
    `<path d="M8 ${axisY}H${n(width - 2)}M${n(width - 6.5)} ${n(axisY - 4)}L${n(width - 2.5)} ${axisY}L${n(width - 6.5)} ${n(axisY + 4)}" ${stroke}/>`,
    `<g fill="${COLORS.axisText}" font-size="${AXIS_SIZE}">`,
    `<text transform="translate(22 16) rotate(-90)" text-anchor="end">Visibility</text>`,
    stages,
    "</g>",
  ].join("");
};

/** A link's line, and its label on a patch of the canvas colour. */
const link = ({ ends, style }: ExportScene["links"][number], measure: Measure) => {
  const { line, text } = linkShapes(ends, style);
  if (!text) return svgShape(line);
  const { width, ascent, descent } = measure(text.text, LABEL_SIZE);
  const backing = `<rect x="${n(text.x)}" y="${n(text.y)}" width="${n(width)}" height="${n(ascent + descent)}" fill="${COLORS.canvas}"/>`;
  return svgShape(line) + backing + svgText(text, measure);
};

/** Where a link's label box's corners are. */
const linkCorners = ({ ends, style }: ExportScene["links"][number], measure: Measure): Point[] => {
  const { text } = linkShapes(ends, style);
  if (!text) return [];
  const { width, ascent, descent } = measure(text.text, LABEL_SIZE);
  return [
    [text.x, text.y],
    [text.x + width, text.y + ascent + descent],
  ];
};

/** The label, on a patch of the canvas colour so lines don't run through it. */
const label = (config: ComponentConfig, measure: Measure) => {
  const { label: at } = layoutComponent(config);
  const { width, ascent, descent } = measure(labelText(config), LABEL_SIZE);
  const rotation = n((at.rotation * 180) / Math.PI);
  return [
    `<g transform="translate(${n(at.x)} ${n(at.y)})${rotation ? ` rotate(${rotation})` : ""}">`,
    `<rect width="${n(width)}" height="${n(ascent + descent)}" fill="${COLORS.canvas}"/>`,
    `<text y="${n(ascent)}" font-size="${LABEL_SIZE}">${escapeXml(labelText(config))}</text>`,
    "</g>",
  ].join("");
};

const paint = (shape: Shape) => {
  const fill = "fill" in shape && shape.fill ? MAP_TOKENS[shape.fill] : "none";
  const stroke =
    "stroke" in shape && shape.stroke
      ? ` stroke="${MAP_TOKENS[shape.stroke.role]}" stroke-width="${shape.stroke.width}"`
      : "";
  return `fill="${fill}"${stroke}`;
};

/** How far in an inside border's centre line sits. */
const inset = (shape: Shape) =>
  "stroke" in shape && shape.stroke?.inside ? shape.stroke.width / 2 : 0;

/** A shape, its inside borders drawn inside it as on the canvas. */
const svgShape = (shape: Shape) => {
  const i = inset(shape);
  switch (shape.kind) {
    case "circle":
      return `<circle cx="${n(shape.x)}" cy="${n(shape.y)}" r="${n(shape.r - i)}" ${paint(shape)}/>`;
    case "rect":
      return `<rect x="${n(shape.x + i)}" y="${n(shape.y + i)}" width="${n(shape.width - 2 * i)}" height="${n(shape.height - 2 * i)}" ${paint(shape)}/>`;
    case "polygon":
      return `<polygon points="${shape.points.map(n).join(" ")}" ${paint(shape)}/>`;
    case "line": {
      const [x1, y1, x2, y2] = shape.points.map(n);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${paint(shape)}/>`;
    }
  }
};

const svgText = ({ x, y, text, fill }: TextShape, measure: Measure) =>
  `<text x="${n(x)}" y="${n(y + measure(text, LABEL_SIZE).ascent)}" font-size="${LABEL_SIZE}" fill="${MAP_TOKENS[fill]}">${escapeXml(text)}</text>`;

/**
 * A component: its symbol, label and decorations, and for a pipeline the box
 * its components sit in, in the order the canvas draws them.
 */
const component = (config: ComponentConfig, measure: Measure) => {
  const { y, pipe } = layoutComponent(config);
  const outline = `stroke="${COLORS.ink}" stroke-width="1"`;
  const box = pipe
    ? `<rect x="${n(pipe.offset + 0.5)}" y="2.5" width="${n(pipe.width - 1)}" height="19" fill="#ffffff" fill-opacity="0.1" ${outline}/>`
    : "";
  const { behind, front, texts } = decorations(config);
  return [
    `<g transform="translate(${n(config.x)} ${n(y)})">`,
    box,
    behind.map(svgShape).join(""),
    label(config, measure),
    front.map(svgShape).join(""),
    texts.map((text) => svgText(text, measure)).join(""),
    markerShapes(config, "default").map(svgShape).join(""),
    "</g>",
  ].join("");
};

/** The app's mark (public/favicon.svg), drawn 32 units square. */
const MARK =
  '<rect width="32" height="32" rx="8" fill="#6d4aff"/>' +
  '<path d="M8 7v17h17" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M14 11.5l7 4.5M14 11.5l-1 8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' +
  '<circle cx="14" cy="11.5" r="2.6" fill="#fff"/><circle cx="21" cy="16" r="2.6" fill="#fff"/><circle cx="13" cy="19.5" r="2.6" fill="#fff"/>';

const MARK_SIZE = 12;

/** A small, quiet "maptogether.io" with the mark, ending at `right` on `baseline`. */
const logotype = (right: number, baseline: number, measure: Measure) => {
  const { width, ascent } = measure(LOGOTYPE, LOGOTYPE_SIZE);
  const markX = n(right - width - 4 - MARK_SIZE);
  // Centres the mark on the text's lowercase letters, roughly half the ascent above the baseline.
  const markY = n(baseline - ascent / 2 - MARK_SIZE / 2 + 1);
  return [
    `<g opacity="0.8">`,
    `<g transform="translate(${markX} ${markY}) scale(${MARK_SIZE / 32})" opacity="0.6">${MARK}</g>`,
    `<text x="${n(right)}" y="${n(baseline)}" text-anchor="end" font-size="${LOGOTYPE_SIZE}" fill="${COLORS.logotype}" style="font-feature-settings: 'ss01'">${LOGOTYPE}</text>`,
    "</g>",
  ].join("");
};

/**
 * Draws the map as an SVG picture: everything the canvas shows at zoom 1,
 * whatever the view, with a margin and the logotype beneath. `fontCss` is
 * embedded so the labels keep their typeface wherever the file is opened.
 */
export function mapSvg(scene: ExportScene, measure: Measure, fontCss = ""): MapSvg {
  const bounds = contentBounds(scene, measure);
  const [x, y] = [n(bounds.minX - MARGIN), n(bounds.minY - MARGIN)];
  const baseline = bounds.maxY + LOGOTYPE_DROP;
  const width = n(bounds.maxX + MARGIN - x);
  const height = n(baseline + MARGIN - 6 - y);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" font-family="${FONT_FAMILY}">`,
    fontCss ? `<defs><style>${fontCss}</style></defs>` : "",
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.canvas}"/>`,
    stageDividers(scene),
    `<g>${scene.links.map((l) => link(l, measure)).join("")}</g>`,
    `<g fill="${COLORS.ink}">${scene.components.map((c) => component(c, measure)).join("")}</g>`,
    axes(scene),
    logotype(bounds.maxX, baseline, measure),
    "</svg>",
  ].join("");
  return { svg, width, height };
}
