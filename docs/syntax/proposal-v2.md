# Proposal: MapTogether syntax v2

Status: second draft for discussion, October 2026. Nothing here is
implemented.

This proposes one syntax that covers what's usually drawn on a Wardley map,
plus map settings, extensions and nesting. It keeps what works in today's
syntax (`Kettle [33, 50]`, braces for pipelines, `label=` offsets) and replaces
the parts of the [2022 drafts](drafts.mt) that grew one rule at a time.

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
Python function call: positional arguments first, then keyword arguments, all
separated by commas. The one thing taken from HTML is that a keyword written
without a value means `=true`, so `inertia` is `inertia=true`.

A whole map:

```
// Tea shop
@map [title="Tea Shop", style=wardley]

Business [95, 46, user]
Public [95, 72, user]
Cup of Tea [80, 62]
Cup [69, 86, sourcing=buy]
Staff [62, 28, sourcing=build, inertia]
Tea [55, 73] {
  Loose Leaf [55, 56]
  Tea Bags [55, 90, sourcing=outsource]
}
Hot Water [41, 88]
Water [22, 91]
Kettle [33, 50, evolve=80, label=(-40, 10)]
Power [10, 86, market]

Business -- Cup of Tea [flow, label="£1.20"]
Public -- Cup of Tea
Cup of Tea -- Cup
Cup of Tea -- Tea
Cup of Tea -- Hot Water
Cup of Tea -- Staff
Hot Water -- Water
Hot Water == Kettle
Kettle -- Power

"Hot water is obvious" [48, 85]
```

## Design principles

1. **One shape for everything.** Every statement parses to the same record:
   `{head, positional, keywords, children}`. The parser doesn't need to know
   what `market` or `@map` mean; a later pass looks them up. New features add
   to that table, not to the grammar. [KDL](https://kdl.dev) is the closest
   prior art (`node 1 2 key="value" { child }`); we bracket the arguments
   because our names contain spaces.
2. **The text is co-edited by the canvas.** Dragging, renaming and linking
   rewrite the text (`src/editor/edits.ts`), several people edit at once over
   Yjs, and a broken line is blanked so the rest of the map still draws
   (`src/parser/lenient.ts`). So: one fact per line, the position always in
   the same place, and errors that stay on their own line.
3. **Information lives with what it describes.** A component's properties go
   on the component's line, a relationship's on the relationship's line.
   Nothing about a link is written on a component, or the reverse.
4. **A small namespace.** Keys are single short words, with no dashes, and
   there are as few as possible. A bare word is always a key, never a value,
   so values can't spill into the key namespace.
5. **One obvious way to write each thing.** No aliases (`anchor` *and*
   `user`), no shorthand that means the same as a longer form.
6. **Fast to type, readable by people who don't program.** Names need no
   quotes, common things need no shift key, and nothing is abbreviated past
   recognition.

## Scope

The first version should be small enough to build and teach. Everything else
fits the same grammar, so it can be added later without breaking maps.

| First version | Later |
| --- | --- |
| Components: position, `user`, `market`, `ecosystem`, `form`, `sourcing`, `inertia`, `evolve`, `label` | Submaps |
| Links: `--`, `==`, `flow`, `label` | Areas, and pioneers / settlers / town planners |
| Pipelines | Numbered annotations |
| Notes | Accelerators and deaccelerators |
| `@map` settings | `@type` for new component types |
| | Futures and scenarios |

## Arguments

```
Kettle [33, 50]
Kettle [33, 50, inertia]
Kettle [33, 50, sourcing=build, inertia, label=(-40, 10)]
```

As in Python:

- Positional arguments come first. For a component they're the position,
  `visibility, evolution`.
- Keyword arguments follow, in any order.
- Commas separate arguments, and a trailing comma is allowed. Newlines are
  allowed anywhere inside the brackets, so long argument lists can be one per
  line.

As in HTML:

- A keyword without a value is `true`: `inertia` means `inertia=true`.

Values are numbers (`34.5`, `-10`), strings (`"£1.20"`, `"#ff0"`), tuples
(`(-40, 10)`), and words (`build`, `wardley`). A word is only ever a value
after `=`. Written bare, it's always a key.

To keep a missing comma from blanking the line, the parser can treat commas as
whitespace, so `[33 50 inertia]` still draws. The formatter puts the commas
back, and the linter can point them out.

## Grammar

```ebnf
document    = { statement-end | statement } ;
statement   = head [ arguments ] [ block ] statement-end ;
statement-end = newline | ";" | EOF ;

head        = link | directive | note | name ;
link        = name ( "--" | "==" ) name ;
directive   = "@" word [ name ] ;
note        = string ;

arguments   = "[" [ argument { "," argument } [ "," ] ] "]" ;   (* newlines allowed inside *)
argument    = positional | keyword ;      (* every positional before every keyword *)
positional  = number | string | tuple ;
keyword     = key [ "=" value ] ;          (* no value means true *)
value       = number | string | tuple | word ;
tuple       = "(" [ value { "," value } [ "," ] ] ")" ;
block       = "{" { newline | statement } "}" ;

name        = plain-name [ ":" qualifier ] | "`" { any char except "`" } "`" ;
qualifier   = { letter | digit } ;                        (* "regulator", "2" *)
plain-name  = name-char { name-char | " " name-char } ;   (* no "--", "==", "//" or ":" inside *)
key         = word ;                                      (* lowercase letters only *)
comment     = "//" { any char } ;
```

- **Names need no quotes.** A name ends at `[`, `{`, `--`, `==`, `//`, `;` or
  the end of the line, and surrounding spaces are trimmed. If a name contains
  one of those, wrap it in backticks: `` `C#--IL` [40, 60] ``. Backticks escape
  names; double quotes are always prose, so `"Kettle"` is a note.
- **Newlines end statements**, except inside `[ ]` and `( )`. `;` separates
  statements on one line.

## Components

### Attributes

| Key | Value | Meaning |
| --- | --- | --- |
| *(positional)* | `visibility, evolution` | 0 to 100 each |
| `user`, `market`, `ecosystem` | flag | the type; plain component if none |
| `form` | `activity` (default), `practice`, `data`, `knowledge` | Wardley's four things that evolve |
| `sourcing` | `build`, `buy`, `outsource` | method notation, drawn as a shaded circle |
| `inertia` | flag | the black bar |
| `evolve` | evolution number | the future position: red circle and red dashed arrow |
| `label` | `(x, y)` | where the label sits relative to the component, in pixels |

Plus `description` and `url` (strings) for hover text and links out, if they
make the cut.

**Position.** `[visibility, evolution]`, 0 to 100. That order is backwards
from (x, y), but OnlineWardleyMaps, Mermaid and today's maps all use it, and
changing it would quietly break every map anyone pastes in. A component with
no brackets gets an automatic position (visibility from its depth in the value
chain); dragging it writes one in.

**Types are flags.** A component has at most one type, so `user`, `market`
and `ecosystem` are flags where only one may be set. `[user, market]` is a lint
error, and the last one wins so the map still draws. Flags read well
(`Power [10, 86, market]`), and they're keys, so they fit the rule that a bare
word is always a key. A later `@type` directive adds new types the same way.

**Form, not kind.** `form` is short, and it says what it means: the form of
capital that's evolving. A map is usually all activities, so most components
won't set it. On the map it only changes the stage names on hover (practices
go Novel → Emerging → Good → Best), unless `@map [form=practice]` sets it for
the whole map.

**Sourcing is a keyword argument.** `sourcing=build`, not `build`. `build` on
its own would be a new key meaning `build=true`, which is exactly the namespace
spill principle 4 rules out.

### Names and identity

A component's name does two jobs: it's the **text drawn on the map**, and it's
the **key links use to find the component**. Usually that's fine. It goes
wrong when one word means two things on the same map: "government" the user
at the top, and "government" the regulator lower down. Two components can't
have the same key, so they can't both be called `Government`.

That's what the 2022 draft's `government:2` was for, and it's worth keeping.
The part after a `:` is a **qualifier**: it's part of the key, but it isn't
drawn.

```
Government:user [95, 50, user]
Government:regulator [60, 40]

Government:user -- Society
Society -- Government:regulator
```

Both are drawn as "Government", and links say exactly which one they mean.
Allowing a word after the colon, not just a number, makes the links readable
(`Government:regulator` rather than `Government:2`). A name with a colon in its
text, like `Ratio 3:1`, needs backticks.

Each name is declared once. A second component line with the same name is a
lint error that points at the first, and the first one wins.

The 2022 draft's notes say "synonyms": two names for one thing. That's a
different feature from the qualifier, which is one name for two things. If
synonyms were also meant, it would be something like `Tea [55, 73,
alias="Chai"]`, so links to either name find the same component. That's
listed as an open question.

### Labels

`label=(x, y)` moves the label, as today. It's the key people will use most,
so it gets the short name. The text comes from the name (without its
qualifier), and the label is placed automatically when there's no `label=`.

**Should `label` also take text, as a string or a `("text", x, y)` tuple?**
It would give display text that differs from the name (line breaks, or a long
name with a short key) under the same short key. The costs:

- **The value's meaning depends on its shape.** `label="Gov"`,
  `label=(-40, 10)` and `label=("Gov", -40, 10)` all mean different things.
  The linter, the formatter, autocomplete and the help all have to explain
  three forms of one key.
- **The canvas edits get bigger.** Dragging a label whose value is `"Gov"`
  has to turn it into `("Gov", -40, 10)`, which rewrites the text as well as
  the numbers.
- **Concurrent edits collide.** If one person retypes the text while another
  drags the label, both rewrite the same value. Yjs merges them character by
  character inside it, which can leave something like `("Gove", -4-30, 10)`.
  As separate values, the two edits touch different text.
- **Unnamed tuple fields.** In `("Gov", -40, 10)`, nothing says whether the
  numbers are an offset or a position.
- **Two sources of text.** With the name and `label` both able to set the
  text, readers have to check both.

Recommendation: `label` is only the offset. The qualifier covers the main
reason to want different text. If display text is needed later, it gets its
own key (`text="…"`), and `label=(x, y)` stays as it is.

## Links

```
Cup of Tea -- Hot Water
Hot Water == Kettle
Business -- Cup of Tea [flow, label="£1.20"]
```

The needer is on the left and the needed on the right, as today. Arguments
on a link describe the link, and only the link.

### The operator

`->` shows the direction, and it's what OnlineWardleyMaps and Mermaid use.
But `>` needs shift and a reach to the top row, on a statement people type all
the time. The options:

| Operator | Keys (US layout) | Problem |
| --- | --- | --- |
| `.` (today) | 1, no shift | dots in names: `Node.js`, `v2.1`, `St. Ives` |
| `->` | 2, shift | shift for `>` |
| `--` | 2, same key, no shift | no arrowhead, but neither has `.` |
| `/` | 1, no shift | slashes in names: `TCP/IP`, `24/7`; next to `//` comments |
| `>` | 1, shift | shift; reads as "greater than" |

`--` is quick to type, rarely appears in names, and looks like a line. It's
also Graphviz's and Mermaid's undirected link. The direction comes from the
order, as it does with `.` today.

Mermaid-style, variants of the operator can carry the type of link, so the
two most common types need no arguments:

| Operator | Link |
| --- | --- |
| `A -- B` | dependency: thin line |
| `A == B` | constraint: thick line |

Doubling the character keeps both easy to type, and `==` looks thick. The
downside is that `==` reads as "equals" to programmers. Further operators
(`..` for a dotted line, for example) can be added if a type of link needs one.

### Link attributes

| Key | Value | Meaning |
| --- | --- | --- |
| `flow` | flag | Wardley's blue flow line: value, money or risk moving between them |
| `label` | string | text along the line |

Here `label` is text, not an offset: links have no label to drag. If that
inconsistency bothers people, link text could be `text=` instead (see Labels).

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
pipeline's visibility back. The box spans the children, so it needs no start
and end of its own (OnlineWardleyMaps' `pipeline Tea [0.15, 0.9]`).

## Notes

A quoted string as the head is a note: prose, not a thing on the map.

```
"Hot water is obvious" [48, 85]
```

Notes are dragged like components. The 2022 draft used `#` for notes, which
most people now read as a heading or a comment. `//` stays the only comment.

## Map settings

Settings are keywords on the map itself, given with `@map`:

```
@map [
  title="Tea Shop",
  style=wardley,                                    // wardley, plain, handwritten or dark
  evolution=("Genesis", "Custom built", "Product", "Commodity"),
  stages=(17.4, 40, 70),                            // where the stage boundaries fall
  visibility=("Visible", "Invisible"),
  form=practice,                                    // stage names for practices
]
```

One statement, but with a setting per line, two people changing different
settings don't collide. `form=` picks Wardley's stage names for the whole map,
and `evolution=` overrides them. `@map` belongs at the top; if there are two,
the linter says so.

## Later

All of these fit the grammar above, with no new syntax.

**Submaps.** A component that stands for a whole map, opened by clicking. Its
children use the submap's own coordinates:

```
Ordering [70, 55, submap] {
  Till [80, 70]
  Card Reader [40, 85, sourcing=buy]
  Till -- Card Reader
}
Payments [60, 70, submap, url="https://maptogether.io/r/abc123"]
```

**Areas.** A boundary drawn around some components: an area of interest, a
team, or Wardley's pioneers, settlers and town planners. An area isn't a
component: it has no position of its own and nothing links to it. So it's a
directive, and its children are references to components declared elsewhere,
which also lets a component be in more than one area:

```
@area Front of house [attitude=settlers] {
  Staff
  Cup
}
```

**Numbered annotations.** A note attached to components instead of a point,
numbered in order with its text in a legend:

```
"Standardised power lets kettles evolve" [on=(Kettle, Power)]
```

**Accelerators and deaccelerators.** `force=accelerate` or
`force=decelerate` on the component they act on.

**New component types.** `@type` adds a type flag, with a built-in type to
fall back on:

```
@type regulator [base=component, shape=hexagon]

FCA [70, 40, regulator]
```

**Futures and scenarios.** `evolve=` covers one component moving right.
Wardley maps also show lines of the future and new components. One way to do
that is a directive whose children overlay the map: the same name is a future
position, a new name a future component, and a link a line of the future.

```
@future {
  Kettle [33, 80]
  Smart Kettle [45, 30]
  Smart Kettle -- Power
}
```

This needs more work: how it interacts with `evolve=`, whether scenarios are
named, and what the canvas does when you drag a future position.

## What changes from today

| Today | v2 | Why |
| --- | --- | --- |
| `Kettle [33, 50]` | unchanged | |
| `Kettle [33, 50] (label=-40,10)` | `Kettle [33, 50, label=(-40, 10)]` | one argument list |
| `needer.needed` | `needer -- needed` | dots appear in names |
| `a.(t=constraint)b` | `a == b` | |
| `Tea [55, 73] { Loose Leaf [55, 56] }` | unchanged | |
| `/mapstyle(title="…")` | `@map [title="…"]` | one directive sigil |
| `# note [40, 50]` | `"note" [40, 50]` | `#` reads as a heading |
| `government:2` | `Government:regulator` (`:2` still works) | |
| `name^` | `evolve=`, or `@future` later | |

The current parser reads the old syntax, so the upgrade can be automatic:
detect a v1 map (an `a.b` link or a `(…)` argument block), rewrite it once,
and keep the old text in the room's history.

### Importing OnlineWardleyMaps

Coordinates are × 100:

| OnlineWardleyMaps | v2 |
| --- | --- |
| `component Kettle [0.33, 0.5]` | `Kettle [33, 50]` |
| `anchor Business [0.95, 0.46]` | `Business [95, 46, user]` |
| `market Power [0.1, 0.86]` | `Power [10, 86, market]` |
| `component Kettle [0.33, 0.5] inertia` | `Kettle [33, 50, inertia]` |
| `component Kettle [..] label [-40, 10]` | `Kettle [.., label=(-40, 10)]` |
| `evolve Kettle 0.8` | `evolve=80` on Kettle |
| `build Kettle`, `(buy)` | `sourcing=build`, `sourcing=buy` on Kettle |
| `pipeline Tea [0.15, 0.9]` | braces on Tea |
| `A->B` | `A -- B` |
| `A+>B`, `A+'£1'>B` | `A -- B [flow]`, `A -- B [flow, label="£1"]` |
| `A->B; text` | `A -- B [label="text"]` |
| `note text [0.4, 0.5]` | `"text" [40, 50]` |
| `title`, `style`, `evolution A->B->C->D` | `@map [title=…, style=…, evolution=(…)]` |
| `size [1024, 768]` | dropped: the canvas has no fixed size |

## Coverage

Everything in Wardley's [notation guide](https://www.wardleymaps.com/notation)
and the main tools:

| Element | v2 |
| --- | --- |
| Component; user (anchor) | name; `user` |
| Activity, practice, data, knowledge | `form` |
| Market, ecosystem | `market`, `ecosystem` |
| Build, buy, outsource | `sourcing` |
| Inertia | `inertia` |
| Future position, point of change | `evolve` |
| Dependency, constraint, flow | `--`, `==`, `flow` |
| Pipeline | braces |
| Notes | `"text"` |
| Evolution stage names and widths, axis labels, style, title | `@map` |
| Submap, area, pioneers / settlers / town planners | later: `submap`, `@area` |
| Numbered annotations, accelerators | later: `on=`, `force=` |
| Line of the future | later: `@future` |
| Custom symbols | later: `@type` |

## Alternatives considered

- **Separate `[position]` and `(attributes)`**, as today. The position would
  have its own brackets for the canvas to rewrite, but each component would
  have two argument lists that look alike. With positional arguments first,
  one list is just as easy to rewrite.
- **Bare values as shorthand** (`[33, 50, build]` meaning `sourcing=build`).
  Shorter, but every value of every key becomes a word you can't use as a key,
  and readers have to know which key `build` belongs to.
- **Indentation instead of braces.** Concurrent edits and pasting break
  indentation silently, and a missing brace is easier to report than a wrong
  indent.
- **A keyword per statement** (`component Kettle …`, as in
  OnlineWardleyMaps). Explicit, but most lines are components and links, so
  it's noise, and it makes the canvas's edits longer.
- **One operator, with the link type as an argument**
  (`A -- B [constraint]`). Simpler grammar, but constraints are common enough
  to deserve an operator.
- **YAML or JSON.** Precise, but unpleasant to write by hand, and writing by
  hand is the point.

## Open questions

1. **The link operator.** `--` and `==`, or something else from the table?
2. **Strict commas?** Tolerating missing commas keeps lines drawing, but means
   two spellings of the same thing exist in the wild until the formatter runs.
3. **Synonyms.** Did `:2` also mean two names for one thing? If so, `alias=`.
4. **Link text.** `label="…"` on links but `label=(x, y)` on components, or
   `text="…"` on links?
5. **Should braces on a component always mean a pipeline?** It's the one place
   something is inferred. `submap` would override it.
6. **Name matching.** Case-sensitive as today? Case-insensitive with a lint
   warning would catch `kettle -- power` typos.

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
