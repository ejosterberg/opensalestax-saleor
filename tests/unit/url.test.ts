// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

import { stripTrailingSlashes } from '../../src/lib/url';

describe('stripTrailingSlashes', () => {
  it('returns the string unchanged when no trailing slash', () => {
    expect(stripTrailingSlashes('http://x.com')).toBe('http://x.com');
  });

  it('strips a single trailing slash', () => {
    expect(stripTrailingSlashes('http://x.com/')).toBe('http://x.com');
  });

  it('strips repeated trailing slashes', () => {
    expect(stripTrailingSlashes('http://x.com////')).toBe('http://x.com');
  });

  it('preserves embedded slashes', () => {
    expect(stripTrailingSlashes('http://x.com/api/v1')).toBe('http://x.com/api/v1');
  });

  it('handles empty string', () => {
    expect(stripTrailingSlashes('')).toBe('');
  });

  it('handles a string that is just slashes', () => {
    expect(stripTrailingSlashes('////')).toBe('');
  });
});
