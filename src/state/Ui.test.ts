import { expect, it } from "vitest";
import { closeHelp, openHelp, setHelpTopic, toggleHelp, trackHelpTopic, ui } from "./Ui";

it("opens help on the topic of the pane last worked in", () => {
  document.body.innerHTML = `<div id="map"><canvas></canvas></div>
    <div id="editorContainer"><div class="cm-content"></div></div><p id="other"></p>`;
  const stop = trackHelpTopic();
  const press = (selector: string) =>
    document.querySelector(selector)!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  press(".cm-content");
  expect(ui.lastTopic).toBe("code");
  press("#other");
  expect(ui.lastTopic).toBe("code");
  press("canvas");
  expect(ui.lastTopic).toBe("canvas");
  toggleHelp();
  expect(ui.help).toEqual({ open: true, topic: "canvas" });
  setHelpTopic("code");
  toggleHelp();
  expect(ui.help.open).toBe(false);
  openHelp("code");
  expect(ui.help).toEqual({ open: true, topic: "code" });
  closeHelp();
  stop();
  press(".cm-content");
  expect(ui.lastTopic).toBe("canvas");
});
