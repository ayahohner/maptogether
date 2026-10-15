# Syntax drafts

Ideas for MapTogether's map syntax, written in 2022 while the syntax was being
designed. They are not the current syntax: the help panel's Code editor topic
(`src/help/topics.ts`) and [`examples/`](../../examples) show what the app
draws today.

- [`drafts.mt`](drafts.mt): the planned syntax for components (definitions,
  futures `^`, types, labels), links (labels, types such as constraints),
  notes, and a map header. Its second half is earlier experiments.
- [`proposal-v2.md`](proposal-v2.md): a 2026 proposal for a revised syntax
  covering every Wardley map element, settings, extensions and nesting.
- [`lots-of-components.mt`](lots-of-components.mt): a map with about 100
  components and the draft header, for trying the editor and map with a large
  map.

## Map header

`drafts.mt` starts with the header planned for setting the map's title and
other details:

```
/mapstyle(
  title="Society"
  perspective="modern society"
  created="2022-08-20 23:20 GMT+1"
  iteration=2
  evolutionlabels=genesis:10,emerging:25,converging:40,commodity:30
  y-axis
  style=wardley
  scriptversion="1.0.1"
)
```

The parser already reads it (a command with attributes, in
`src/parser/TogetherParser.ts`), but the map ignores commands, so using it
needs only drawing code.

## OnlineWardleyMaps

[`examples/owm/`](../../examples/owm) holds maps in OnlineWardleyMaps' syntax
(`component Name [visibility, evolution]`, values 0–1, links `A->B`).
`src/parser/WardleyParser.ts` reads that syntax; the app doesn't use it yet.
They are a starting point for importing OnlineWardleyMaps maps, and for the
syntax and templates pages in [`../seo-strategy.md`](../seo-strategy.md).
