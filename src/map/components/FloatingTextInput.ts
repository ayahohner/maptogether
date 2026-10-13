export type OnSubmitHandler = (value: string) => void;

/**
 * A text field over the map, for naming a new component or renaming one.
 * Enter or clicking away submits; Escape cancels.
 *
 * Focuses synchronously, so call it from the input event itself: iOS only
 * opens the keyboard for a focus that happens inside a user gesture.
 */
export const FloatingTextInput = (
  mountPoint: HTMLElement,
  x: number,
  y: number,
  onSubmit: OnSubmitHandler,
  initialText = "",
): HTMLInputElement => {
  const container = document.createElement("div");
  container.className = "componentInputContainer";
  container.style.left = `${x + 4}px`;
  container.style.top = `${y - 23}px`;

  const input = document.createElement("input");
  input.className = "componentInput";
  input.type = "text";
  input.enterKeyHint = "done";
  input.value = initialText;
  fitToText(input);
  container.append(input);
  mountPoint.append(container);

  let finished = false;
  const finish = (submit: boolean) => {
    if (finished) return;
    finished = true; // removing the field blurs it; don't finish twice
    container.remove();
    if (submit && input.value) onSubmit(input.value);
  };

  input.addEventListener("input", () => fitToText(input));
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "Enter" || e.key === "Escape") finish(e.key === "Enter");
  });

  input.focus();
  input.select();
  return input;
};

/** Fallback sizing where CSS `field-sizing: content` isn't supported. */
const fitToText = (input: HTMLInputElement) => {
  input.size = Math.max(input.value.length, 1);
};
