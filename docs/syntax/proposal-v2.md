# Proposal: MapTogether syntax v2

Status: draft for discussion, October 2026. Nothing here is implemented.

This proposes one syntax that covers everything usually drawn on a Wardley
map, plus map settings, extensions and nesting. It keeps what works in today's
syntax (`Kettle [33, 50]`, braces for pipelines) and replaces the parts of the
[2022 drafts](drafts.mt) that grew one rule at a time (`.(…)` link
attributes, `:2` definition IDs, `/mapstyle(…)`, `#` notes, the `^` suffix).

## The short version

Every statement has the same shape:

```
head [arguments] { children }
```

Only the **head** varies, and its first character says which of four kinds it
is:

| Head | Kind | Example |
| --- | --- | --- |
| a name | component | `Kettle [33, 50 build]` |
| `name -> name` | link | `Kettle -> Power [constraint]` |
| `"text"` | note | `"Hot water is obvious" [48, 85]` |
| `@word` | directive (settings, definitions) | `@map [title="Tea Shop"]` |

Both `[arguments]` and `{ children }` are optional. Arguments work like HTML
attributes: positional numbers first, then bare words (`market`) and
`key=value` pairs in any order. Commas are whitespace, as in Clojure, so `[33, 50]` and
`[33 50]` are the same and today's maps keep parsing.

A whole map:

```
// Tea shop
@map [
  title="Tea Shop"
  style=wardley
]

Business [95, 46 user]
Public [95, 72 user]
Cup of Tea [80, 62]
Cup [69, 86 buy]
Staff [62, 28 build inertia]
Tea [55, 73] {
  Loose Leaf [56]
  Tea Bags [90 outsource]
}
Hot Water [41, 88]
Water [22, 91]
Kettle [33, 50 evolve=80 label-offset=(-40, 10)]
Power [10, 86 market accelerate]

Business -> Cup of Tea [flow label="£1.20"]
Public -> Cup of Tea
Cup of Tea -> Cup
Cup of Tea -> Tea
Cup of Tea -> Hot Water
Cup of Tea -> Staff
Hot Water -> Water
Hot Water -> Kettle [constraint]
Kettle -> Power

Front of house [area settlers] {
  Staff
  Cup
}

"Standardised power lets kettles evolve" [on=(Kettle, Power)]
"Hot water is obvious" [48, 85]
```

## Design principles

These decide the open questions below, so they come first.

1. **One shape for everything.** Every statement parses to the same record:
   `{head, positional, attributes, children}`. The parser doesn't need to know
   what `market` or `@map` mean; a later pass does, from a vocabulary table.
   New features become new vocabulary, not new grammar, which is how the
   syntax stays extensible without breaking. [KDL](https://kdl.dev) is the
   closest prior art: `node 1 2 key="value" { child }`. We bracket the
   arguments because our names contain spaces and KDL's don't.
2. **The text is co-edited by the canvas.** Dragging, renaming and linking all
   rewrite the text (`src/editor/edits.ts`), several people edit it at once
   over Yjs, and a broken line is blanked so the rest of the map still draws
   (`src/parser/lenient.ts`). So: one fact per line, the position always in
   the same place (the leading numbers), no constructs where one canvas edit
   would rewrite a line someone else is typing in, and errors that stay on
   their own line.
3. **Separate what a thing is from how it is drawn.** `market` is what a
   component *is*; `color="#f80"` is how it's drawn. `build` is a sourcing
   decision, not a kind of component. Identity (the name) is separate from
   display text (`label=`).
4. **One obvious way to write each thing.** Each feature gets one canonical
   form, with one bare-word shorthand that a formatter can expand or collapse.
   No aliases (`anchor` *and* `user`, `buy` *and* `use`).
5. **Readable by people who don't program.** Mappers aren't programmers. Names
   need no quotes, the common case needs no keys, and there are no
   abbreviations (`label-offset`, not `l`).

## Grammar

```ebnf
document   = { statement-end | statement } ;
statement  = head [ arguments ] [ block ] statement-end ;
statement-end = newline | ";" | EOF ;

head       = link | directive | note | name ;
link       = name "->" name ;
directive  = "@" word [ name ] ;
note       = string ;

arguments  = "[" { positional } { flag | property } "]" ;   (* newlines allowed inside *)
positional = number | tuple ;
flag       = word ;
property   = key "=" value ;
value      = number | string | tuple | word ;
tuple      = "(" { value } ")" ;
block      = "{" { newline | statement } "}" ;

name       = plain-name | "`" { any char except "`" } "`" ;
plain-name = name-char { name-char | " " name-char } ;     (* no "->" or "//" inside *)
key        = word ;                                        (* letters, digits, "-", ":" *)
comment    = "//" { any char } ;                           (* anywhere a newline could go *)
```

Notes on the grammar:

- **Commas are whitespace** inside `[ ]` and `( )`, so `(43, 49)` and `(43 49)`
  are the same tuple. This avoids having commas between positional arguments
  but spaces between attributes.
- **Positional arguments come first.** That keeps the position in a fixed
  place for the canvas to rewrite, and makes `[33, 50 inertia]` read in one
  direction.
- **Names need no quotes.** A name ends at `[`, `{`, `->`, `//`, `;` or the end
  of the line, and surrounding spaces are trimmed. In the rare case that a
  name contains one of those, wrap it in backticks: `` `C#->IL` [40, 60] ``.
  Backticks escape names (as in Kotlin and Swift); double quotes are always
  prose. So `"Kettle"` is a note that says "Kettle", not a component.
- **Newlines end statements**, except inside `[ ]` and `( )`. `;` separates
  statements on one line: `Tea [55, 73] { Loose Leaf [56]; Tea Bags [90] }`.
- **Values** are numbers (`34.5`, `-10`), strings (`"apple"`, `"#ff0"`),
  tuples (`(23.4, 34.3, 100)`) and words (`build`, `true`). Colours and URLs
  are strings. A bare word on its own is a flag (see below).

## Components

```
Kettle [33, 50]                       // visibility 33, evolution 50
Kettle [33, 50 build inertia]
Kettle [33, 50 sourcing=build inertia=true]   // the same, written out
Kettle                                // no position yet: laid out automatically
```

Positions stay `[visibility, evolution]` from 0 to 100. That order is
backwards from (x, y), but OnlineWardleyMaps, Mermaid and today's maps all use
it, and changing it would quietly break every map anyone pastes in.

A component with no position is placed automatically (visibility from its
depth in the value chain, evolution at the middle of the axis). This helps
quick sketches and maps generated by LLMs. Dragging it on the canvas writes a
position in.

### Bare words resolve through a vocabulary

A bare word like `market` is shorthand for one attribute's value. The parser
reads it as a flag; a lookup table then decides which attribute it belongs to:

| Word | Means | Notes |
| --- | --- | --- |
| `user` | `type=user` | the anchor at the top of the chain |
| `market` | `type=market` | Wardley's circle of three circles |
| `ecosystem` | `type=ecosystem` | concentric circles |
| `practice`, `data`, `knowledge` | `kind=…` | the default kind is `activity` |
| `build`, `buy`, `outsource` | `sourcing=…` | drawn as a shaded circle |
| `inertia` | `inertia=true` | `inertia=70` puts the bar at evolution 70 |
| `accelerate`, `decelerate` | `force=…` | the thick hollow arrow |
| `pipeline`, `submap` | `nesting=…` | how the children are drawn; see Nesting |
| `area` | `type=area` | a boundary drawn around its children |
| `pioneers`, `settlers`, `townplanners` | `attitude=…` | on an `area` |
| `constraint`, `flow` | link `type=…` | see Links |

This handles your point about build/buy/outsource: they're values of
`sourcing`, not component types, but you can still write `Cup [69, 86 buy]`
because `buy` belongs to only one attribute. It's how CSS shorthands work
(`border: 1px solid red` works out which value is which from the value).

The rules:

- A word must belong to exactly one attribute. Core words are reserved, so an
  extension can't define a second `build`.
- Two values for the same attribute (`[build buy]`) are a lint error. The last
  one wins so the map still draws.
- An unknown word is kept as `word=true` and flagged as a lint warning, not an
  error, so maps written for a newer version still open.
- The formatter can expand `buy` to `sourcing=buy`, or collapse it back.

### Component attributes

| Attribute | Value | Meaning |
| --- | --- | --- |
| position | `[vis, evo]` | first two positional numbers |
| `type` | `component` (default), `user`, `market`, `ecosystem`, `area`, or a `@type` | what it is; sets the symbol |
| `kind` | `activity` (default), `practice`, `data`, `knowledge` | Wardley's four things that evolve; changes the stage names shown on hover |
| `sourcing` | `build`, `buy`, `outsource` | method notation |
| `inertia` | `true` or an evolution number | the black bar |
| `evolve` | evolution number, or `(vis, evo)` | the future position: red circle and red dashed arrow |
| `force` | `accelerate`, `decelerate` | Wardley's accelerator and deaccelerator arrows |
| `label` | string | display text, if it should differ from the name |
| `label-offset` | `(x, y)` | where the label sits; written by dragging the label |
| `description` | string | shown on hover and in exports |
| `url` | string | links out; on a `submap`, the map to open |
| `color` | string | presentation only |

### Identity and labels

The name is the component's identity. Links refer to it, and it must be unique
in the document. Today's `government:2` definition IDs go away: if two
components should read the same, give them different names and the same label:

```
Gov (national) [90, 60 label="Government"]
Gov (local) [70, 55 label="Government"]
```

Writing the same name twice merges the two statements, the way Graphviz does.
Only one of them may give a position. That's what lets an area list members
that are positioned elsewhere (see Nesting).

## Links

```
Cup of Tea -> Hot Water
Hot Water -> Kettle [constraint]
Business -> Cup of Tea [flow label="£1.20"]
Kettle -> Power [label="needs 3kW"]
```

`needer -> needed`, the same direction as today's `needer.needed`. The arrow
replaces the dot because:

- `.` is common in names: `Node.js`, `v2.1`, `St. Ives`.
- `->` shows direction, and it is what OnlineWardleyMaps and Mermaid use, so
  maps pasted from either are already mostly right.

There is one arrow. The kind of link is an attribute, rather than a family of
operators like OnlineWardleyMaps' `+>`, `+<`, `+<>` and `+'label'>`:

| Attribute | Value | Draws |
| --- | --- | --- |
| `type` | `dependency` (default), `constraint`, `flow` | thin line, thick line, blue flow |
| `direction` | `forward` (default), `back`, `both` | for a flow: value moves from needed to needer by default |
| `influence` | `positive`, `negative` | Kino Wardley's `+v>` and `-v>` |
| `future` | flag | red "line of the future" |
| `label` | string | text along the line |

No chains (`A -> B -> C`) and no fan-out (`A -> B, C`). They save typing, but
then deleting one link on the canvas means rewriting a line that holds several
links, possibly while someone else is editing it. One link per line keeps
every canvas edit to a single line.

## Notes and annotations

A quoted string as the head is a note: prose, not a thing on the map.

```
"Hot water is obvious" [48, 85]                          // a note at a point
"Standardised power lets kettles evolve" [on=(Kettle, Power)]   // numbered annotation
```

- With a position, it's a free note, dragged like a component.
- With `on=` (component names, or `(vis, evo)` tuples), it's a numbered
  annotation. The numbers are given in document order and the text goes in the
  legend. `marker=3` fixes a number.

The 2022 draft used `#` for notes. That reads as a heading or a comment to
most people now, so it's freed up. `//` stays the only comment.

## Nesting

Braces mean "contains". How the children are drawn depends on the parent's
`nesting` or `type`, never on what the children happen to be.

**Pipeline** (the default for a positioned component, as today):

```
Tea [55, 73] {
  Loose Leaf [56]
  Tea Bags [90]
}
```

Children sit on the pipeline's row, so they take only an evolution: one
number. The pipeline's box spans its children, so it needs no start and end of
its own (OnlineWardleyMaps' `pipeline Tea [0.15, 0.9]`). A two-number position
inside a pipeline is a lint warning, and its visibility is ignored, which keeps
today's maps drawing.

**Submap**: a component that stands for a whole map. Its children use the
submap's own coordinates and are shown when you open it:

```
Ordering [70, 55 submap] {
  Till [80, 70]
  Card Reader [40, 85 buy]
  Till -> Card Reader
}
Payments [60, 70 submap url="https://maptogether.io/r/abc123"]
```

**Area**: a boundary drawn around its members, with no position of its own.
Use it for areas of interest, teams, and pioneers, settlers and town planners:

```
Front of house [area settlers color="#9cf"] {
  Staff
  Cup
}
```

Members can be declared inside, or listed by name if they're declared
elsewhere (names merge; see Identity). So a component can be in more than one
area, which nesting alone couldn't allow.

All names share one namespace, including names inside submaps, so links can
cross boundaries: `Cup of Tea -> Till`.

## Map settings

Settings are attributes on the map itself, with the `@map` directive:

```
@map [
  title="Tea Shop"
  perspective="the shop owner"
  created="2026-10-14"
  style=wardley                                    // wardley | plain | handwritten | dark
  evolution=("Genesis", "Custom built", "Product", "Commodity")
  stages=(17.4, 40, 70)                            // where the stage boundaries fall
  visibility=("Visible", "Invisible")
  kind=practice                                    // stage names for practices
]
```

This is one statement over several lines, so it's still one place to look. But
each setting is on its own line, so two people changing different settings
don't collide. `kind=` here picks Wardley's stage names for the whole map
(Novel → Emerging → Good → Best for practices), and `evolution=` overrides
them.

`@map` should go at the top, but doesn't have to. If there are two, they merge
like components do.

## Extensions

Three layers, from cheapest to most powerful.

**1. Unknown attributes are kept.** `Kettle [33, 50 risk=3 owner="Ops"]`
parses, survives canvas edits and the formatter, appears in exports, and is
shown on hover. The renderer ignores what it doesn't know. Extensions can
namespace their keys: `doctrine:principle="Use a common language"`.

**2. `@type` defines new kinds of component**, using the same shape:

```
@type regulator [base=component shape=hexagon color="#a33"]
@type platform [base=ecosystem]

FCA [70, 40 regulator]
AWS [20, 80 platform]
```

`regulator` becomes a value of `type`, so the bare word works. `base=` says
how to draw it if nothing more specific is known, and which rules apply (a
`platform` is still an ecosystem to anything that checks for one).

**3. `@use` pulls in a shared vocabulary or template** (later):

```
@use "maptogether.io/v/doctrine"
```

Not every map needs a package system. Adding it later is possible because
it's just another directive.

### Futures and scenarios (later)

`evolve=80` covers the common case: one component moving right. Wardley maps
also show *lines of the future*, new components and changed dependencies. One
way to do that, with nothing new in the grammar, is a directive whose children
overlay the map:

```
@future {
  Kettle [33, 80]              // same name: drawn as Kettle's future position
  Smart Kettle [45, 30]        // new name: a future component, in red
  Smart Kettle -> Power        // a line of the future
}
```

Named scenarios (`@future "Cloud first" { … }`) that the viewer can switch
between would fall out of the same idea. This is the part I'm least sure of,
so it's listed as an open question.

## What changes from today

| Today | v2 | Why |
| --- | --- | --- |
| `Kettle [33, 50]` | unchanged | |
| `Kettle [33, 50] (label=-40,10)` | `Kettle [33, 50 label-offset=(-40, 10)]` | one bracket for everything about a component |
| `needer.needed` | `needer -> needed` | dots appear in names; arrow shows direction |
| `a.(t=constraint)b` | `a -> b [constraint]` | attributes go after, as on components |
| `Tea [55, 73] { Loose Leaf [55, 56] }` | `Tea [55, 73] { Loose Leaf [56] }` | old form still draws, with a warning |
| `/mapstyle(title="…")` | `@map [title="…"]` | one directive sigil |
| `# note [40, 50]` | `"note" [40, 50]` | `#` reads as a heading |
| `government:2` | a distinct name plus `label=` | identity separate from display text |
| `name^` | `evolve=` or `@future { }` | |

Since the current parser reads the old syntax, the upgrade can be automatic:
detect a v1 map (any `a.b` link or `(…)` attribute block), rewrite it once,
and keep the old text in the room's history. A first-line `@map [syntax=2]`
could make it explicit, but it shouldn't be needed.

### Importing OnlineWardleyMaps

Almost everything maps across directly (coordinates × 100):

| OnlineWardleyMaps | v2 |
| --- | --- |
| `component Kettle [0.33, 0.5]` | `Kettle [33, 50]` |
| `anchor Business [0.95, 0.46]` | `Business [95, 46 user]` |
| `market Power [0.1, 0.86]` | `Power [10, 86 market]` |
| `component Kettle [0.33, 0.5] inertia` | `Kettle [33, 50 inertia]` |
| `evolve Kettle 0.8` | `evolve=80` on Kettle |
| `build Kettle`, `(buy)` | `build`, `buy` on Kettle |
| `pipeline Tea [0.15, 0.9]` | braces on Tea |
| `A->B`, `A+>B`, `A+'£1'>B` | `A -> B`, `[flow]`, `[flow label="£1"]` |
| `A->B; text` | `A -> B [label="text"]` |
| `note text [0.4, 0.5]` | `"text" [40, 50]` |
| `annotation 1 [[.4,.5],[.3,.6]] text` | `"text" [on=((40, 50), (30, 60)) marker=1]` |
| `pioneers [0.59, 0.43, 0.49, 0.63]` | an `area pioneers` with members (a fixed rectangle via `bounds=` if no members) |
| `accelerator name [0.2, 0.6]` | `force=accelerate` on the component it acts on |
| `submap X [..] url(u)` + `url u [..]` | `X [.. submap url="…"]` |
| `title`, `style`, `evolution A->B->C->D` | `@map [title=… style=… evolution=(…)]` |
| `size [1024, 768]` | dropped: the canvas has no fixed size |

## Coverage

Everything in Wardley's [notation guide](https://www.wardleymaps.com/notation)
and the main tools, and where it lives:

| Element | v2 |
| --- | --- |
| Component, anchor/user | name; `user` |
| Activity, practice, data, knowledge | `kind` |
| Market, ecosystem | `type` |
| Dependency, constraint, flow, influence | link `type`, `influence` |
| Line of the future, future position, point of change | `future`, `evolve`, `@future` |
| Inertia | `inertia` |
| Accelerator, deaccelerator | `force` |
| Pipeline (open, folded) | braces; folding is UI state, not syntax |
| Submap | `submap` |
| Area of interest, team | `area` |
| Pioneers, settlers, town planners | `area` + `attitude` |
| Build, buy, outsource | `sourcing` |
| Notes, numbered annotations | `"text"` |
| Evolution stage names and widths, axis labels | `@map` |
| Style, title, metadata | `@map` |
| Custom symbols, metadata, plugins | unknown attributes, `@type`, `@use` |

## Alternatives considered

- **Keep `[position]` and `(attributes)` separate**, as today. The position
  would have its own brackets for the canvas to rewrite, but a component would
  have two argument lists that look alike. With positionals first, the merged
  form is just as easy to rewrite.
- **Indentation instead of braces** (tried in the 2022 drafts). Concurrent
  edits and pasting break indentation silently, and a missing brace is easier
  to report than a wrong indent.
- **A keyword per statement** (`component Kettle …`, as in OnlineWardleyMaps).
  Explicit, but most lines in a map are components and links, so the keyword
  is noise, and it makes the canvas's edits longer.
- **Separate operators per link type** (`+>`, `-c>`, `+v>`). Short, but each
  is one more thing to memorise, and they can't take extension attributes.
  Attributes cover more with less.
- **YAML or JSON.** Precise, but unpleasant to write by hand, and the main
  reason to have a syntax at all is writing by hand.

## Open questions

1. **`kind` vs `type`.** Two attributes with similar names. They are separate
   ideas (a practice can be a market), but `kind` could be called `capital`
   or `evolves-as` to make that clear. Since people will mostly write the bare
   word, the key matters less than usual.
2. **Should a component with braces always be a pipeline?** It's the one place
   something is inferred. Requiring `[pipeline]` would be more explicit, but
   every existing pipeline would need it.
3. **Futures.** Is `evolve=` plus `@future { }` the right split, or should
   there be one mechanism only?
4. **Name matching.** Case-sensitive, as today and in OnlineWardleyMaps? A
   case-insensitive match with a lint warning would catch `kettle -> power`
   typos.
5. **Renaming.** Names are identity, so a rename rewrites every line that
   mentions it. That's what happens now and it works, but two people renaming
   and linking at once can race. Stable hidden IDs would avoid that at the
   cost of readable text; `label=` softens the need.
6. **Positions inside submaps.** Own coordinate space (as proposed), or the
   parent's?

## Sources

- [OnlineWardleyMaps DSL reference](https://docs.onlinewardleymaps.com/docs/dsl-reference)
  and [examples](https://docs.onlinewardleymaps.com/docs/examples)
- [Mermaid `wardley-beta`](https://mermaid.js.org/syntax/wardley.html)
- [Kino Wardley syntax](https://kino-wardley.hexdocs.pm/syntax.html):
  constraint and influence links, groups
- [`application/vnd.wmap`](https://www.iana.org/assignments/media-types/application/vnd.wmap),
  the line-based format of the Map app for macOS
- [Wardley map notation](https://www.wardleymaps.com/notation)
- [KDL](https://kdl.dev): the node, arguments, properties and children shape
