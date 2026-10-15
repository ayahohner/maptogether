import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canvasMeasure, download, embeddedFont, exportMap, svgToPng } from "./exportMap";
import type { Measure } from "./mapSvg";

const measure: Measure = (text) => ({ width: text.length * 8, ascent: 15, descent: 5 });
const scene = { width: 400, height: 300, components: [], links: [] };

/** What each download saved: its file name and contents. */
let saved: { name: string; blob: Blob }[];
const blobs = new Map<string, Blob>();

beforeEach(() => {
  saved = [];
  let next = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:test/${next++}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, blob: blobs.get(this.getAttribute("href")!)! });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("measures text in the label typeface", () => {
  const context = {
    font: "",
    measureText: vi.fn(() => ({ width: 42, fontBoundingBoxAscent: 14, fontBoundingBoxDescent: 4 })),
  };
  const metrics = canvasMeasure(context as unknown as CanvasRenderingContext2D)("Tea", 16);
  expect(context.font).toBe('16px "Instrument Sans", sans-serif');
  expect(context.measureText).toHaveBeenCalledWith("Tea");
  expect(metrics).toEqual({ width: 42, ascent: 14, descent: 4 });
});

it("embeds the typeface as a data URL, fetching it only once", async () => {
  const fetchFont = vi.fn(async () => new Response(new Blob(["font"], { type: "font/woff2" })));
  const css = await embeddedFont(fetchFont);
  expect(css).toMatch(
    /^@font-face\{font-family:"Instrument Sans";src:url\(data:font\/woff2;base64,/,
  );
  expect(await embeddedFont(fetchFont)).toBe(css);
  expect(fetchFont).toHaveBeenCalledOnce();
});

it("fetches the typeface again after a failed fetch", async () => {
  // A fresh module, without the typeface an earlier test cached.
  vi.resetModules();
  const { embeddedFont } = await import("./exportMap");
  const offline = vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  await expect(embeddedFont(offline)).rejects.toThrow("Failed to fetch");
  const online = vi.fn(async () => new Response(new Blob(["font"], { type: "font/woff2" })));
  await expect(embeddedFont(online)).resolves.toMatch(/^@font-face/);
});

it("downloads a blob under a file name and frees its URL afterwards", async () => {
  vi.useFakeTimers();
  const blob = new Blob(["x"]);
  download(blob, "map.svg");
  expect(saved).toEqual([{ name: "map.svg", blob }]);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/0");
  vi.useRealTimers();
});

it("exports the map as an SVG file with the typeface embedded", async () => {
  await exportMap("svg", { scene, measure, name: "wardley-map-abc" });
  expect(saved.map((s) => s.name)).toEqual(["wardley-map-abc.svg"]);
  const svg = await saved[0].blob.text();
  expect(saved[0].blob.type).toBe("image/svg+xml");
  expect(svg).toContain("<svg");
  expect(svg).toContain("@font-face");
});

/** Stands in for the browser's image decoding and canvas, which the test DOM lacks. */
const stubCanvas = (blob: Blob | null) => {
  const drawImage = vi.fn();
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode = async () => {};
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(blob));
  return drawImage;
};

it("draws a PNG at twice the picture's size", async () => {
  const png = new Blob(["png"], { type: "image/png" });
  const drawImage = stubCanvas(png);
  expect(await svgToPng({ svg: "<svg/>", width: 100.2, height: 50 })).toBe(png);
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 201, 100);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/0");
});

it("fails a PNG the browser can't encode", async () => {
  stubCanvas(null);
  await expect(svgToPng({ svg: "<svg/>", width: 10, height: 10 })).rejects.toThrow(
    "PNG export failed",
  );
});

it("exports the map as a PNG file", async () => {
  stubCanvas(new Blob(["png"], { type: "image/png" }));
  await exportMap("png", { scene, measure, name: "wardley-map" });
  expect(saved.map((s) => [s.name, s.blob.type])).toEqual([["wardley-map.png", "image/png"]]);
});
