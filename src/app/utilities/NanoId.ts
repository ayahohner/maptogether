/// local version of nanoid so we don't have to add a dependency for 130 bytes
export const nanoid = (size = 21) =>
  crypto
    .getRandomValues(new Uint8Array(size))
    .reduce(
      (t, e) =>
        (t +=
          (e &= 63) < 36
            ? e.toString(36)
            : e < 62
              ? (e - 26).toString(36).toUpperCase()
              : e > 62
                ? "-"
                : "_"),
      "",
    );
