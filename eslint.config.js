import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Layer rules: lower layers must not import from higher ones, so shared code stays reusable
// and features stay removable. (See CLAUDE.md → Folder structure.)
const noImport = (...layers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: layers.map((layer) => ({
        group: [`**/${layer}`, `**/${layer}/**`],
        message: `This folder must not import from src/${layer} (see CLAUDE.md → Folder structure).`,
      })),
    },
  ],
})

// Project rules that run instead of living only in CLAUDE.md. Every message says what is
// wrong, WHY it matters and how to FIX it, so the agent can fix it without guessing.
const ban = (selector, why, fix) => ({ selector, message: `${why} FIX: ${fix}` })

const appCodeRules = [
  ban(
    "CallExpression[callee.object.name='console'][callee.property.name=/^(log|debug|info|trace|dir|table)$/]",
    'Debug output left in app code.',
    'remove it. Real errors go through console.error or src/lib/monitoring.ts.',
  ),
  ban(
    "MemberExpression[object.name='process'][property.name='env']",
    'process.env is undefined in the browser (Vite does not provide it).',
    'read config from src/lib/env.ts (backed by import.meta.env).',
  ),
  ban(
    "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    'Raw HTML opens an XSS hole.',
    'render the content as JSX/text. If HTML is unavoidable, stop and ask the human.',
  ),
  ban(
    "JSXAttribute[name.name='key'] > JSXExpressionContainer > Identifier[name=/^(i|idx|index)$/]",
    'An index as key breaks state and focus when the list is reordered or filtered.',
    'use a stable id from the data (e.g. key={item.id}).',
  ),
]

const testRules = [
  ban(
    "CallExpression[callee.object.name=/^(it|test|describe)$/][callee.property.name='only']",
    '.only runs one test and silently skips the rest, so a green run proves nothing.',
    'remove .only before finishing.',
  ),
  ban(
    "CallExpression[callee.object.name=/^(it|test|describe)$/][callee.property.name='skip']",
    'A skipped test is a disabled check (CLAUDE.md: never disable a test to get green).',
    'make it pass, or delete it with the human’s OK.',
  ),
]

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'src/services/generatedApi.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx', 'src/test/**'],
    ...reactRefresh.configs.vite,
    rules: {
      'react-refresh/only-export-components': ['error', { allowExportNames: ['routes'] }],
    },
  },
  {
    // Harness CLIs run in Node, not the browser.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.*', 'src/test/**', 'src/mocks/**'],
    rules: { 'no-restricted-syntax': ['error', ...appCodeRules] },
  },
  {
    files: ['src/**/*.test.*', 'e2e/**'],
    rules: { 'no-restricted-syntax': ['error', ...testRules] },
  },
  {
    // Data fetching lives in RTK Query (src/services), never in UI code.
    files: ['src/{components,features,routes,hooks,stores}/**'],
    ignores: ['src/**/*.test.*'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest'].map((name) => ({
          name,
          message:
            'Network calls in UI code are hard to test and repeat loading/error logic. ' +
            'FIX: add an endpoint in src/services (RTK Query) and use its generated hook.',
        })),
      ],
    },
  },
  {
    files: ['src/lib/**', 'src/types/**'],
    ignores: ['src/**/*.test.*'],
    rules: noImport('features', 'routes', 'components', 'hooks', 'services', 'stores'),
  },
  {
    files: ['src/components/**', 'src/hooks/**', 'src/stores/**', 'src/services/**'],
    ignores: ['src/**/*.test.*'],
    rules: noImport('features', 'routes'),
  },
  {
    files: ['src/features/**'],
    ignores: ['src/**/*.test.*'],
    rules: noImport('routes'),
  },
)
