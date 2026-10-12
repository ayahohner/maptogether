/**
 * Only the home page (`/`) should be indexed. Each map lives at its own
 * `/<map-id>` URL and holds a team's private work, so map pages ask search
 * engines not to index them. They drop the canonical link too, since Google
 * treats noindex plus a canonical to another page as a mixed signal.
 */
export function keepMapOutOfSearch(isNewMap: boolean, doc: Document = document) {
  if (isNewMap) return;
  doc.querySelector('link[rel="canonical"]')?.remove();
  const robots = doc.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex";
  doc.head.append(robots);
}
