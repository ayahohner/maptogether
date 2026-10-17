import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../model/model";
import { setMapSettings } from "../state/Settings";
import { MapAxes, StageDividers } from "./MapAxes";

it("labels each evolution stage with its alternatives and marks the divisions", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () =>
    createRoot(host).render(
      <>
        <StageDividers />
        <MapAxes />
      </>,
    ),
  );
  const dividers = [...host.querySelectorAll<HTMLElement>(".axis-x-divider")];
  expect(dividers.map((d) => d.style.left)).toEqual(["17.4%", "40%", "70%"]);
  const labels = [...host.querySelectorAll(".axis-x-label")];
  expect(labels.map((l) => l.firstChild!.textContent)).toEqual([
    "Genesis",
    "Custom",
    "Product",
    "Commodity",
  ]);
  expect(labels[0].querySelector('[role="tooltip"]')!.textContent).toBe(
    "ActivitiesGenesisPracticesNovelDataUnmodelledKnowledgeConcept",
  );
  expect(host.querySelector(".axis-y-label")!.textContent).toBe("Visibility");
});

it("follows @map: stage names, boundaries and the visibility axis's ends", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () =>
    createRoot(host).render(
      <>
        <StageDividers />
        <MapAxes />
      </>,
    ),
  );
  await act(async () =>
    setMapSettings({
      ...DEFAULT_SETTINGS,
      evolution: ["A", "B", "C", "D"],
      stages: [10, 50, 80],
      visibility: ["Visible", "Invisible"],
    }),
  );
  const dividers = [...host.querySelectorAll<HTMLElement>(".axis-x-divider")];
  expect(dividers.map((d) => d.style.left)).toEqual(["10%", "50%", "80%"]);
  const labels = [...host.querySelectorAll(".axis-x-label")];
  expect(labels.map((l) => l.firstChild!.textContent)).toEqual(["A", "B", "C", "D"]);
  const ends = [...host.querySelectorAll(".axis-y-label")];
  expect(ends.map((e) => e.textContent)).toEqual(["Visible", "Invisible"]);
  await act(async () => setMapSettings({ ...DEFAULT_SETTINGS, evolution: [], visibility: [] }));
  expect(host.querySelectorAll(".axis-x-label, .axis-y-label")).toHaveLength(0);
  await act(async () => setMapSettings(DEFAULT_SETTINGS));
});
