import { expect, it } from "vitest";

import { appleDevice } from "./BrowserPlatform";

it("reads the platform from client hints when the browser has them", () => {
  expect(appleDevice({ userAgentData: { platform: "macOS" }, platform: "Win32" })).toBe(true);
  expect(appleDevice({ userAgentData: { platform: "Windows" }, platform: "MacIntel" })).toBe(false);
});

it.each(["MacIntel", "iPhone", "iPad"])("counts %s as Apple", (platform) => {
  expect(appleDevice({ userAgentData: null, platform })).toBe(true);
});

it.each([{ platform: "Win32" }, { platform: "Linux armv8l" }, {}])(
  "counts other platforms, or none, as not Apple (%o)",
  (source) => {
    expect(appleDevice(source)).toBe(false);
  },
);
