# Implementing syntax v2

Status: plan, October 2026. Compares the code on `main` (as of `632a432`)
with [proposal-v2.md](proposal-v2.md), and says where each change goes.

## Where the code is today

The text goes through four stages, and each one knows the v1 syntax:

| Stage | File | What it does now |
| --- | --- | --- |
| Lex and parse | `src/parser/TogetherParser.ts` | Chevrotain grammar for v1: `name [v, e]`, `(attributes)`, `a.b` links, `#` notes, `/command(…)`, `{ }` pipelines, `name:2` definitions |
| Set aside bad lines | `src/parser/lenient.ts` | blanks each line with an error and parses again, up to 50 times |
| Build the model | `src/map/drawMap.ts` (`TogetherVisitorToModel`) | reads only names, positions, pipelines and links; attributes, commands and notes are parsed and thrown away |
| Draw | `drawMap.ts` `reconcile`, `components/Component.tsx`, `components/Line.tsx`, `MapAxes.tsx` | a circle or (pipeline) square with its name; one style of line; fixed axes |
| Write back | `src/editor/edits.ts`, `deletions.ts`, `map/canvasActions.ts` | regexes from `TogetherParser.ts` (`matchComponentRegex` and the `matchEdge…` family) find the lines to change |
| Export | `src/export/scene.ts`, `mapSvg.ts` | redraws `ComponentConfig`s and line ends as SVG |
| Lint | `src/editor/TogetherScriptLinter.ts` | parse errors, and self-links |

Other places that know the syntax:

- `src/help/topics.ts` (`syntaxHelp`)
- `examples/tea-shop.mt`, the demo map
- `examples/mapping-features.mt`
- `docs/syntax/lots-of-components.mt` and `docs/syntax/README.md`
- `nameProblem` in `canvasActions.ts`, with `isComponentName`, which came from `main`
- about 18 test files with map text in them; `drawMap.test.ts`, `edits.test.ts` and `deletions.test.ts` have the most

`src/parser/WardleyParser.ts` reads a sliver of OnlineWardleyMaps (components,
pipelines, `->`). Only `cst.test.ts` uses it.

## The diff, feature by feature

| Feature (v2) | Today | Work |
| --- | --- | --- |
| `head [args] { children }` for every statement | four separate rules, two kinds of brackets | new grammar |
| Arguments: positional, keywords, boolean keywords, commas or spaces | `[v, e]` only, with exactly one comma; `(key=value)` in a separate list | new grammar |
| Values: numbers, strings with `\"` `\\` `\n`, symbols, tuples | numbers, strings without escapes, `a:1,b:2` lists | new grammar |
| Names with `.` `(` `)` `,` `:` `#` and so on; backtick names | names can't hold `. ( ) , : # ^ = < > /` | lexer; `nameProblem` |
| `--` links | `.` | grammar, migration, link tool, rename and delete |
| `"text"` notes | `# text` parsed, not drawn | grammar, model, draw, drag |
| `@map`, `@type`, `@area` and the other directives | `/command(…)` parsed, not drawn | grammar, model |
| `;` between statements | none | grammar |
| Statements across lines inside `[ ]` | only inside `( )` | lexer modes; lenient parsing |
| `type=user/market/ecosystem` | not drawn | model, symbols, export |
| `sourcing`, `inertia`, `evolve` | not drawn | model, symbols, export |
| `form` | none | model only (no drawing proposed) |
| `label="text"`, `label=("text", x, y)`, dragging labels | parsed, not drawn | model, draw, a label drag gesture, number-only edits |
| `constraint`, `flow`, `label` on links | none | `EdgeAttributes`, `Line`, export |
| `pipeline=(from, to)`, childless pipelines | box from children only | `pipelineBox`, model |
| `@map` title, style, stage names and boundaries, axis labels, `hidden` | hard-coded in `MapAxes.tsx` (`evolutionStages`, `stageBoundaries`) | settings store read by `MapAxes` and `mapSvg` |
| No position: placed automatically | drawn at `[10, 10]` | layout rule |
| Lints: unknown keys, bad values, duplicate names, braces on a user, two `@map` | parse errors and self-links | semantic pass |
| v1 → v2 upgrade | none | converter, run once per map |
| OWM import | none | converter, menu and paste |
| Formatter (commas, one argument per line over 80) | none | command |

## Changes that cut across everything

These three decide how the rest is built.

### 1. Edits by source range, not regex

`coordinateChanges` replaces the whole `[…]` with `[v, e]`. In v1 that's
safe, because the position has its own brackets. In v2 the position shares
the brackets with every keyword, so the first drag would delete `inertia`,
`label=…` and the rest. The regexes also can't tell `.` in a name from `.` as
a link. And the proposal asks drags to rewrite only the numbers, so that a
drag and someone typing merge cleanly in Yjs.

So the parser should keep each token's offsets, and edits should replace
exact ranges:

- **Move:** the two positional number tokens.
- **Drag a label:** the two numbers in `label=(…)`. The first drag inserts
  `, label=("Name", x, y)` before `]`.
- **Rename:** each name token. Later, names in strings such as `on=("Kettle")`.
- **Delete:** the statement's lines, from its head to its closing `]` or `}`.
- **Add a link:** append `A -- B`.

This replaces `matchComponentRegex`, `matchEdgeFromRegex`, `matchEdgeToRegex`,
`matchEdgeRegex` and `matchEdgeBetweenRegex`, and `edits.ts` and
`deletions.ts` get rewritten around the parse result. One behaviour changes:
a regex can rename a link on a line that doesn't parse, and a range edit
can't. That's consistent with the map, which leaves those lines out too, and
the linter already marks them.

### 2. Generic statements first, meaning second

Following principle 1, the parser produces the same record for every
statement:

```ts
interface Statement {
  head: { kind: "component" | "link" | "note" | "directive"; names: Token[]; word?: Token };
  positional: Value[];
  keywords: Map<string, { key: Token; value?: Value }>;
  children: Statement[];
  range: { from: number; to: number; fromLine: number; toLine: number };
}
```

A separate pass, `src/model/` (new), turns statements into the map model and
lint diagnostics. It looks up each key in a table: which heads take it, what
values it accepts, and its default. Adding a feature means adding a row to
that table, a field to the model and a drawing. The grammar stays the same.

`drawMap.ts` shrinks to `reconcile` and stops visiting the CST itself.
`TogetherCst.d.ts` (generated CST types) goes, or is regenerated for the
smaller grammar.

### 3. Lenient parsing by statement, not by line

`lenient.ts` blanks the line an error is on. Once arguments can span lines,
blanking one line of a multi-line `[ … ]` leaves an unclosed bracket that
breaks the rest of the map. It should set aside the whole statement: from the
statement's first line to its closing bracket. If the bracket is never
closed, set aside to the next line that starts a statement at the same
indentation. The 50-retry limit can stay.

## Plan

Each phase leaves the app working and shippable. Phase 1 has to ship as one
release, because it changes the link operator under existing maps.

### Phase 1: the switch

No new drawing. The app draws exactly what it draws today, from v2 text.

1. **Grammar** (`src/parser/TogetherParser.ts`, rewritten). Tokens and rules
   for the four heads, `[ ]` and `( )` argument lists, strings with escapes,
   backtick names, `;` and comments. `//` inside a string is not a comment,
   which matters for `url="https://…"`. Keep v1's lexer and parser in a
   separate `src/parser/v1/` for the converter in step 5, then delete it once
   no stored maps are v1.
2. **Statements and model** (`src/model/statements.ts`, `src/model/model.ts`,
   both new). The record above, then a `MapModel` with what's drawn today:
   names, positions, pipelines and links.
3. **Range edits** (`src/editor/edits.ts`, `deletions.ts`). Move, rename and
   delete as above. `canvasActions.ts` writes `\n${from} -- ${to}` for links.
   `edgeEnds` and the internal `"A->B"` keys can stay, since they never reach
   the text.
4. **Lenient parsing by statement** (`src/parser/lenient.ts`).
5. **v1 → v2 converter** (`src/migrate/v1.ts`, new). It must not import DOM or Pixi
   code, so the relay can bundle it too: Wrangler bundles imports from
   outside `relay/`, and `relay/tsconfig.json` needs the path added to
   `include`. It rewrites line by line from
   v1's parse:

   | v1 | v2 |
   | --- | --- |
   | `a.b` | `a -- b` |
   | `a.(t=constraint)b` | `a -- b [constraint]` |
   | `(label=…)` | merged into `[ ]` |
   | `#` notes | `"…"` |
   | `/mapstyle(…)` | `@map [ ]` |
   | `government:2` | `government 2 [label="government"]` |
   | `name^` | `evolve=` |

   Text that doesn't parse as v1 is left alone.
6. **Run the migration once per map, in the relay**
   (`relay/src/store.ts`). The relay keeps a Y.Doc per map
   (`MapStore.doc`). When it loads a saved map, it can check the text and
   convert it, with a flag in a `Y.Map` (`meta.syntax = 2`), before any client
   syncs.

   One writer avoids the failure you'd get from each browser migrating
   itself. Two clients replacing the same text at once in Yjs both insert,
   which leaves the map written twice. Clients that open a map offline, and
   drafts that were never saved, migrate on the client, also guarded by the
   flag.
7. **Name rules** (`isComponentName`, `nameProblem`). Names may now hold
   `. ( ) , : # ^ = < > /`. The message lists what's still excluded:
   `--`, `//`, `[`, `{`, `"`, `;`.
8. **Text people see.** Update `syntaxHelp`, `examples/*.mt`,
   `docs/syntax/lots-of-components.mt`, `docs/syntax/README.md` and the
   test fixtures.
9. **Lint for leftover v1.** A component with no position whose name is
   `A.B`, where `A` and `B` are both components, is almost certainly a pasted
   v1 link. In v2 it would be drawn as a strange new component at the default
   position. Warn, with a quick fix to `A -- B`.

Old cached clients are the risk here. A browser still running v1 code would
write `a.b` into a v2 map. The relay could refuse peers that don't send a new
enough version when they connect. It checks no versions today. Or the app can
reload itself when the map's `meta.syntax` is newer than it knows.

### Phase 2: components

Each item touches the same set of files:

- the key table in `src/model/`
- `ComponentConfig` in `componentLayout.ts`
- `Component.tsx`
- `mapSvg.ts`
- `syntaxHelp`
- tests

`sameShape` in `drawMap.ts` must compare every new drawn property, or
changing one won't redraw.

1. `type=user`, `type=market`, `type=ecosystem`: three symbols. Braces on
   these types get a lint warning.
2. `inertia`: the bar.
3. `sourcing`: the shaded circle.
4. `evolve=80` and `evolve=(80, label=…, sourcing=…)`: the red future
   circle, dashed arrow and future label. Links stay on the current component.
5. `label`: text and offset, and a **label drag gesture** in `gestures.ts`
   and `State.ts`. That gesture is new: today only components can be dragged.
   It needs the number-only edit from the range edits.
6. `form`: stored, with nothing drawn. `MapAxes`' stage names by form
   (`alternatives`) could later read it.
7. No position: placed automatically instead of `[10, 10]`.

**Label glyphs.** `MapSingleton` installs a `BitmapFont` with an ASCII
character list. `main` now allows names in any script, and labels, notes and
link text will hold `£` and the like, so text needs a dynamic bitmap font or
Pixi `Text`. This is worth checking now: names in other scripts probably
draw as missing glyphs already.

### Phase 3: links, pipelines, notes, settings

1. **Links:** `constraint`, `flow` and `label`.
   - `EdgeAttributes` in `Graph.ts` gains the link's keywords.
   - `Line.tsx` draws thick, flow (blue) and labelled lines.
   - `scene.ts` and `mapSvg.ts` carry the style.
   - A link written twice: the first wins, as with components.
2. **Pipeline bounds:** `pipeline=(from, to)`.
   - `pipelineBox` takes a minimum span.
   - A component with `pipeline=` and no braces becomes a pipeline with no
     children.
   - Dragging the box's edges writes the bounds. That's another new gesture.
     It can come after the bounds are drawn.
3. **Notes:** `"text" [v, e]`.
   - A new note component, drawn as text with no marker.
   - Notes can be selected and dragged like components.
   - Today the graph's node key is the component name, so notes need their
     own keys, such as `note:<line>`. Their keys must not collide with names.
4. **`@map` settings:**
   - A valtio settings store, set by the model.
   - `MapAxes.tsx` and `mapSvg.ts` read stage names, boundaries, axis
     labels and `hidden` from it, instead of the constants they import now.
   - The title goes to the page title and the export filename (`exportMap.ts`).
   - Styles: `wardley` and `plain` first; `colour`, `handwritten` and `dark`
     after.

### Phase 4: OnlineWardleyMaps import

- **Converter** (`src/import/owm.ts`, new): OWM text in, v2 text out, per the
  mapping in the proposal.
  - Write it line by line, the way OWM's own parser works. A grammar would
    reject maps that OWM accepts.
  - Keep unmapped lines as `// owm: …` comments.
  - Replace `WardleyParser.ts` and `WardleyCst.d.ts`, which are too partial
    to build on.
  - Test against `examples/owm/` and OWM's documented examples.
- **Entry points:**
  - "Import from OnlineWardleyMaps…" in the overflow menu
    (`src/menu/index.tsx`), which opens the result as a new map.
  - Paste detection in the editor: when pasted text looks like OWM (several
    `component X [0.x, 0.y]` lines), offer to convert it.

### Phase 5: formatter

A command, Shift+Alt+F in the editor, not something that runs on every
change. Running it automatically would rewrite other people's text as they
type. It writes commas, a trailing comma per line, and one argument per line
past 80 characters. Text the canvas writes is already in this form.

### Later

These follow the proposal's "Later" list and use the same path: a key-table
row, then model, drawing, export and help.

- Submaps
- `@area`
- Annotations (`on=`, with the legend position in `@map`)
- `@accelerator` and `@deaccelerator`
- `@type`
- `future`
- `owner`

Each one also turns its `// owm:` comments into real statements: the
importer can convert those lines again as each feature lands.

## Gaps the diff found in the proposal

- **Characters that end a name.** The grammar lists `[`, `{`, `--`, `//`,
  `;` and `"`. It should add `]` and `}` too: otherwise `Tea { Leaf }` on
  one line reads `Leaf }` as a name. A leading `@` should also be excluded,
  since that starts a directive.
- **Links to components that don't exist.** Today they're left off the map,
  silently. The proposal should say so, and the linter should warn.
- **Rounding.** The canvas writes positions to one decimal place
  (`mapCoordinates`). The proposal could say that's the canonical precision.
- **Position omitted.** "Placed automatically" needs a rule: a free spot
  near the components it links to, or a fixed spot as today.

## Order and size

| Phase | Depends on | Size |
| --- | --- | --- |
| 1. The switch | — | large: grammar, model, edits, lenient parsing, migration, about 18 test files |
| 2. Components | 1 | medium; the label drag is the biggest part |
| 3. Links, pipelines, notes, settings | 1 | medium |
| 4. OWM import | 1; more of it maps after 2 and 3 | small to medium |
| 5. Formatter | 1 | small |

Phases 2, 3 and 4 touch mostly different files (`Component.tsx`, then
`Line.tsx` and `MapAxes.tsx`, then `src/import/`), so they can go in
parallel once phase 1 has landed. The key table in `src/model/` is the
shared file; each phase adds rows to it.
