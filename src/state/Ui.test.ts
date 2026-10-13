import { beforeEach, expect, it } from "vitest";
import { closeHelp, openHelp, setHelpTopic, toggleHelp, ui } from "./Ui";

beforeEach(closeHelp);

it("opens help on the canvas topic unless given another", () => {
  openHelp();
  expect(ui.help).toEqual({ open: true, topic: "canvas" });
  openHelp("code");
  expect(ui.help).toEqual({ open: true, topic: "code" });
});

it("toggles help closed, and open again on the canvas topic", () => {
  openHelp();
  setHelpTopic("code");
  toggleHelp();
  expect(ui.help.open).toBe(false);
  toggleHelp();
  expect(ui.help).toEqual({ open: true, topic: "canvas" });
});
