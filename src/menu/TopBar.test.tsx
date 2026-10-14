import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TopBar } from "./index";
import { ui } from "../state/Ui";

const writeText = vi.fn();
Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const props = { onAbout: vi.fn(), onDemo: vi.fn(), onShare: vi.fn(), onExport: vi.fn() };

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<TopBar {...props} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

const openMenu = async () => {
  const more = host.querySelector<HTMLButtonElement>('[aria-label="More"]')!;
  await act(async () => {
    more.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    more.click();
  });
  return [...document.querySelectorAll<HTMLElement>(".menu-item")];
};

const clickItem = async (label: string) => {
  const item = (await openMenu()).find((el) => el.textContent?.includes(label))!;
  await act(async () => item.click());
};

it("shows the brand, people, a new map link and sharing", () => {
  expect(host.textContent).toContain("MapTogether");
  expect(host.querySelector('[aria-label="People"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="New map"]')?.getAttribute("href")).toBe("/");
  expect(host.textContent).toContain("Share");
});

const shareButton = () =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === "Share")!;

it("copies the map's link and confirms it", async () => {
  writeText.mockResolvedValue(undefined);
  const share = shareButton();
  await act(async () => share.click());
  expect(props.onShare).toHaveBeenCalledOnce();
  expect(writeText).toHaveBeenCalledWith(document.location.href);
  expect(share.textContent).toBe("Link copied");
});

it("doesn't confirm a link the browser refused to copy", async () => {
  writeText.mockRejectedValue(new Error("denied"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const share = shareButton();
  await act(async () => share.click());
  expect(share.textContent).toBe("Share");
  expect(logged).toHaveBeenCalled();
});

it("lists About, help, the demo map, export, feedback and the version in the overflow menu", async () => {
  const labels = (await openMenu()).map((el) => el.textContent);
  expect(labels).toEqual([
    " About MapTogether",
    " Help and shortcuts",
    " Open the demo map",
    " PNG image",
    " SVG vector image",
    " Send feedback",
  ]);
  expect(document.body.textContent).toContain("Export");
  expect(document.body.textContent).toContain(`Version ${__APP_VERSION__}`);
});

it("runs each menu action", async () => {
  await clickItem("About");
  expect(props.onAbout).toHaveBeenCalledOnce();
  await clickItem("demo map");
  expect(props.onDemo).toHaveBeenCalledOnce();
  await clickItem("Help");
  expect(ui.help.open).toBe(true);
  await clickItem("PNG");
  expect(props.onExport).toHaveBeenLastCalledWith("png");
  await clickItem("SVG");
  expect(props.onExport).toHaveBeenLastCalledWith("svg");
});
