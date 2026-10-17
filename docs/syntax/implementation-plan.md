# Implementing syntax v2

Status: phases 1–4 done (5.0 to 5.3), October 2026; phase 5 is next. Compares
the code on `main` (as of `632a432`) with [proposal-v2.md](proposal-v2.md),
and says where each change goes, so "today" below means before phase 1.

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

`src/parser/WardleyParser.ts` read a sliver of OnlineWardleyMaps (components,
pipelines, `->`), and only `cst.test.ts` used it. Phase 4 replaced both with
`src/import/owm.ts`.

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
| Lints: unknown keys, bad values, duplicate names, links to undeclared components, braces on a user, two `@map` | parse errors and self-links | semantic pass |
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

Each phase leaves the app working and shippable. There's no backwards
compatibility: v1 stops being read at the switch, and the few existing maps
are converted by hand.

### Phase 1: the switch

No new drawing. The app draws exactly what it draws today, from v2 text.

1. **Grammar** (`src/parser/TogetherParser.ts`, rewritten). Tokens and rules
   for the four heads, `[ ]` and `( )` argument lists, strings with escapes,
   backtick names, `;` and comments. `//` inside a string is not a comment,
   which matters for `url="https://…"`. v1's grammar is deleted.
2. **Statements and model** (`src/model/statements.ts`, `src/model/model.ts`,
   both new). The record above, then a `MapModel` with what's drawn today:
   names, positions, pipelines and links.
3. **Range edits** (`src/editor/edits.ts`, `deletions.ts`). Move, rename and
   delete as above. `canvasActions.ts` writes `\n${from} -- ${to}` for links.
   `edgeEnds` and the internal `"A->B"` keys can stay, since they never reach
   the text.
4. **Lenient parsing by statement** (`src/parser/lenient.ts`).
5. **Name rules** (`isComponentName`, `nameProblem`). Names may now hold
   `. ( ) , : # ^ = < > /`. The message lists what's still excluded:
   `--`, `//`, `[`, `]`, `{`, `}`, `"`, `;`, and a leading `@`.
6. **Text people see.** Update `syntaxHelp`, `examples/*.mt`,
   `docs/syntax/lots-of-components.mt`, `docs/syntax/README.md` and the
   test fixtures.

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

## Decided since

These were gaps in the proposal. It now says:

- **A name ends at** `]` and `}` as well as `[`, `{`, `--`, `//`, `;` and
  `"`, and can't start with `@`.
- **A link to a component that isn't declared** is kept in the text and not
  drawn, with a lint warning on its line. A warning doesn't stop the map
  drawing or the canvas acting on it, the same as today's self-link warning.
- **Positions are written to one decimal place**, as `mapCoordinates` does
  now: `[98.3, 41.5]`.
- **A component with no position** is drawn at `[10, 10]`, as today.

## History, and whether to make the core an edit log

The question: should the core be an append-only log of what people do, with
both the text and the map materialised from it? That would make time travel
easier, and clients would only forward their own actions.

**Most of that is already true, because Yjs is that log.** In the terms of
[the universal theory](https://innerlattice.com/universal-theory-of-interactive-software):

- A Yjs update is a record. Each item has an id (`clientID`, `clock`) and is
  never changed. A delete marks items; it doesn't remove them.
- Clients already forward only their own records, and replicas merge them by
  union.
- The text is a function of the records, and the map is a function of the
  text (`drawMap`).

Two things are missing:

1. **Garbage collection is on.** Both `new Y.Doc()` calls
   (`src/editor/Editor.ts:80`, `relay/src/store.ts:21`) throw deleted text
   away, so past versions can't be rebuilt.
2. **A canvas action is stored only as its text patch.** A drag is recorded as
   characters changing, not as "Aya moved Kettle".

**A full action log is a large change, and I don't think it's better.**
Typing is a record of characters; a drag is a record of meaning. To
materialise one text from both, a deterministic function has to apply "move
Kettle" to text that someone may be typing into at the same moment. The
theory calls that order-coupled: it needs a sequencer (the relay), with
provisional local state and rollback while you wait. That means writing the
merge Yjs already does.

The other route is to parse every keystroke into actions. That can't represent
half-typed lines, comments or someone's formatting, and printing the text back
from actions would rewrite other people's lines as they type. [The languages
article](https://innerlattice.com/universal-languages-for-interactive-software)
keeps the text as the program and derives everything from it, which is this
app's design already (principle 2 in the proposal).

**What to do instead, all Yjs-native:**

| Step | Change | When |
| --- | --- | --- |
| Keep history | `new Y.Doc({ gc: false })` in both places | now: every day with GC on loses history for good |
| Named snapshots | a `Y.Array` of `{name, snapshot: Y.encodeSnapshot(Y.snapshot(doc)), by, at}` | any time |
| Time travel | `Y.createDocFromSnapshot(doc, snapshot)` → text → `drawMap`, read-only | any time |
| Scenarios | a new room started from `Y.encodeStateAsUpdate` of a snapshot | any time |
| Who did what | a `Y.Map` from `clientID` to the person's name | any time |
| Intent records | canvas actions append `{kind: "move", name, to, by}` to a `Y.Array`, in the same transaction as their text patch | after the language |

With intent records, the text patch stays the materialised effect, and the
record says what the person did. That gives history like "Aya moved Kettle",
and replay, without making the text derived.

Intents come after the language because they name statements and keys, and
the v2 statement record is what they'd point at. Meanwhile, keep canvas edits
as pure functions of `(text, intent)` → changes, as `moveChanges` already is.
That's the function that would materialise an intent if this ever goes
further.

**Cost of keeping history.** The relay caps a saved map at about 2 MB
(`MAX_DOC_BYTES`). Maps are a few KB, and a drag rewrites about ten
characters, so it would take a very long history to reach the cap. When one
does, compacting means starting a fresh doc from the current text and keeping
the old one as an archive. The theory article lists compaction against replay
as an open problem too.

## Order and size

| Phase | Depends on | Size |
| --- | --- | --- |
| 1. The switch | — | large: grammar, model, edits, lenient parsing, about 18 test files |
| 2. Components | 1 | medium; the label drag is the biggest part |
| 3. Links, pipelines, notes, settings | 1 | medium |
| 4. OWM import | 1; more of it maps after 2 and 3 | small to medium |
| 5. Formatter | 1 | small |

Phases 2, 3 and 4 touch mostly different files (`Component.tsx`, then
`Line.tsx` and `MapAxes.tsx`, then `src/import/`), so they can go in
parallel once phase 1 has landed. The key table in `src/model/` is the
shared file; each phase adds rows to it.
