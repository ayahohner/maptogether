import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, expect, it } from "vitest";
import { owmPasteOffer } from "./owmPaste";

const OWM = "component Kettle [0.43, 0.35]\ncomponent Power [0.1, 0.7]";

let view: EditorView;
const open = (doc = "Tea [50, 50]\n") => {
  view = new EditorView({
    state: EditorState.create({ doc, extensions: owmPasteOffer() }),
    parent: document.body,
  });
};
afterEach(() => view.destroy());

const paste = (text: string, at = view.state.doc.length) =>
  view.dispatch({ changes: { from: at, insert: text }, userEvent: "input.paste" });
const offer = () => view.dom.querySelector(".cm-owm-offer");
const click = (label: string) =>
  [...offer()!.querySelectorAll("button")].find((b) => b.textContent === label)!.click();

it("offers to convert pasted OnlineWardleyMaps text, and converts only that", () => {
  open();
  paste(OWM);
  expect(offer()?.textContent).toContain("OnlineWardleyMaps");
  click("Convert it");
  expect(view.state.doc.toString()).toBe("Tea [50, 50]\nKettle [43, 35]\nPower [10, 70]");
  expect(offer()).toBeNull();
});

it("follows the pasted text through later edits", () => {
  open();
  paste(OWM);
  view.dispatch({ changes: { from: 0, insert: "// Tea shop\n" } });
  click("Convert it");
  expect(view.state.doc.toString()).toBe(
    "// Tea shop\nTea [50, 50]\nKettle [43, 35]\nPower [10, 70]",
  );
});

it("keeps the pasted text as it is when asked", () => {
  open();
  paste(OWM);
  click("Keep it");
  expect(offer()).toBeNull();
  expect(view.state.doc.toString()).toBe(`Tea [50, 50]\n${OWM}`);
});

it("drops the offer once the pasted text is deleted", () => {
  open();
  paste(OWM);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length } });
  expect(offer()).toBeNull();
});

it("offers nothing for typed text or other pastes", () => {
  open();
  view.dispatch({ changes: { from: 0, insert: OWM } });
  paste("Kettle [43, 35]\nPower [10, 70]");
  expect(offer()).toBeNull();
});
