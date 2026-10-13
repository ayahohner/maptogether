/** URL-safe characters, as nanoid uses. 64 of them, so each random byte picks one by its low 6 bits. */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";

/** A random URL-safe id, as nanoid makes, without the dependency. */
export const nanoid = (size = 21) =>
  Array.from(crypto.getRandomValues(new Uint8Array(size)), (byte) => ALPHABET[byte & 63]).join("");
