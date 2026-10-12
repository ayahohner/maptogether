import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { collaboration } from "../sync/presence";
import { CollaborationBadge } from "./CollaborationBadge";

it("shows only names in the hover panel and provides accessible save status", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  collaboration.status = "saved";
  collaboration.users = [
    { id: 123, name: "Quiet Otter", color: "#30bced", self: true },
    { id: 456, name: "Calm Finch", color: "#ee6352", self: false },
  ];
  await act(async () => root.render(<CollaborationBadge />));
  const indicator = host.querySelector<HTMLElement>('[role="group"]')!;
  expect(host.querySelector("button")).toBeNull();
  expect(indicator.textContent).toBe("2");
  expect(indicator.getAttribute("aria-label")).toBe("People");
  expect(indicator.title).toBe("Saved");
  expect(host.querySelector(".sync-light")?.getAttribute("aria-label")).toBe(
    "Saved",
  );
  await act(async () => indicator.focus());
  const panel = host.querySelector(".collaboration-popover")!;
  expect(panel.textContent).toBe("Quiet OtterCalm Finch");
  await act(async () =>
    indicator.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(host.querySelector(".collaboration-popover")).toBeNull();
  await act(async () => indicator.click());
  expect(host.querySelector(".collaboration-popover")).toBeNull();
  await act(async () =>
    indicator.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  expect(host.querySelector(".collaboration-popover")).not.toBeNull();
  await act(async () =>
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    ),
  );
  expect(host.querySelector(".collaboration-popover")).toBeNull();
  await act(async () => root.unmount());
  host.remove();
});
