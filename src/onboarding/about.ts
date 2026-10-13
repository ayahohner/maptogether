/**
 * The About dialog doubles as the welcome for first-time visitors. Its
 * content is static HTML in index.html so search engines and link previews
 * can read it without running the app.
 */

/** Set to "false" once a visitor has dismissed the welcome. */
const WELCOMED_KEY = "shouldShowHelp";

export interface AboutOptions {
  storage: Pick<Storage, "getItem" | "setItem">;
  /** True when this visit created the map, so "blank map" makes sense. */
  isNewMap: boolean;
  onDemo: () => void;
}

export const isFirstVisit = (storage: AboutOptions["storage"]) =>
  storage.getItem(WELCOMED_KEY) !== "false";

export function initializeAbout(dialog: HTMLDialogElement, options: AboutOptions) {
  dialog.dataset.map = options.isNewMap ? "new" : "shared";
  dialog.addEventListener("close", () => options.storage.setItem(WELCOMED_KEY, "false"));
  // Clicks on the backdrop land on the <dialog> itself.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector("[data-action=demo]")?.addEventListener("click", () => {
    dialog.close();
    options.onDemo();
  });
  // index.html may already have opened it, before the app loaded.
  if (isFirstVisit(options.storage) && !dialog.open) dialog.showModal();
}

export const openAbout = () =>
  (document.getElementById("about") as HTMLDialogElement | null)?.showModal();
