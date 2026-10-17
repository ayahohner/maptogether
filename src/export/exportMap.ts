import fontUrl from "../app/fonts/instrument-sans.woff2?url";
import { type MapSvg, type Measure, mapSvg } from "./mapSvg";
import type { ExportScene } from "./mapSvg";

export type ExportFormat = "svg" | "png";

/** The label typeface, as the canvas draws it (see MapSingleton.tsx). */
const LABEL_FONT = '"Instrument Sans", sans-serif';

/** PNGs are drawn at twice the map's size, so they stay sharp on dense screens and slides. */
const PNG_SCALE = 2;

/** Measures text with a 2D canvas, in the page's loaded label typeface. */
export const canvasMeasure =
  (context: CanvasRenderingContext2D): Measure =>
  (text, size) => {
    context.font = `${size}px ${LABEL_FONT}`;
    const metrics = context.measureText(text);
    return {
      width: metrics.width,
      ascent: metrics.fontBoundingBoxAscent,
      descent: metrics.fontBoundingBoxDescent,
    };
  };

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

let fontCss: Promise<string> | undefined;

/**
 * The label typeface as an @font-face rule, fetched once, the first time a map
 * is exported; and again next time, if that fetch failed.
 */
export const embeddedFont = (fetchFont = () => fetch(fontUrl)) => {
  fontCss ??= fetchFont()
    .then((response) => response.blob())
    .then(readAsDataUrl)
    .then(
      (url) =>
        `@font-face{font-family:"Instrument Sans";src:url(${url}) format("woff2");font-weight:400 700}`,
    )
    .catch((error) => {
      fontCss = undefined;
      throw error;
    });
  return fontCss;
};

/** Draws the SVG onto a canvas `scale` times its size. */
export const svgToPng = async ({ svg, width, height }: MapSvg, scale = PNG_SCALE) => {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Saves `blob` as a download named `filename`. */
export const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // The download has started from the URL by now; it can go once this task ends.
  setTimeout(() => URL.revokeObjectURL(url));
};

export interface ExportOptions {
  scene: ExportScene;
  measure: Measure;
  /** The file name, without its extension. */
  name: string;
}

/** Downloads the map as an SVG or a PNG picture. */
export async function exportMap(format: ExportFormat, { scene, measure, name }: ExportOptions) {
  const picture = mapSvg(scene, measure, await embeddedFont());
  const blob =
    format === "svg" ? new Blob([picture.svg], { type: "image/svg+xml" }) : await svgToPng(picture);
  download(blob, `${name}.${format}`);
}
