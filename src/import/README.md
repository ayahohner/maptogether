# Importers

Each file here converts map text from another syntax to the current one, and
returns an `ImportResult` (`types.ts`): the converted text, and the lines it
couldn't carry over.

| File | From |
| --- | --- |
| `v1.ts` | MapTogether's v1 syntax (`Kettle [33, 50]`, `needer.needed`), used until 5.0 |
| `owm.ts` | OnlineWardleyMaps (`component Kettle [0.33, 0.5]`, `A->B`) |

When the syntax changes again, add the importer for the version it replaces
(`v2.ts` for v3), and keep the older ones. An importer reads its syntax line
by line, without that version's parser, so it keeps working after the parser
is deleted. A line it can't convert stays in the text as a comment
(`// v1: …`, `// owm: …`), so nothing is lost.
