import throttle from "lodash/throttle";
import { Application, Container, BitmapFont } from "pixi.js";
import { subscribe } from "valtio/vanilla";

import { rerenderGraph } from "../../state/Graph";

import { RenderIndicator } from "../utilities/RenderIndicator";
import { applyView, viewport } from "../viewport";
import type { MapView } from "../canvasActions";

import { SelectionHandler } from "./SelectionHandler";

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
      // this may introduce coordinate bugs
      resolution: 2,
      resizeTo: this.parent,
    });

    // Disable automatic rendering: we render manually in the ticker callback
    // below, only when something has changed. (This replaces the old
    // `Application.prototype.render = null` hack from Pixi v6.)
    this.ticker.remove(this.render, this);

    // The label atlas is drawn once, so the face must be loaded first.
    await document.fonts?.load(`16px ${LABEL_FONT}`);
    this.setup();
  }

  private setup(): void {
    // Manually render only when something has changed
    this.ticker.add(() => {
      if (this.dirty) {
        this.renderIndicator.onRender();
        this.render();
        this.dirty = false;
      }
    });

    // Create a font for usage
    BitmapFont.install({
      name: "TitleFont",
      style: {
        fill: "#000000",
        fontFamily: LABEL_FONT,
        // supersize font based on dpr
        fontSize: 16 * this.renderer.resolution,
        fontWeight: "normal",
      },
      chars:
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~1234567890!@#$%^&?*-=_+()[]{}<>,./;':\"\\| ",
    });

    // A container to hold all components, lines, text
    this.stage.addChild(this.world);
    this.world.addChild(this.graphContainer);
    this.graphContainer.sortableChildren = true; // make zIndex work
    this.world.addChild(SelectionHandler());
    subscribe(viewport, this.applyView, true);

    if (this.renderIndicator.enabled) this.stage.addChild(this.renderIndicator.r);
  }

  private applyView = () => {
    applyView(this.world, this.parent, viewport);
    this.dirty = true;
  };

  /** The map as the canvas gestures see it. */
  get mapView(): MapView {
    return {
      element: this.parent,
      components: () => this.graphContainer.children,
      size: () => this.screen,
    };
  }

  // Resize container on window resize
  // (manually place throughout app because ResizerObserver makes flashes)
  handleResize = throttle(() => {
    // The renderer's `resizeTo` only reacts to window resize events, but the
    // panel resizer changes the container's CSS size directly, so resize the
    // renderer explicitly here before rerendering against the new bounds.
    // (This is what the old `this.resize()` call did; in Pixi v8 `resize`
    // is assigned dynamically by the ResizePlugin and isn't in the types,
    // so call `renderer.resize` directly.)
    this.renderer.resize(this.parent.clientWidth, this.parent.clientHeight);
    rerenderGraph();
  }, 32);

  wardleyToRendererCoords(x: number, y: number) {
    // `screen` is already in logical (CSS) pixels even with resolution > 1,
    // so no density adjustment is needed (unlike the old `renderer.width`,
    // which was in physical pixels).
    return [(x / 100) * this.screen.width, (1 - y / 100) * this.screen.height];
  }

  rendererToWardleyCoords(x: number, y: number) {
    return [
      ((x / this.screen.width) * 100).toFixed(1),
      (100 - (y / this.screen.height) * 100).toFixed(1),
    ];
  }
}

export default new MapSingleton();
