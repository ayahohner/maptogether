/** The parts of `navigator` that name the operating system. */
interface PlatformSource {
  /** Only in Chromium browsers, and only over HTTPS. */
  userAgentData?: { platform: string } | null;
  /** Deprecated, but the only source in Safari and Firefox. */
  platform?: string;
}

/** Whether the device runs macOS or iOS, where shortcuts use Cmd instead of Ctrl. */
export const appleDevice = ({ userAgentData, platform }: PlatformSource) =>
  /mac|iphone|ipad|ipod/i.test(userAgentData?.platform ?? platform ?? "");

export const isApple = appleDevice(navigator as PlatformSource);
