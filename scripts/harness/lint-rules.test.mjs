// @vitest-environment node
// The project rules in eslint.config.js fire where they should, stay quiet where they
// shouldn't, and carry a FIX line. Lints in-memory snippets as if they lived at `file`.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({ cwd: join(dirname(fileURLToPath(import.meta.url)), '..', '..') })

async function messages(file, code) {
  const [result] = await eslint.lintText(code, { filePath: file })
  return result.messages
    .filter((m) => /no-restricted-(syntax|globals)/.test(m.ruleId ?? ''))
    .map((m) => m.message)
}

describe('project lint rules', () => {
  it.each([
    ['src/lib/a.ts', "console.log('x')\n", /Debug output.*FIX/],
    [
      'src/lib/a.ts',
      'export const url = process.env.API_URL\n',
      /process\.env.*FIX: .*src\/lib\/env\.ts/,
    ],
    [
      'src/components/A.tsx',
      'export const A = () => <div dangerouslySetInnerHTML={{ __html: "" }} />\n',
      /XSS.*FIX/,
    ],
    [
      'src/components/A.tsx',
      'export const A = ({ xs }: { xs: string[] }) => <ul>{xs.map((x, index) => <li key={index}>{x}</li>)}</ul>\n',
      /index as key.*FIX/,
    ],
    [
      'src/features/a/useA.ts',
      "export const load = () => fetch('/x')\n",
      /Network calls.*FIX: .*features\/<domain>\/api\.ts/,
    ],
    ['src/lib/a.test.ts', "import { it } from 'vitest'\nit.only('x', () => {})\n", /\.only.*FIX/],
    [
      'e2e/a.spec.ts',
      "import { test } from '@playwright/test'\ntest.describe.only('x', () => {})\n",
      /\.only.*FIX/,
    ],
    [
      'e2e/a.spec.ts',
      "import { test } from '@playwright/test'\ntest.fixme('x', async () => {})\n",
      /skipped test.*FIX/,
    ],
    [
      'src/components/A.tsx',
      'export const A = ({ xs }: { xs: string[] }) => <ul>{xs.map((x, i) => <li key={`row-${i}`}>{x}</li>)}</ul>\n',
      /index as key.*FIX/,
    ],
    [
      'e2e/a.spec.ts',
      "import { test } from '@playwright/test'\ntest.skip('x', () => {})\n",
      /skipped test.*FIX/,
    ],
  ])('%s: flags %s', async (file, code, expected) => {
    const found = await messages(file, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(expected)
  })

  it.each([
    ['src/lib/a.ts', "console.error('real failure')\n"],
    [
      'e2e/a.spec.ts',
      "import { test } from '@playwright/test'\ntest('x', ({ browserName }) => { test.skip(browserName === 'webkit', 'no webkit') })\n",
    ],
    [
      'src/components/A.tsx',
      'export const A = ({ xs }: { xs: { index: number }[] }) => <ul>{xs.map((x) => <li key={x.index}>{x.index}</li>)}</ul>\n',
    ],
    ['src/services/a.ts', "export const load = () => fetch('/x')\n"],
    ['src/lib/a.test.ts', "import { it } from 'vitest'\nit('x', () => {})\n"],
    [
      'src/components/A.tsx',
      'export const A = ({ xs }: { xs: { id: string }[] }) => <ul>{xs.map((x) => <li key={x.id}>{x.id}</li>)}</ul>\n',
    ],
  ])('%s: allows %s', async (file, code) => {
    expect(await messages(file, code)).toEqual([])
  })
})
