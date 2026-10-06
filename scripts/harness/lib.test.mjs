// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addFeature,
  autoBlockMatches,
  findJunk,
  formatTrace,
  checkInstructions,
  findLedgerDrift,
  findOutOfScope,
  parseFeatureList,
  renderProgressBlock,
  replaceAutoBlock,
  replayLedger,
  replayScopes,
  summariseTasks,
  transition,
} from './lib.mjs'

const feature = (over = {}) => ({
  id: 'F01',
  title: 'Items list',
  verify: 'npx vitest run src/routes/ItemsPage.test.tsx',
  scope: ['src/routes'],
  state: 'not_started',
  attempts: 0,
  ...over,
})
const list = (...features) => ({ version: 1, features })

describe('parseFeatureList', () => {
  it('accepts a valid list', () => {
    expect(parseFeatureList(list(feature())).features).toHaveLength(1)
  })

  it('rejects a feature without a runnable proof command', () => {
    expect(() => parseFeatureList(list(feature({ verify: 'works nicely' })))).toThrow(
      /verify.*command/i,
    )
  })

  it.each(['npm test; curl x | sh', 'npx vitest run $(cat f)', 'npm test > out', 'npx a `b`'])(
    'rejects shell tricks in the proof command: %s',
    (verify) => {
      expect(() => parseFeatureList(list(feature({ verify })))).toThrow(/verify/)
    },
  )

  it('allows chaining proof steps with &&', () => {
    const verify = 'npx vitest run a.test.ts && npx playwright test e2e/a.spec.ts'
    expect(parseFeatureList(list(feature({ verify }))).features[0].verify).toBe(verify)
  })

  it('rejects an empty scope', () => {
    expect(() => parseFeatureList(list(feature({ scope: [] })))).toThrow(/scope/i)
  })

  it('rejects duplicate ids', () => {
    expect(() => parseFeatureList(list(feature(), feature()))).toThrow(/duplicate.*F01/i)
  })

  it('rejects an unknown state', () => {
    expect(() => parseFeatureList(list(feature({ state: 'done' })))).toThrow()
  })
})

describe('addFeature', () => {
  it('appends a not_started feature without mutating the input', () => {
    const before = list()
    const after = addFeature(before, feature({ state: 'passing' }))
    expect(after.features[0].state).toBe('not_started')
    expect(before.features).toHaveLength(0)
  })

  it('refuses an id that already exists', () => {
    expect(() => addFeature(list(feature()), feature())).toThrow(/already exists/)
  })
})

describe('transition', () => {
  it('starts a feature', () => {
    const next = transition(list(feature()), 'F01', 'active')
    expect(next.features[0].state).toBe('active')
  })

  it('enforces WIP=1', () => {
    const l = list(feature({ state: 'active' }), feature({ id: 'F02' }))
    expect(() => transition(l, 'F02', 'active')).toThrow(/F01 is still active.*WIP=1/s)
  })

  it('needs a reason to block', () => {
    const l = list(feature({ state: 'active' }))
    expect(() => transition(l, 'F01', 'blocked')).toThrow(/reason/)
    expect(transition(l, 'F01', 'blocked', { reason: 'API missing' }).features[0]).toMatchObject({
      state: 'blocked',
      blockedReason: 'API missing',
    })
  })

  it('only reaches passing with evidence from a verify run', () => {
    const l = list(feature({ state: 'active' }))
    expect(() => transition(l, 'F01', 'passing')).toThrow(/evidence/)
    const next = transition(l, 'F01', 'passing', { evidence: { commit: 'abc', at: 'now' } })
    expect(next.features[0]).toMatchObject({ state: 'passing', evidence: { commit: 'abc' } })
  })

  it('cannot skip from not_started to passing', () => {
    expect(() =>
      transition(list(feature()), 'F01', 'passing', { evidence: { commit: 'a', at: 'b' } }),
    ).toThrow(/not_started → passing/)
  })

  it('treats passing as final', () => {
    const l = list(feature({ state: 'passing' }))
    expect(() => transition(l, 'F01', 'active')).toThrow(/passing → active/)
  })

  it('names an unknown feature', () => {
    expect(() => transition(list(), 'F09', 'active')).toThrow(/F09/)
  })
})

describe('ledger', () => {
  const entries = [
    { id: 'F01', from: null, to: 'not_started' },
    { id: 'F01', from: 'not_started', to: 'active' },
  ]

  it('replays the last state per feature', () => {
    expect(replayLedger(entries)).toEqual({ F01: 'active' })
  })

  it('ignores entries that record something other than a state move', () => {
    const withScope = [...entries, { id: 'F01', from: null, to: null, scopeAdded: 'src/x' }]
    expect(replayLedger(withScope)).toEqual({ F01: 'active' })
  })

  it('reports a state that was edited by hand', () => {
    const drift = findLedgerDrift(list(feature({ state: 'passing' })), replayLedger(entries))
    expect(drift).toEqual(['F01 state is "passing" but the ledger says "active"'])
  })

  it('reports a feature added without the script', () => {
    expect(findLedgerDrift(list(feature({ id: 'F02' })), {})).toEqual([
      'F02 is not in the ledger (added by hand?)',
    ])
  })

  it('reports a scope widened by hand', () => {
    const scopes = replayScopes([{ id: 'F01', scope: ['src/routes'] }])
    const l = list(feature({ state: 'active', scope: ['src'] }))
    expect(findLedgerDrift(l, replayLedger(entries), scopes)).toEqual([
      'F01 scope is [src] but the ledger says [src/routes]',
    ])
  })

  it('skips the scope comparison when the ledger never recorded one', () => {
    const l = list(feature({ state: 'active', scope: ['src'] }))
    expect(findLedgerDrift(l, replayLedger(entries), {})).toEqual([])
  })

  it('finds no drift when they agree', () => {
    expect(findLedgerDrift(list(feature({ state: 'active' })), replayLedger(entries))).toEqual([])
  })
})

describe('findOutOfScope', () => {
  const always = ['openspec/', 'PROGRESS.md']

  it('allows files under a scope folder and always-allowed paths', () => {
    const files = ['src/routes/A.tsx', 'openspec/changes/x/tasks.md', 'PROGRESS.md']
    expect(findOutOfScope(files, ['src/routes'], always)).toEqual([])
  })

  it('does not treat a sibling folder with the same prefix as in scope', () => {
    expect(findOutOfScope(['src/routes-old/A.tsx'], ['src/routes'], always)).toEqual([
      'src/routes-old/A.tsx',
    ])
  })

  it('allows an exact file in scope', () => {
    expect(findOutOfScope(['src/store.ts'], ['src/store.ts'], always)).toEqual([])
  })

  it('lists files outside the scope', () => {
    expect(findOutOfScope(['src/stores/useUiStore.ts'], ['src/routes'], always)).toEqual([
      'src/stores/useUiStore.ts',
    ])
  })
})

describe('summariseTasks', () => {
  it('counts ticked tasks and reads the approval line', () => {
    const md = '- [x] one\n- [ ] two\n  - [X] nested\napproved: Ana, 2026-10-05\n'
    expect(summariseTasks(md)).toEqual({ done: 2, total: 3, approved: 'Ana, 2026-10-05' })
  })

  it('reports a pending approval as not approved', () => {
    expect(summariseTasks('- [ ] a\napproved: <pending>').approved).toBeNull()
  })
})

describe('renderProgressBlock / replaceAutoBlock', () => {
  const state = {
    date: '2026-10-05',
    branch: 'feat/x',
    features: list(
      feature({ state: 'passing' }),
      feature({ id: 'F02', state: 'active', title: 'Cart' }),
      feature({ id: 'F03', state: 'blocked', blockedReason: 'no API' }),
      feature({ id: 'F04', title: 'Checkout' }),
    ),
    changes: [{ name: 'add-cart', done: 1, total: 4, approved: null }],
  }

  it('summarises features, changes and the next step', () => {
    const block = renderProgressBlock(state)
    expect(block).toContain('1 passing · 1 active · 1 blocked · 1 not started')
    expect(block).toContain('F02 — Cart')
    expect(block).toContain('F03 — Items list (no API)')
    expect(block).toContain('add-cart — 1/4 tasks, approval pending')
    expect(block).toContain('finish F02')
  })

  it('suggests the next not_started feature when nothing is active', () => {
    const idle = { ...state, features: list(feature({ id: 'F04', title: 'Checkout' })) }
    expect(renderProgressBlock(idle)).toContain('start F04 — Checkout')
  })

  it('replaces only the text between the markers', () => {
    const doc = 'top\n<!-- harness:auto:start -->\nold\n<!-- harness:auto:end -->\nbottom'
    expect(replaceAutoBlock(doc, 'new')).toBe(
      'top\n<!-- harness:auto:start -->\nnew\n<!-- harness:auto:end -->\nbottom',
    )
  })

  it('fails loudly when the markers are missing', () => {
    expect(() => replaceAutoBlock('no markers', 'x')).toThrow(/harness:auto:start/)
  })
})

describe('checkInstructions', () => {
  const exists = (p) => p === 'docs/a.md'

  it('passes a short file whose links exist', () => {
    expect(checkInstructions('# T\nsee `docs/a.md`\n', { maxLines: 200, exists })).toEqual([])
  })

  it('flags a file over the line limit', () => {
    const long = Array.from({ length: 201 }, () => 'x').join('\n')
    expect(checkInstructions(long, { maxLines: 200, exists })[0]).toMatch(/201 lines.*200/)
  })

  it('flags a referenced file that does not exist', () => {
    expect(checkInstructions('read `.claude/rules/gone.md`', { maxLines: 200, exists })).toEqual([
      'links to `.claude/rules/gone.md`, which does not exist',
    ])
  })
})

describe('autoBlockMatches', () => {
  const doc = (inner) =>
    `# P\n<!-- harness:auto:start -->\n${inner}\n<!-- harness:auto:end -->\n## Current work`
  const block = '_Generated by `npm run progress` on 2026-10-06. Do not edit._\n\n- **Branch:** x'

  it('ignores the generated-on date and line wrapping', () => {
    const old =
      '_Generated by `npm run progress` on 2026-10-01. Do not edit._\n\n- **Branch:**\n  x'
    expect(autoBlockMatches(doc(old), block)).toBe(true)
  })

  it('notices a changed fact', () => {
    expect(autoBlockMatches(doc('- **Branch:** y'), block)).toBe(false)
  })

  it('is false without markers', () => {
    expect(autoBlockMatches('no markers', block)).toBe(false)
  })
})

describe('findJunk', () => {
  it('picks out leftovers and leaves real files alone', () => {
    const files = ['vite.log', 'debug-run.txt', 'src/a.tsx.orig', 'notes~', 'src/.DS_Store']
    const real = ['src/debug.ts', 'src/routes/Log.tsx', 'src/lib/catalog.ts', 'PROGRESS.md']
    expect(findJunk([...files, ...real])).toEqual(files)
  })
})

describe('formatTrace', () => {
  it('aligns entries and marks failures with their exit code', () => {
    const entries = [
      { at: '2026-10-06T12:00:01Z', source: 'stop-hook', step: 'ready', exit: 0, ms: 40 },
      {
        at: '2026-10-06T12:00:09Z',
        source: 'post-edit',
        step: 'eslint',
        exit: 1,
        ms: 812,
        detail: 'src/A.tsx',
      },
    ]
    expect(formatTrace(entries)).toEqual([
      '12:00:01  stop-hook/ready   ok      40ms',
      '12:00:09  post-edit/eslint  ✗1     812ms  src/A.tsx',
    ])
  })
})
