import type { Awareness } from "y-protocols/awareness";
import throttle from "lodash/throttle";
import { readUser } from "../sync/presence";

type Point = { x: number; y: number };

const percent = (n: unknown) => typeof n === "number" && n >= 0 && n <= 100;

/** Whether another user's shared pointer is on the map, in percent. */
function validPointer(value: unknown): value is Point {
  const point = value as Partial<Record<keyof Point, unknown>> | null | undefined;
  return percent(point?.x) && percent(point?.y);
}

/**
 * Ephemeral map coordinates, separate from editor selection and the saved doc.
 * `toWorld` undoes the local pan and zoom, so pointers are shared in map
 * coordinates and line up for everyone whatever their view.
 */
export function initializeCanvasPresence(
  canvas: HTMLCanvasElement,
  awareness: Awareness,
  toWorld: (p: Point) => Point = (p) => p,
) {
  const overlay = document.createElement("div");
  overlay.className = "canvas-presence";
  overlay.setAttribute("aria-hidden", "true");
  canvas.parentElement!.append(overlay);
  const pointers = new Map<number, HTMLDivElement>();

  const render = () => {
    const visible = new Set<number>();
    for (const [id, value] of awareness.getStates()) {
      const mapPointer: unknown = value.mapPointer;
      if (id === awareness.clientID || !validPointer(mapPointer)) continue;
      visible.add(id);
      let pointer = pointers.get(id);
      if (!pointer) {
        pointer = createPointer();
        overlay.append(pointer);
        pointers.set(id, pointer);
      }
      const user = readUser(id, value, awareness.clientID);
      pointer.style.left = `${mapPointer.x}%`;
      pointer.style.top = `${100 - mapPointer.y}%`;
      pointer.style.setProperty("--pointer-color", user.color);
      pointer.classList.toggle("near-right", mapPointer.x > 70);
      pointer.classList.toggle("near-bottom", mapPointer.y < 10);
      pointer.lastElementChild!.textContent = user.name;
    }
    for (const [id, pointer] of pointers) {
      if (!visible.has(id)) {
        pointer.remove();
        pointers.delete(id);
      }
    }
  };
  const publish = throttle((point: { x: number; y: number }) => {
    awareness.setLocalStateField("mapPointer", point);
  }, 50);
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const rect = canvas.getBoundingClientRect();
    const world = toWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const point = {
      x: (100 * world.x) / rect.width,
      y: 100 * (1 - world.y / rect.height),
    };
    if (validPointer(point)) publish(point);
    else leave();
  };
  const leave = () => {
    publish.cancel();
    awareness.setLocalStateField("mapPointer", null);
  };
  const visibility = () => {
    if (document.hidden) leave();
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("pointercancel", leave);
  window.addEventListener("blur", leave);
  document.addEventListener("visibilitychange", visibility);
  awareness.on("change", render);
  render();
  return () => {
    leave();
    awareness.off("change", render);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerleave", leave);
    canvas.removeEventListener("pointercancel", leave);
    window.removeEventListener("blur", leave);
    document.removeEventListener("visibilitychange", visibility);
    overlay.remove();
  };
}

function createPointer() {
  const pointer = document.createElement("div");
  pointer.className = "remote-pointer";
  const arrow = document.createElement("span");
  arrow.className = "remote-pointer-arrow";
  const label = document.createElement("span");
  label.className = "remote-pointer-label";
  pointer.append(arrow, label);
  return pointer;
}
