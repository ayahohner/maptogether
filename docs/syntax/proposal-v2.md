# Proposal: MapTogether syntax v2

Status: fourth draft for discussion, October 2026. Nothing here is implemented.

This proposes one syntax that covers what's usually drawn on a Wardley map,
plus map settings, extensions and nesting. It keeps what works in today's
syntax (`Kettle [33, 50]`, braces for pipelines, `label=`) and replaces the
parts of the [2022 drafts](drafts.mt) that grew one rule at a time.

## The short version

Every statement has the same shape:

```
head [arguments] { children }
```

Only the **head** varies, and its first character says which of four kinds it
is:

| Head | Kind | Example |
| --- | --- | --- |
| a name | component | `Kettle [33, 50, inertia]` |
| `name -- name` | link | `Kettle -- Power` |
| `"text"` | note | `"Hot water is obvious" [48, 85]` |
| `@word` | directive (settings, definitions) | `@map [title="Tea Shop"]` |

Both `[arguments]` and `{ children }` are optional. Arguments work like a
Python function call: positional arguments first, then keyword arguments,
separated by commas. The one thing taken from HTML is that a keyword without a
value means `=true`, so `inertia` is `inertia=true`.

A whole map:

```
// Tea shop
@map [title="Tea Shop", style=wardley]

Business [95, 46, type=user]
Public [95, 72, type=user]
Cup of Tea [80, 62]
Cup [69, 86, sourcing=buy]
Staff [62, 28, sourcing=build, inertia]
Tea [55, 73] {
  Loose Leaf [55, 56]
  Tea Bags [55, 90, sourcing=outsource]
}
Hot Water [41, 88]
Water [22, 91]
Kettle [33, 50, evolve=80, label=("Kettle", -40, 10)]
Power [10, 86, type=market]

Business -- Cup of Tea [flow, label="£1.20"]
Public -- Cup of Tea
Cup of Tea -- Cup
Cup of Tea -- Tea
Cup of Tea -- Hot Water
Cup of Tea -- Staff
Hot Water -- Water
Hot Water -- Kettle [constraint]
Kettle -- Power

"Hot water is obvious" [48, 85]
```

## Design principles

1. **One shape for everything.** Every statement parses to the same record:
   `{head, positional, keywords, children}`. The parser doesn't need to know
   what `market` or `@map` mean; a later pass looks them up. New features add
   to that table, not to the grammar. It's a graph definition language, like
   Graphviz's DOT and Mermaid, specialised to one kind of graph.
   [KDL](https://kdl.dev) is the closest prior art for the statement shape
   (`node 1 2 key="value" { child }`); we bracket the arguments because our
   names contain spaces.
2. **The text is co-edited by the canvas.** Dragging, renaming and linking
   rewrite the text (`src/editor/edits.ts`), several people edit at once over
   Yjs, and a broken line is blanked so the rest of the map still draws
   (`src/parser/lenient.ts`). So: one fact per line, the position always in
   the same place, and errors that stay on their own line.
3. **Information lives with what it describes.** A component's properties go
   on the component's line, a relationship's on the relationship's line.
4. **A small namespace.** Keys are single short words, with no dashes, and
   there are as few as possible. A bare word in an argument list is always a
   key, never a value, so values can't spill into the key namespace.
5. **One obvious way to write each thing.** No aliases, and no shorthand that
   means the same as a longer form.
6. **Fast to type, readable by people who don't program.** Names need no
   quotes, and nothing is abbreviated past recognition.
7. **If it's drawn on the map, it's syntax. If it's a version of the map, it's
   history.** Snapshots and scenarios belong to the room's history, not the
   text (see Futures, snapshots and scenarios).

## Scope

The first version should be small enough to build and teach. Everything else
fits the same grammar, so it can be added later without breaking maps.

| First version | Later |
| --- | --- |
| Components: position, `type`, `form`, `sourcing`, `inertia`, `evolve`, `label` | Submaps |
| Links: `--`, `constraint`, `flow`, `label` | Areas |
| Pipelines, including `pipeline=` bounds | Numbered annotations |
| Notes | Accelerators and deaccelerators |
| `@map` settings | `@type` for new component types |
| | Lines of the future; snapshots and scenarios (history, not syntax) |

## Terms

| Term | Example | Meaning |
| --- | --- | --- |
| positional argument | `33, 50` | a value whose meaning comes from its place |
| keyword argument | `sourcing=build` | a key and a value |
| boolean keyword | `inertia` | a keyword with no value, meaning `=true`. HTML calls these boolean attributes |
| symbol | `build` in `sourcing=build` | a bare word used as a value, as in Lisp, Ruby and Clojure. CSS calls them keywords, but that clashes with keyword arguments |
| tuple | `("Kettle", -40, 10)` | an argument list in parentheses, used as a value |

## Arguments

```
Kettle [33, 50]
Kettle [33, 50, inertia]
Kettle [33, 50, sourcing=build, inertia, label=("Kettle", -40, 10)]
```

- Positional arguments come first. For a component they're the position,
  `visibility, evolution`.
- Keyword arguments follow, in any order.
- Arguments are separated by commas.
- A keyword without a value is a boolean keyword: `inertia` means
  `inertia=true`. There's no `false`: leave the keyword out. Settings are
  named so that leaving them out gives the default.

**Spaces also separate.** `[33 50 inertia]` parses the same as
`[33, 50, inertia]`, so a line someone is halfway through typing doesn't
break the map, and neither does a missing comma. The formatter writes the
commas back. Commas are the canonical spelling because they're what people
already write in Python, JSON, OnlineWardleyMaps and today's maps.

Values are numbers (`34.5`, `-10`), strings (`"£1.20"`, `"Tea shop's till"`),
symbols (`build`, `wardley`) and tuples. Strings use double quotes, so
apostrophes in notes need no escaping. Inside a string, `\"` is a double
quote, `\\` a backslash and `\n` a line break.

A symbol is only ever a value after `=`. A bare word anywhere else is a
boolean keyword. That's what keeps values out of the key namespace.

**Tuples are argument lists in parentheses**, with the same rules: positional
values first, then keyword arguments and boolean keywords. So a tuple can hold
strings, numbers, other tuples, `key=value` pairs and boolean keywords. One
rule covers both `[ ]` and `( )`. The first use of keywords inside a tuple is
`evolve=(80, label="Smart Kettle")` (see Components). One consequence: a bare
word in a tuple is a boolean keyword, not a symbol, so lists of text are
quoted: `evolution=("Genesis", "Custom", "Product", "Commodity")`.

**Formatting.** When a statement is longer than 80 characters, the formatter
puts one argument per line, each with a trailing comma, so a change to one
argument is a one-line diff:

```
Kettle [
  33, 50,
  sourcing=build,
  inertia,
  evolve=80,
  label=("Kettle", -40, 10),
  description="Electric, 3kW, shared by the whole shop",
]
```

The position stays together on the first line, since a drag changes both
numbers.

## Grammar

```ebnf
document      = { statement-end | statement } ;
statement     = head [ arguments ] [ block ] statement-end ;
statement-end = newline | ";" | EOF ;

head          = link | directive | note | name ;
link          = name "--" name ;
directive     = "@" word [ name | string ] ;
note          = string ;

arguments     = "[" argument-list "]" ;
tuple         = "(" argument-list ")" ;
argument-list = { positional } { keyword } ;   (* separated by ","; spaces and newlines also separate; a trailing "," is allowed *)
positional    = number | string | tuple ;
keyword       = key [ "=" value ] ;            (* no value: a boolean keyword, true *)
value         = number | string | tuple | symbol ;
block         = "{" { newline | statement } "}" ;

name          = name-char { name-char | " " name-char }   (* no "--", "//", "[", "]", "{", "}", '"' or ";"; not starting with "@" *)
              | "`" { any char except "`" } "`" ;
key           = word ;
symbol        = word ;
word          = lowercase-letter { lowercase-letter | digit } ;
string        = '"' { any char except '"' or "\" | escape } '"' ;
escape        = '\"' | "\\" | "\n" ;
comment       = "//" { any char } ;
```

- **Names need no quotes.** A name ends at `[`, `]`, `{`, `}`, `--`, `//`, `;` or the
  end of the line, and surrounding spaces are trimmed. If a name contains one
  of those, wrap it in backticks: `` `C#--IL` [40, 60] ``. Double quotes are
  always prose, so `"Kettle"` is a note, and a leading `@` always starts a
  directive.
- **Newlines end statements**, except inside `[ ]` and `( )`. `;` separates
  statements on one line.

## Components

| Key | Value | Meaning |
| --- | --- | --- |
| *(positional)* | `visibility, evolution` | 0 to 100 each |
| `type` | `component` (default), `user`, `market`, `ecosystem`, or one from `@type` | what it is; sets the symbol, and how children are drawn |
| `form` | `activity` (default), `practice`, `data`, `knowledge` | Wardley's four things that evolve |
| `sourcing` | `build`, `buy`, `outsource` | method notation, drawn as a shaded circle |
| `inertia` | boolean | the black bar |
| `evolve` | evolution number, or `(evolution, keywords)` | the future position: red circle and red dashed arrow |
| `label` | `"text"` or `("text", x, y)` | the text drawn, and where it sits relative to the component, in pixels |
| `pipeline` | `(from, to)` | the evolution the pipeline's box spans; see Pipelines |

**Position.** `[visibility, evolution]`, 0 to 100. That order is backwards
from (x, y), but OnlineWardleyMaps, Mermaid and today's maps all use it, and
changing it would quietly break every map anyone pastes in. Positions are
written to one decimal place: `[98.3, 41.5]`. A component with no position is
drawn at `[10, 10]`, as today; dragging it writes one in.

**Type.** `type=user`, `type=market`, `type=ecosystem`. Spelling out `type=`
keeps every value behind a key, so `@type` can add new types without adding
new keys (`type=regulator`), and there's no rule needed for two type flags at
once. Users are a line or two per map and markets are rare, so the extra
characters cost little.

**Form.** Usually left as `activity`. Maps commonly mix activities and
practices, so it's set per component, not per map.

**Evolve.** `evolve=80` says where the component is expected to move. When the
future version differs from today's, the tuple form takes the same keywords
as the component itself, for the future one:

```
Kettle [33, 50, evolve=80]
Kettle [33, 50, evolve=(80, label="Smart Kettle", sourcing=buy)]
```

That covers a renamed future (OnlineWardleyMaps' `evolve Kettle->Smart Kettle`)
and a change of sourcing or type on the way, while it stays one component
with one name for links to point at.

**Names.** A name is unique in the map and case-sensitive: `Kettle` and
`kettle` are different components. A second component with the same name is
a lint error that points at the first, and the first one wins.

### Labels

```
Kettle [33, 50, label="Electric kettle"]
Kettle [33, 50, label=("Electric kettle", -40, 10)]
```

- With no `label`, the name is drawn, placed automatically.
- `label="text"` changes the text, still placed automatically.
- `label=("text", x, y)` also moves it, by `x, y` pixels from the component.

Dragging a label writes the tuple form, copying the text in:
`label=("Kettle", -40, 10)`. After the first drag, drags change only the
numbers. The canvas should rewrite only the numbers, never the whole value,
so that one person retyping the text while another drags the label edit
different characters and Yjs merges them cleanly.

## Links

```
Cup of Tea -- Hot Water
Hot Water -- Kettle [constraint]
Business -- Cup of Tea [flow, label="£1.20"]
Kettle--Power
```

The needer is on the left and the needed on the right, as today. Spaces
around `--` are optional. Arguments on a link describe the link, and only the
link.

A link can name a component that isn't declared. That's not an error: the
link stays in the text, and is drawn once both components exist.

| Key | Value | Meaning |
| --- | --- | --- |
| `constraint` | boolean | thick line: a limit or bottleneck |
| `flow` | boolean | Wardley's blue flow line: value, money or risk moving between them |
| `label` | `"text"` | text along the line |

There's one operator. `->` shows direction and is what OnlineWardleyMaps and
Mermaid use, but `>` needs shift. The options considered:

| Operator | Keys (US layout) | Problem |
| --- | --- | --- |
| `.` (today) | 1, no shift | dots in names: `Node.js`, `v2.1`, `St. Ives` |
| `->` | 2, shift | shift for `>` |
| `--` | 2, same key, no shift | no arrowhead, but neither has `.` |
| `/` | 1, no shift | slashes in names: `TCP/IP`, `24/7`; next to `//` comments |
| `>` | 1, shift | shift; reads as "greater than" |

No chains (`A -- B -- C`) and no fan-out (`A -- B, C`). Deleting one link on
the canvas would mean rewriting a line that holds several, possibly while
someone else is typing in it.

## Pipelines

Braces on a component make it a pipeline, as today:

```
Tea [55, 73] {
  Loose Leaf [55, 56]
  Tea Bags [55, 90, sourcing=outsource]
}
```

Children keep both numbers, so a component moves in or out of a pipeline by
moving its line, with nothing to retype. Inside a pipeline the visibility
follows the pipeline's, and when you drag a child the canvas writes the
pipeline's visibility back.

Braces mean "pipeline" for the default type, `component`. Other types can
say what their children mean: a later `type=submap` draws them as a map
inside the component. `user`, `market` and `ecosystem` take no children; the
linter flags braces on them.

**Bounds.** The box spans its children. `pipeline=(from, to)` sets its edges
on the evolution axis:

```
Tea [55, 73, pipeline=(10, 95)] {
  Loose Leaf [55, 56]
  Tea Bags [55, 90]
}
Payments [40, 60, pipeline=(20, 80)]
```

- It lets a pipeline show the space a need could evolve across, wider than
  the components in it.
- It makes a pipeline with no children, which is what OnlineWardleyMaps'
  `pipeline Tea [0.15, 0.9]` imports to.

Suggested rule: the bounds are a **minimum**. The box covers the bounds and
every child, so dragging a child past an edge grows the box rather than
leaving the child outside it. Dragging an edge of the box writes the bounds.

## Notes

A quoted string as the head is a note: prose, not a thing on the map.

```
"Hot water is obvious, but the tea shop's kettle isn't" [48, 85]
```

Notes are dragged like components. The 2022 draft used `#` for notes, which
most people now read as a heading or a comment. `//` stays the only comment.

## Map settings

Settings are keywords on the map itself, given with `@map`:

```
@map [
  title="Tea Shop",
  style=wardley,                                    // wardley, colour, plain, handwritten or dark
  evolution=("Genesis", "Custom built", "Product", "Commodity"),
  stages=(17.4, 40, 70),                            // where the stage boundaries fall
  visibility=("Visible", "Invisible"),
]
```

`evolution=hidden` and `visibility=hidden` hide an axis's labels.

With a setting per line, two people changing different settings don't collide.
`@map` belongs at the top; if there are two, the linter says so.

## Later

All of these fit the grammar above, with no new syntax.

**Submaps.** A component that stands for a whole map, opened by clicking. Its
children use the submap's own coordinates:

```
Ordering [70, 55, type=submap] {
  Till [80, 70]
  Card Reader [40, 85, sourcing=buy]
  Till -- Card Reader
}
Payments [60, 70, type=submap, url="https://maptogether.io/r/abc123"]
```

**Numbered annotations.** A note drawn as a numbered circle at one or more
places, with its text in a legend. `on=` takes points, or components to sit
next to:

```
"Standardised power lets kettles evolve" [on=((38, 55), (12, 80))]
"Standardised power lets kettles evolve" [on=("Kettle", "Power")]
@map [legend=(90, 5)]
```

They're numbered in the order they appear in the file.

**Accelerators and deaccelerators.** Wardley draws these as labelled arrows
on the map: a force on the landscape, not a property of one component. So
they're drawings, like areas:

```
@accelerator "Open source" [30, 70]
@deaccelerator "Regulation" [50, 40]
```

**New component types.** `@type` adds a value for `type`, with a built-in
type to fall back on:

```
@type regulator [base=component, shape=hexagon]

FCA [70, 40, type=regulator]
```

### Areas

The previous draft had areas list their members:

```
@area Front of house [attitude=settlers] {
  Staff
  Cup
}
```

The coupling that feels wrong comes from a few places:

- `Staff` inside the braces looks exactly like a component declaration, but
  it's a reference to one declared elsewhere. In a pipeline the same line
  would declare it.
- The area's shape depends on where its members are, so dragging a component
  quietly redraws something declared on another line.
- "Area" covers two different things. An **area of interest** is a drawing:
  someone circles part of the map. A **team's area** is a fact about each
  component: who owns it.

Splitting those two gives each a simple home:

| Need | Where it lives | Example |
| --- | --- | --- |
| Area of interest, pioneers / settlers / town planners | a shape, like a note: a directive with two corners as `(visibility, evolution)` | `@area "Explore" [(80, 5), (40, 35), attitude=pioneers]` |
| Who owns a component | a keyword on the component | `Staff [62, 28, owner="Front of house"]` |

The shape knows nothing about components and moves only when dragged, as
OnlineWardleyMaps' `pioneers [..]` rectangles and Wardley's hand-drawn clouds
do. Ownership is the component's own information, and the canvas can draw
a boundary around everything with the same `owner` as a view, with no extra
syntax. Neither needs references between statements.

Recommendation: shapes first. Ownership is just a keyword, so it needs no
design until something reads it.

### Futures, snapshots and scenarios

There are three different needs here, and only one is syntax.

| Need | Example | Where it lives |
| --- | --- | --- |
| What we expect to change, drawn on this map | Kettle moving right; a new Smart Kettle in red | syntax |
| How the map looked at a point in time | "the map we showed the board in March" | history |
| Alternative versions of the map | "if we outsource" vs "if we build" | history |

[A universal theory of interactive software](https://innerlattice.com/universal-theory-of-interactive-software)
gives a useful way to see this. It treats every input as an immutable record,
and everything else, including the current state, as a function of the
records. Applied to MapTogether:

- **Records** are the Yjs updates: every keystroke and drag, each with what
  its author had seen when they made it.
- **The map text** is a function of the records, and **the drawing** is a
  function of the text.
- **A snapshot** is the set of records available at a point. Yjs already has
  these (`Y.snapshot`, a state vector), so a **named snapshot** is a name
  attached to one: a tag, in Git terms. Showing it means rendering the text as
  of that snapshot. No syntax. Yjs can only rebuild an old version if its
  garbage collection is off (`new Y.Doc({ gc: false })`), on clients and the
  relay; otherwise deleted text is thrown away.
- **A scenario** is a counterfactual: start from a snapshot and add different
  records. That's a branch, made by forking the room's history. Comparing two
  scenarios is a diff of their texts, drawn on the canvas. No syntax.

What stays in the syntax is what one picture says about the future, because
Wardley maps draw the future in red alongside the present:

- `evolve=80` on a component: it's expected to move to evolution 80.
- Later, a `future` boolean keyword on components and links, for new
  components and lines of the future:

```
Smart Kettle [45, 30, future]
Smart Kettle -- Power [future]
```

This is simpler than the previous draft's `@future { }` overlay, because each
fact stays on its own line with the thing it describes.

## What changes from today

| Today | v2 | Why |
| --- | --- | --- |
| `Kettle [33, 50]` | unchanged | |
| `Kettle [33, 50] (label=-40,10)` | `Kettle [33, 50, label=("Kettle", -40, 10)]` | one argument list |
| `needer.needed` | `needer -- needed` | dots appear in names |
| `a.(t=constraint)b` | `a -- b [constraint]` | |
| `Tea [55, 73] { Loose Leaf [55, 56] }` | unchanged | |
| `/mapstyle(title="…")` | `@map [title="…"]` | one directive sigil |
| `# note [40, 50]` | `"note" [40, 50]` | `#` reads as a heading |
| `government:2` | `government 2 [label="government"]` | no definition IDs |
| `name^` | `evolve=` | |

There's no compatibility layer: nothing reads v1 after the switch, and the
few existing maps are converted by hand.

### Importing OnlineWardleyMaps

This mapping comes from OnlineWardleyMaps' parser
(`frontend/src/conversion/*ExtractionStrategy.ts` and
`constants/extractionFunctions.ts` in
[damonsk/onlinewardleymaps](https://github.com/damonsk/onlinewardleymaps)),
not only its documentation. Coordinates are × 100.

**Components**

| OnlineWardleyMaps | v2 |
| --- | --- |
| `component Kettle [0.33, 0.5]` | `Kettle [33, 50]` |
| `anchor Business [0.95, 0.46]` | `Business [95, 46, type=user]` |
| `market Power [..]`, `component Power [..] (market)` | `Power [.., type=market]` |
| `ecosystem X [..]`, `(ecosystem)` | `X [.., type=ecosystem]` |
| `component Kettle [..] inertia` | `Kettle [.., inertia]` |
| `component Kettle [..] label [-40, 10]` | `Kettle [.., label=("Kettle", -40, 10)]` |
| `(build)`, `(buy)`, `(outsource)`; `build Kettle` on its own line | `sourcing=build` on Kettle |
| `component "Two\nlines" [..]` | `` `Two lines` [.., label="Two\nlines"] `` |
| a name containing `--`, `[`, `{`, `//` or `;` | backticks |

**Evolution**

| OnlineWardleyMaps | v2 |
| --- | --- |
| `evolve Kettle 0.8` | `evolve=80` on Kettle |
| `evolve Kettle->Smart Kettle 0.8` | `evolve=(80, label="Smart Kettle")` |
| `evolve Kettle 0.8 label [5, -10]` | `evolve=(80, label=("Kettle", 5, -10))` |
| `evolve Kettle 0.8 (buy)` | `evolve=(80, sourcing=buy)` |

**Links**

| OnlineWardleyMaps | v2 |
| --- | --- |
| `A->B` | `A -- B` |
| `A->B; text` | `A -- B [label="text"]` |
| `A+<>B`, `A+>B`, `A+<B` | `A -- B [flow]` |
| `A+'£1'<>B` | `A -- B [flow, label="£1"]` |
| `A+'£1'<>B; text` | `A -- B [flow, label="£1 text"]` (joined) |

`+<` and `+>` aren't directions. The documentation says they limit a flow to
the components' current or evolved positions, but the parser's `past` and
`future` flags aren't read by anything that draws (as of commit `71f2aad`),
so all three draw the same and import the same.

An `evolve Kettle->Smart Kettle` rename only changes the text drawn: links
still name `Kettle`, and connect to both its current and future positions.
That's why the rename imports as `label` inside `evolve=`, not as a new name.

**Pipelines**

| OnlineWardleyMaps | v2 |
| --- | --- |
| `pipeline Tea [0.15, 0.9]` | `pipeline=(15, 90)` on Tea |
| `pipeline Tea` with no bounds | nothing: OnlineWardleyMaps hides it |
| `pipeline Tea { component Loose Leaf [0.56] }` | `Tea [..] { Loose Leaf [55, 56] }`, the child taking Tea's visibility |

**Notes and drawings**

| OnlineWardleyMaps | v2 |
| --- | --- |
| `note text [0.4, 0.5]` | `"text" [40, 50]` |
| `annotation 1 [[0.4, 0.5], [0.6, 0.7]] text` | later: `"text" [on=((40, 50), (60, 70))]`, written in number order |
| `annotations [0.9, 0.1]` | later: `@map [legend=(90, 10)]` |
| `pioneers [0.59, 0.43, 0.49, 0.63]`, `settlers`, `townplanners` | later: `@area [(59, 43), (49, 63), attitude=pioneers]` |
| `accelerator Name [0.1, 0.8]`, `deaccelerator Name [..]` | later: `@accelerator "Name" [10, 80]`, `@deaccelerator` |
| `submap Website [..] url(ref)` with `url ref [https://…]` | later: `Website [.., type=submap, url="https://…"]` |

**Map settings and comments**

| OnlineWardleyMaps | v2 |
| --- | --- |
| `title Tea Shop` | `@map [title="Tea Shop"]` |
| `style colour` (or `wardley`, `handwritten`, `plain`, `dark`) | `@map [style=colour]` |
| `evolution A->B->->D` | `@map [evolution=("A", "B", "", "D")]` |
| `evolution --hide`, `valuechain --hide` | `@map [evolution=hidden]`, `@map [visibility=hidden]` |
| `size [1024, 768]` | dropped: the canvas has no fixed size |
| `/* … */` | `//` on each line |

Anything the importer can't map yet (areas, annotations, accelerators,
submaps until they exist) is kept as a comment, `// owm: pioneers [0.59, …]`,
so nothing is lost and a later version can convert it.

## Coverage

Everything in Wardley's [notation guide](https://www.wardleymaps.com/notation)
and the main tools:

| Element | v2 |
| --- | --- |
| Component; user (anchor) | name; `type=user` |
| Activity, practice, data, knowledge | `form` |
| Market, ecosystem | `type=market`, `type=ecosystem` |
| Build, buy, outsource | `sourcing` |
| Inertia | `inertia` |
| Future position, point of change, renamed future | `evolve` |
| Dependency, constraint, flow | `--`, `constraint`, `flow` |
| Pipeline | braces, `pipeline=` |
| Notes | `"text"` |
| Evolution stage names and widths, axis labels, hidden axes, style, title | `@map` |
| Submap | later: `type=submap` |
| Area of interest, pioneers / settlers / town planners | later: `@area` |
| Numbered annotations | later: `on=` |
| Accelerators, deaccelerators | later: `@accelerator`, `@deaccelerator` |
| Line of the future, new future components | later: `future` |
| Custom symbols | later: `@type` |
| Snapshots, scenarios | history, not syntax |

## Alternatives considered

- **Separate `[position]` and `(attributes)`**, as today. The position would
  have its own brackets for the canvas to rewrite, but each component would
  have two argument lists that look alike.
- **Bare values as shorthand** (`[33, 50, build]` meaning `sourcing=build`).
  Shorter, but every value of every key becomes a word you can't use as a key.
- **Types as boolean keywords** (`[95, 46, user]`). Shorter, but each new type
  adds a key, and two at once needs its own rule.
- **Spaces as the canonical separator** (`[33 50 inertia]`). Less to type,
  but unfamiliar to anyone who's written Python, JSON or OnlineWardleyMaps.
  Kept as an accepted spelling; trailing commas keep multi-line diffs to one
  line just as well.
- **Single-quoted strings**, to avoid shift. Apostrophes are common in notes,
  and escaping them would be worse.
- **An operator per type of link** (`==`, `~~`), as in Mermaid. Each one is a
  symbol to learn.
- **Links that continue the component above** (a line starting `--`). Less
  typing, but the meaning depends on line order, which concurrent edits and
  editors that don't know the map's structure can break silently.
- **Parentheses everywhere**, Lisp style. Names often contain parentheses,
  links would read prefix-first, and one missing paren breaks everything after
  it.
- **Indentation instead of braces.** Concurrent edits and pasting break
  indentation silently.
- **A keyword per statement** (`component Kettle …`, as in
  OnlineWardleyMaps). Most lines are components and links, so it's noise.
- **A renamed future as its own component** (`Smart Kettle [33, 80, future]`
  plus an arrow from Kettle). It would need a way to say which component it
  came from, a reference between two lines; `evolve=(80, label=…)` keeps it on
  one.
- **YAML or JSON.** Precise, but unpleasant to write by hand.

## Open questions

1. **Pipeline bounds.** Are bounds a minimum the box grows past, or exact
   with a lint warning for children outside?
2. **Areas.** Shapes first, with ownership as a plain keyword?
3. **The `future` keyword.** Does `evolve=` plus `future` cover what people
   draw, or is something missing?
4. **Flow value and link text.** OnlineWardleyMaps lets a flow link carry
   both a value (`£1`) and context text. Is joining them into one `label`
   enough, or do flows need their own `value=`?

## Sources

- [OnlineWardleyMaps DSL reference](https://docs.onlinewardleymaps.com/docs/dsl-reference),
  [examples](https://docs.onlinewardleymaps.com/docs/examples) and
  [parser](https://github.com/damonsk/onlinewardleymaps/tree/main/frontend/src/conversion)
- [Mermaid `wardley-beta`](https://mermaid.js.org/syntax/wardley.html)
- [Kino Wardley syntax](https://kino-wardley.hexdocs.pm/syntax.html):
  constraint and influence links, groups
- [`application/vnd.wmap`](https://www.iana.org/assignments/media-types/application/vnd.wmap),
  the line-based format of the Map app for macOS
- [Wardley map notation](https://www.wardleymaps.com/notation)
- [KDL](https://kdl.dev): the node, arguments, properties and children shape
- [A universal theory of interactive software](https://innerlattice.com/universal-theory-of-interactive-software):
  records, snapshots and counterfactuals
