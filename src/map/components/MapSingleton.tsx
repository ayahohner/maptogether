import { Application, Container, BitmapFont } from "pixi.js";
import { subscribe } from "valtio/vanilla";

import { RenderIndicator } from "../utilities/RenderIndicator";
import { applyView, viewport } from "../viewport";
import type { MapView } from "../canvasActions";

/** Component labels, in the UI's typeface (see --font-sans). */
const LABEL_FONT = '"Instrument Sans", sans-serif';

class MapSingleton extends Application {
  /** The element the canvas fills. */
  readonly parent = document.getElementById("map") as HTMLDivElement;

  /** Resolves once the Pixi application has been initialized. */
  readonly ready!: Promise<void>;

  renderIndicator = new RenderIndicator();

  /** Panned and zoomed by the viewport; holds everything drawn on the map. */
  world = new Container();
  graphContainer = new Container();
  dirty: boolean = false;

  constructor() {
    super();
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.init({
      // Transparent so the stage dividers beneath the canvas show through;
      // #map supplies the canvas background.
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      // Twice the CSS resolution, for sharp lines on high-density screens.
      resolution: 2,
      resizeTo: this.parent,
    });

    // The ticker callback in setup() renders instead, and only when `dirty`.
    this.ticker.remove(this.render, this);

    // The label atlas is drawn once, so the face must be loaded first.
    await document.fonts?.load(`16px ${LABEL_FONT}`);
    this.setup();
  }

  private setup(): void {
    this.ticker.add(() => {
      if (this.dirty) {
        this.renderIndicator.onRender();
        this.render();
        this.dirty = false;
      }
    });

    // Component labels are drawn from this atlas.
    BitmapFont.install({
      name: "TitleFont",
      style: {
        fill: "#000000",
        fontFamily: LABEL_FONT,
        // Drawn at the renderer's resolution, so labels stay sharp.
        fontSize: 16 * this.renderer.resolution,
        fontWeight: "normal",
      },
      chars:
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~1234567890!@#$%^&?*-=_+()[]{}<>,./;':\"\\| ",
    });

    this.stage.addChild(this.world);
    this.world.addChild(this.graphContainer);
    this.graphContainer.sortableChildren = true; // so zIndex applies
    subscribe(viewport, this.applyView, true);

    if (this.renderIndicator.enabled) this.stage.addChild(this.renderIndicator.r);
  }

  private applyView = () => {
    applyView(this.world, this.parent, viewport);
    this.dirty = true;
  };

  /** The parts of the map that the canvas gestures use. */
  get mapView(): MapView {
    return {
      element: this.parent,
      components: () => this.graphContainer.children,
      size: () => this.screen,
    };
  }

  /**
   * Fits the canvas to #map. `resizeTo` follows only window resizes, and the
   * panel divider resizes #map without one.
   */
  fitToParent() {
    this.renderer.resize(this.parent.clientWidth, this.parent.clientHeight);
  }

  /** Pixels from map percentages: x is evolution, y visibility (0 at the bottom). */
  wardleyToRendererCoords(x: number, y: number) {
    // `screen` is in CSS pixels, whatever the resolution.
    return [(x / 100) * this.screen.width, (1 - y / 100) * this.screen.height];
  }

  /** Map percentages, to one decimal place, from pixels. */
  rendererToWardleyCoords(x: number, y: number) {
    return [
      ((x / this.screen.width) * 100).toFixed(1),
      (100 - (y / this.screen.height) * 100).toFixed(1),
    ];
  }
}

export default new MapSingleton();
