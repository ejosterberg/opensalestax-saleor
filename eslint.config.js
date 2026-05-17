// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * ESLint flat configuration.
 *
 * Migrated from `.eslintrc.cjs` for ESLint 9. The `typescript-eslint`
 * unified package replaces the separate `@typescript-eslint/parser`
 * and `@typescript-eslint/eslint-plugin` deps.
 */

const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', '**/*.cjs', '**/*.js'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        // Node + Jest globals â€” flat config drops the `env` shorthand,
        // so we declare the ones we use explicitly.
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        AbortController: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        RequestInit: 'readonly',
        RequestInfo: 'readonly',
        HeadersInit: 'readonly',
        BodyInit: 'readonly',
        AbortSignal: 'readonly',
        NodeJS: 'readonly',
        // Jest
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': 'off',
    },
  },
);
