export type OnSubmitHandler = (value: string) => void;

/** What's wrong with a value, if anything. */
export type Problem = (value: string) => string | undefined;

/**
 * A text field over the map, for naming a new component or renaming one.
 * Enter or clicking away submits; Escape cancels. A value with a `problem`
 * is marked as it is typed, and is never submitted.
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
  problem: Problem = () => undefined,
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

  const value = () => input.value.trim();
  const valid = () => !problem(value());

  let finished = false;
  const finish = (submit: boolean) => {
    if (finished) return;
    finished = true; // removing the field blurs it; don't finish twice
    container.remove();
    if (submit && value() && valid()) onSubmit(value());
  };

  const check = () => showProblem(input, value() && problem(value()));

  input.addEventListener("input", () => {
    fitToText(input);
    check();
  });
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "Escape") finish(false);
    else if (e.key === "Enter") valid() ? finish(true) : check();
  });

  input.focus();
  input.select();
  return input;
};

const showProblem = (input: HTMLInputElement, problem: string | undefined) => {
  input.setAttribute("aria-invalid", String(Boolean(problem)));
  input.title = problem ?? "";
};

/** Fallback sizing where CSS `field-sizing: content` isn't supported. */
const fitToText = (input: HTMLInputElement) => {
  input.size = Math.max(input.value.length, 1);
};
