import { beforeEach, expect, it } from "vitest";
import { keepMapOutOfSearch } from "./seo";

beforeEach(() => {
  document.head.innerHTML = `<link rel="canonical" href="https://maptogether.io/" />`;
});

it("leaves the home page indexable", () => {
  keepMapOutOfSearch(true);
  expect(document.querySelector('meta[name="robots"]')).toBeNull();
  expect(document.querySelector('link[rel="canonical"]')).not.toBeNull();
});

it("keeps existing maps out of search results", () => {
  keepMapOutOfSearch(false);
  expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
});
