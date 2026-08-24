import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// One flat config for the whole monorepo. Deliberately narrow: this exists as a
// merge gate, so a rule earns its place by catching a bug or a real footgun, not
// by encoding a formatting opinion. Type-aware rules are off — they need a
// project service per package and cost more than they return here.
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      // Linked worktrees living inside the repo carry other branches' code.
      '.claude/worktrees/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      '**/coverage/**',
      '**/*.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      // The base rule does not understand TS overloads or enums; the TS one does.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          // `const { drop, ...rest } = x` is how this repo omits a key. That is a
          // use of `drop`, not a leftover.
          ignoreRestSiblings: true,
        },
      ],
      // `any` is a judgment call this repo makes often and on purpose.
      '@typescript-eslint/no-explicit-any': 'off',
      // Catches `if (promise)` and unawaited floating calls in conditionals,
      // which is the class of bug that actually ships here.
      'no-constant-binary-expression': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },

  // React Native / React web surfaces.
  {
    files: ['apps/mobile/**/*.{ts,tsx}', 'apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2023 },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Express request augmentation is a global namespace declaration by design;
  // there is no module-syntax equivalent for it.
  {
    files: ['apps/api/src/middleware/auth.ts'],
    rules: { '@typescript-eslint/no-namespace': 'off' },
  },

  // Tests reach for globals and loose shapes on purpose.
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/jest.setup.js', '**/test/**'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Plain config and script files.
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
