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
