import { useSnapshot } from "valtio";

import { mapSettings } from "../state/Settings";

/**
 * What each evolution stage is called for each kind of component (Wardley's
 * characteristics table).
 */
const stageAlternatives = [
  [
    ["Activities", "Genesis"],
    ["Practices", "Novel"],
    ["Data", "Unmodelled"],
    ["Knowledge", "Concept"],
  ],
  [
    ["Activities", "Custom-Built"],
    ["Practices", "Emerging"],
    ["Data", "Divergent"],
    ["Knowledge", "Hypothesis"],
  ],
  [
    ["Activities", "Product (+rental)"],
    ["Practices", "Good"],
    ["Data", "Convergent"],
    ["Knowledge", "Theory"],
  ],
  [
    ["Activities", "Commodity (+utility)"],
    ["Practices", "Best"],
    ["Data", "Modelled"],
    ["Knowledge", "Accepted"],
  ],
] as const;

/** Where each stage begins and the last ends, in evolution (0–100), from the stage boundaries. */
export const stageEdges = (stages: readonly number[]) => [0, ...stages, 100];

/**
 * Dashed stage boundaries, drawn beneath the (transparent) map canvas so
 * components and their labels paint over them.
 */
export function StageDividers() {
  const { stages } = useSnapshot(mapSettings);
  return stages.map((boundary) => (
    <span key={boundary} className="axis-x-divider" style={{ left: `${boundary}%` }} />
  ));
}

/**
 * Evolution (x) and visibility (y) axes drawn over the map canvas, labelled
 * as `@map` says. Each stage also shows its names for each kind of component.
 */
export function MapAxes() {
  const { evolution, stages, visibility } = useSnapshot(mapSettings);
  const edges = stageEdges(stages);
  const [top, bottom] = visibility;
  return (
    <>
      <div className="axis-y">
        {top && <span className="axis-y-label">{top}</span>}
        {bottom && <span className="axis-y-label end">{bottom}</span>}
      </div>
      <div className="axis-x">
        {evolution.map((name, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: stages are positional; names may repeat or be blank.
            key={i}
            className={`axis-x-stage${i === 0 ? " first" : ""}${
              i === evolution.length - 1 ? " last" : ""
            }`}
            style={{
              left: `${edges[i]}%`,
              width: `${edges[i + 1] - edges[i]}%`,
            }}
          >
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focus shows the stage's other names, for keyboard users. */}
            <span className="axis-x-label" tabIndex={0}>
              {name}
              <span className="axis-x-popover" role="tooltip">
                <table>
                  <tbody>
                    {stageAlternatives[i].map(([type, other]) => (
                      <tr key={type}>
                        <th>{type}</th>
                        <td>{other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </span>
            </span>
          </span>
        ))}
      </div>
    </>
  );
}
