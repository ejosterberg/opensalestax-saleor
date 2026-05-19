// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

import { loadConfig, parseNexusStates } from '../../src/lib/config';

function baseEnv(): NodeJS.ProcessEnv {
  return {
    APP_API_BASE_URL: 'https://app.example.com',
    OSTAX_API_URL: 'http://engine.local:8080',
  };
}

describe('loadConfig', () => {
  it('returns defaults for optional vars', () => {
    const cfg = loadConfig(baseEnv());
    expect(cfg.port).toBe(3000);
    expect(cfg.failHard).toBe(false);
    expect(cfg.ostaxTimeoutMs).toBe(5000);
    expect(cfg.ostaxApiKey).toBeUndefined();
    expect(cfg.saleor.apiUrl).toBe('');
  });

  it('strips trailing slashes from URLs', () => {
    const cfg = loadConfig({
      ...baseEnv(),
      APP_API_BASE_URL: 'https://app.example.com///',
      OSTAX_API_URL: 'http://engine.local:8080/',
    });
    expect(cfg.appBaseUrl).toBe('https://app.example.com');
    expect(cfg.ostaxApiUrl).toBe('http://engine.local:8080');
  });

  it('rejects missing APP_API_BASE_URL', () => {
    const env = baseEnv();
    delete env.APP_API_BASE_URL;
    expect(() => loadConfig(env)).toThrow(/APP_API_BASE_URL is required/);
  });

  it('rejects missing OSTAX_API_URL', () => {
    const env = baseEnv();
    delete env.OSTAX_API_URL;
    expect(() => loadConfig(env)).toThrow(/OSTAX_API_URL is required/);
  });

  it('rejects non-http(s) URLs', () => {
    expect(() =>
      loadConfig({ ...baseEnv(), OSTAX_API_URL: 'file:///etc/passwd' }),
    ).toThrow(/must be http\(s\)/);
  });

  it('rejects malformed URLs', () => {
    expect(() => loadConfig({ ...baseEnv(), OSTAX_API_URL: 'not-a-url' })).toThrow(
      /Invalid OSTAX_API_URL/,
    );
  });

  it('parses OSTAX_FAIL_HARD truthy values', () => {
    expect(loadConfig({ ...baseEnv(), OSTAX_FAIL_HARD: '1' }).failHard).toBe(true);
    expect(loadConfig({ ...baseEnv(), OSTAX_FAIL_HARD: 'true' }).failHard).toBe(true);
    expect(loadConfig({ ...baseEnv(), OSTAX_FAIL_HARD: 'yes' }).failHard).toBe(true);
  });

  it('parses OSTAX_FAIL_HARD falsey values', () => {
    expect(loadConfig({ ...baseEnv(), OSTAX_FAIL_HARD: '0' }).failHard).toBe(false);
    expect(loadConfig({ ...baseEnv(), OSTAX_FAIL_HARD: 'false' }).failHard).toBe(false);
    expect(loadConfig({ ...baseEnv(), OSTAX_FAIL_HARD: '' }).failHard).toBe(false);
  });

  it('rejects PORT out of range', () => {
    expect(() => loadConfig({ ...baseEnv(), PORT: '-1' })).toThrow(/Invalid PORT/);
    expect(() => loadConfig({ ...baseEnv(), PORT: '99999' })).toThrow(/Invalid PORT/);
    expect(() => loadConfig({ ...baseEnv(), PORT: 'abc' })).toThrow(/Invalid PORT/);
  });

  it('accepts PORT=0 (OS-assigned)', () => {
    expect(loadConfig({ ...baseEnv(), PORT: '0' }).port).toBe(0);
  });

  it('accepts a custom port', () => {
    const cfg = loadConfig({ ...baseEnv(), PORT: '8081' });
    expect(cfg.port).toBe(8081);
  });

  it('rejects non-positive OSTAX_TIMEOUT_MS', () => {
    expect(() => loadConfig({ ...baseEnv(), OSTAX_TIMEOUT_MS: '-1' })).toThrow(
      /Invalid OSTAX_TIMEOUT_MS/,
    );
  });

  it('defaults nexusStates to an empty set when OSTAX_NEXUS_STATES is unset', () => {
    const cfg = loadConfig(baseEnv());
    expect(cfg.nexusStates.size).toBe(0);
  });

  it('parses OSTAX_NEXUS_STATES into a set of upper-case 2-letter codes', () => {
    const cfg = loadConfig({ ...baseEnv(), OSTAX_NEXUS_STATES: 'mn, wi, IA' });
    expect([...cfg.nexusStates].sort()).toEqual(['IA', 'MN', 'WI']);
  });

  it('passes through Saleor APL seed values', () => {
    const cfg = loadConfig({
      ...baseEnv(),
      SALEOR_API_URL: 'https://shop.saleor.io/graphql/',
      SALEOR_APP_ID: 'app-id',
      SALEOR_APP_TOKEN: 'tok',
    });
    expect(cfg.saleor.apiUrl).toBe('https://shop.saleor.io/graphql/');
    expect(cfg.saleor.appId).toBe('app-id');
    expect(cfg.saleor.appToken).toBe('tok');
  });
});

describe('parseNexusStates', () => {
  it('returns empty set for undefined', () => {
    expect(parseNexusStates(undefined).size).toBe(0);
  });

  it('returns empty set for empty / whitespace-only input', () => {
    expect(parseNexusStates('').size).toBe(0);
    expect(parseNexusStates('   ').size).toBe(0);
  });

  it('parses a simple comma-separated list', () => {
    const set = parseNexusStates('MN,WI,IA');
    expect([...set].sort()).toEqual(['IA', 'MN', 'WI']);
  });

  it('normalizes lowercase + mixed whitespace', () => {
    const set = parseNexusStates(' mn , wi  iA  ');
    expect([...set].sort()).toEqual(['IA', 'MN', 'WI']);
  });

  it('drops malformed tokens silently', () => {
    const set = parseNexusStates('MN, Minnesota, 12, XX, wi');
    // Minnesota (len 9) and 12 (not alpha) drop; XX passes regex but is
    // a junk code — we intentionally don't validate against the real
    // 50-state list (would couple to a static table). XX stays.
    expect([...set].sort()).toEqual(['MN', 'WI', 'XX']);
  });

  it('returns frozen set (immutable)', () => {
    const set = parseNexusStates('MN');
    expect(Object.isFrozen(set)).toBe(true);
  });
});
