/**
 * Only the home page (`/`) should be indexed. Each map is at its own
 * `/<map-id>` URL and holds a team's private work, so map pages are marked
 * noindex. They drop the canonical link too, since Google
 * treats noindex plus a canonical to another page as a mixed signal.
 * A draft map at `/` stays indexable until it is created.
 */
export function keepMapOutOfSearch(isNewMap: boolean, doc: Document = document) {
  if (isNewMap) return;
  doc.querySelector('link[rel="canonical"]')?.remove();
  const robots = doc.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex";
  doc.head.append(robots);
}
