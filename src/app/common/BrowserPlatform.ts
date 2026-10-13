function getPlatform() {
  // 2022 way of detecting. Note : this userAgentData feature is available only in secure contexts (HTTPS)
  if (
    // @ts-expect-error
    typeof navigator.userAgentData !== "undefined" &&
    // @ts-expect-error
    navigator.userAgentData != null
  ) {
    // @ts-expect-error
    return navigator.userAgentData.platform;
  }
  // Deprecated but still works for most of the browser
  if (typeof navigator.platform !== "undefined") {
    if (
      typeof navigator.userAgent !== "undefined" &&
      /android/.test(navigator.userAgent.toLowerCase())
    ) {
      // android device’s navigator.platform is often set as 'linux', so let’s use userAgent for them
      return "android";
    }
    return navigator.platform;
  }

  return "unknown";
}

export const platform = getPlatform().toLowerCase();

export const isOSX = /mac/.test(platform); // Mac desktop
export const isIOS = ["iphone", "ipad", "ipod"].includes(platform); // Mac iOs
export const isApple = isOSX || isIOS; // Apple device (desktop or iOS)
export const isWindows = /win/.test(platform); // Windows
export const isAndroid = /android/.test(platform); // Android
export const isLinux = /linux/.test(platform); // Linux
