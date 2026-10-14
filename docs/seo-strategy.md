# SEO strategy

How MapTogether gets found by people searching for a Wardley mapping tool, and
by the AI answer engines that increasingly answer those searches for them.

## The constraint

MapTogether drops visitors straight into a blank map at `/`. That map is a
draft: it gets its own `/<map-id>` URL, is saved, and connects to the relay only
when someone first edits it (the text is the source of truth, and dragging on
the canvas edits the text) or clicks Share. Loading the demo isn't an edit.
So crawlers and people who only look create no maps and cost no relay calls,
and `/` stays one stable, indexable URL. Even so the site has only one public
page, and every other URL is somebody's private map.

There is deliberately no separate `/about` page: it would duplicate the home
page's content and split its ranking signals. The About text lives in `/`.

So the plan is:

1. Make the home page excellent for the "I want a tool" searches.
2. Keep every map page out of the index.
3. Add a small number of genuinely useful pages for the searches one page
   can't serve, such as templates and syntax docs. No thin keyword pages.

## Search intent → page

| Searches (examples) | Intent | Page |
| --- | --- | --- |
| wardley mapping tool, wardley map online, online wardley map, free wardley mapping tool, wardley map maker / creator / software | Wants a tool now | `/` (home) |
| multiplayer wardley mapping, collaborative wardley map, real-time wardley mapping, wardley mapping for teams | Wants to map with others | `/` (home), then a workshop guide |
| wardley map template, wardley map example, tea shop wardley map | Wants a starting point | `/templates` (each opens as a new map) |
| wardley map as code, wardley map text syntax, onlinewardleymaps alternative | Prefers text | `/docs/syntax` |
| run a wardley mapping workshop, remote wardley mapping | Facilitators | `/guides/wardley-mapping-workshop` |
| what is a wardley map, wardley map evolution stages | Learning | Short section on `/` now; a guide only if it adds something (interactive examples) |

"Multiplayer" and "collaborative" Wardley mapping are the terms where we are
most clearly the best answer and competition is thin: win those first. "Online
Wardley mapping tool" is more competitive (OnlineWardleyMaps, Miro and Mural
templates, draw.io) and will follow as links and usage grow.

## Done in this change

- **Title, description and canonical** aimed at the tool searches.
  Title: "MapTogether: Collaborative Wardley Mapping Tool, Free Online".
- **Crawlable intro.** The About dialog (also the first-visit welcome) is
  static HTML in `index.html`, with the H1 "Collaborative Wardley mapping, right
  in your browser", a plain description, features, and a short "What is a
  Wardley map?" section, always expanded. The dialog is `open` in the HTML
  itself, so it is visible even before any script runs. Crawlers that don't run JavaScript (Bing in part, most
  AI crawlers) read it in the raw HTML; Google sees it rendered, since it
  visits as a first-time user. An inline script opens it before the app
  bundle loads, so it is also the page's fast LCP element.
- **Structured data.** JSON-LD `WebSite` and `WebApplication` (free offer,
  feature list, `about` linked to the Wikipedia entity for Wardley maps).
  No `aggregateRating` or FAQ markup: we have no genuine reviews to mark up,
  and FAQ rich results are limited to authoritative government and health
  sites.
- **Map pages stay out of search.** `/<map-id>` pages get
  `<meta name="robots" content="noindex">` and drop the canonical link
  (`src/app/seo.ts`). They are not blocked in `robots.txt`, because a blocked
  page can't be seen to be noindexed.
- **Crawl files.** `robots.txt` (allows all crawlers, AI crawlers included),
  `sitemap.xml`, and `llms.txt`, a plain summary of what MapTogether is
  for LLM-based answer engines.
- **Sharing and install.** Open Graph and Twitter card with a 1200×630 image
  (source in `docs/og-image.html`), SVG favicon, touch and PWA icons, and a web
  manifest.
- **GitHub repo under the brand name.** The repo is
  [ayahohner/maptogether](https://github.com/ayahohner/maptogether), renamed
  from `wmaps` (GitHub redirects the old URLs). Its description says what the
  site says, its homepage is `maptogether.io`, and its topics cover the
  searches above (`wardley-maps`, `wardley-mapping`, `wardley-map`,
  `wardleymaps`, `multiplayer`, `real-time-collaboration`,
  `collaborative-editing`, `diagrams-as-code`, `strategy`) and the stack
  (`yjs`, `crdt`, `webrtc`, `pixijs`, `codemirror`, `durable-objects`…), so
  it shows up on those topic pages and in GitHub search. The README leads with
  the app and links to it.

## Next, in order

1. **Search Console and Bing Webmaster Tools.** Verify `maptogether.io`,
   submit the sitemap, and watch impressions for the terms above. Turn on
   IndexNow for Bing on deploy.
2. **Templates page.** `/templates` with 6–10 real maps (tea shop,
   e-commerce, a SaaS platform, an ML pipeline, a public service…), each
   with a picture, two paragraphs on what it shows, and "Open this map" →
   `/?template=<name>` (the same mechanism as `/?demo`). It answers
   "wardley map template/example" and is useful to existing users.
3. **Syntax docs.** `/docs/syntax`: the help panel's Code editor content as a
   page, with examples. It serves the as-code searches and gives other sites
   something worth linking to.
4. **Static rendering for those pages.** Build them as extra Vite HTML
   entry points sharing `design.css` (no new framework), so each one is
   complete HTML with its own title, description, canonical and sitemap entry.
5. **Core Web Vitals.** The app bundle is about 1.5 MB (Pixi, CodeMirror,
   Yjs). Split it so the top bar and welcome paint first, and load Segment and
   Heap after the page is interactive.
6. **Workshop guide.** One solid guide to running a Wardley mapping
   workshop in MapTogether, in person or remote, written from real sessions.

## Links and mentions (off-site)

The Wardley mapping community is small and close-knit, so a few relevant
mentions matter more than volume:

- Ask to be listed where practitioners look for tools: the
  [awesome-wardley-maps](https://github.com/wardley-maps-community/awesome-wardley-maps)
  list, Learn Wardley Mapping's tools page, and the Wardley Maps community.
- Launch on Show HN and Product Hunt once templates and mobile support ship,
  since each is a reason to talk about it.
- Every shared map link already brings in new people. When image export
  ships, a small "Made with MapTogether" credit on exports extends that.

## What we won't do

Buying links, mass-produced keyword pages ("Wardley mapping tool for
[industry]"), AI-generated filler, fake reviews or rating markup, hidden text,
or keyword stuffing. They break search engine policies and, in a field this
small, would cost us the community's trust.

## AI answer engines

Google AI Overviews and AI Mode, ChatGPT search, Perplexity and Claude cite
pages that state facts plainly. To be the tool they recommend:

- Keep the About copy factual and self-contained: what it is, that it is free,
  multiplayer, no sign-up, browser-based.
- Use the same name, MapTogether, and the same one-line description on the site,
  GitHub, and anywhere else we're listed. The repo's name and description now
  match; keep them in step when the site's description changes.
- Keep `llms.txt` and the JSON-LD current when features change.
- Being on the community lists above matters doubly, since those pages
  are what answer engines read when asked for a Wardley mapping tool.
