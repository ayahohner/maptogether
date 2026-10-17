import { type Extension, StateEffect, StateField } from "@codemirror/state";
import { EditorView, type Panel, showPanel } from "@codemirror/view";
import { importOwm, looksLikeOwm } from "../import/owm";

type Pasted = { from: number; to: number } | null;

const dismiss = StateEffect.define<null>();

/** Where OnlineWardleyMaps text was pasted, while the offer to convert it stands. */
const pasted = StateField.define<Pasted>({
  create: () => null,
  update(range, tr) {
    if (tr.effects.some((effect) => effect.is(dismiss))) return null;
    let found: Pasted = null;
    if (tr.isUserEvent("input.paste"))
      tr.changes.iterChanges((_fromA, _toA, from, to, inserted) => {
        if (looksLikeOwm(inserted.toString())) found = { from, to };
      });
    if (found || !range || !tr.docChanged) return found ?? range;
    const from = tr.changes.mapPos(range.from, 1);
    const to = tr.changes.mapPos(range.to, -1);
    return from < to ? { from, to } : null;
  },
  provide: (field) => showPanel.from(field, (range) => (range ? offer : null)),
});

/** Replaces the pasted text with its conversion. */
const convert = (view: EditorView) => {
  const range = view.state.field(pasted);
  if (!range) return;
  const { text } = importOwm(view.state.sliceDoc(range.from, range.to));
  view.dispatch({
    changes: { ...range, insert: text },
    effects: dismiss.of(null),
    userEvent: "input.convert",
  });
};

const button = (label: string, onClick: () => void, primary = false) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = primary ? "btn btn-primary" : "btn btn-ghost";
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
};

function offer(view: EditorView): Panel {
  const dom = document.createElement("div");
  dom.className = "cm-owm-offer";
  dom.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = "That looks like OnlineWardleyMaps text.";
  dom.append(
    text,
    button("Convert it", () => convert(view), true),
    button("Keep it", () => view.dispatch({ effects: dismiss.of(null) })),
  );
  return { dom, top: true };
}

const theme = EditorView.baseTheme({
  ".cm-owm-offer": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
  },
  ".cm-owm-offer span": { marginRight: "auto" },
});

/** Offers to convert OnlineWardleyMaps text pasted into the editor. */
export const owmPasteOffer = (): Extension => [pasted, theme];
