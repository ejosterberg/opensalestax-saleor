// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Strip trailing forward slashes from a URL string.
 *
 * Imperative version of `s.replace(/\/+$/, '')` â€” avoids a regex
 * with a `+` quantifier so static analyzers stop flagging it as a
 * potential ReDoS vector (the regex is mathematically O(n) safe;
 * this is a portability tweak, not a correctness fix).
 */
export function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.codePointAt(end - 1) === 47 /* '/' */) {
    end -= 1;
  }
  return s.slice(0, end);
}
