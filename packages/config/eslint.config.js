import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import i18next from 'eslint-plugin-i18next';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.vercel/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      i18next,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      'i18next/no-literal-string': [
        'error',
        {
          ignoreAttribute: ['className', 'data-testid', 'type', 'variant'],
          markupOnly: true,
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
  {
    // TRD §4: the queue engine imports nothing outside its own folder.
    files: ['packages/queue-engine/src/**/*.ts'],
    ignores: ['**/*.test.ts', 'packages/queue-engine/src/testing/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\./)',
              message:
                'packages/queue-engine is pure TypeScript: relative imports only (TRD §4).',
            },
          ],
        },
      ],
    },
  },
);
