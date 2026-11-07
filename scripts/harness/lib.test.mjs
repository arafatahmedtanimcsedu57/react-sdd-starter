// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addFeature,
  changesTouched,
  checkInstructions,
  checkProgressDoc,
  findLedgerAnomalies,
  findLedgerDrift,
  findJunk,
  findOutOfScope,
  formatTrace,
  ownSection,
  parseTraceLines,
  progressProblem,
  parseFeatureList,
  proposalFeature,
  renderProgress,
  replayFeatures,
  resolveChangeFeatures,
  scopeForBranch,
  summariseTasks,
  transition,
} from './lib.mjs'

const ME = 'me@example.com'
const X = 'x@example.com'
const feature = (over = {}) => ({
  id: 'F01',
  title: 'Items list',
  owner: ME,
  verify: 'npx vitest run src/routes/ItemsPage.test.tsx',
  scope: ['src/routes'],
  ...over,
})
const list = (...features) => ({ version: 2, limits: { activePerOwner: 2 }, features })
const added = (id, owner = ME, scope = ['src/routes']) => [
  { id, from: null, to: 'not_started', scope, owner },
]
const view = (features, ledger) => replayFeatures(list(...features), ledger)

describe('parseFeatureList', () => {
  it('accepts a valid list and defaults the per-owner limit', () => {
    const parsed = parseFeatureList({ version: 2, features: [feature()] })
    expect(parsed.features).toHaveLength(1)
    expect(parsed.limits).toEqual({ activePerOwner: 2 })
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

  it('needs an owner email', () => {
    expect(() => parseFeatureList(list(feature({ owner: 'arafat' })))).toThrow(/owner/)
  })

  it('refuses a v1 list that still stores state', () => {
    expect(() => parseFeatureList({ version: 1, features: [] })).toThrow(/version/)
  })
})

describe('addFeature', () => {
  it('appends a definition without mutating the input', () => {
    const before = list()
    const after = addFeature(before, feature())
    expect(after.features).toHaveLength(1)
    expect(before.features).toHaveLength(0)
  })

  it('refuses an id that already exists', () => {
    expect(() => addFeature(list(feature()), feature())).toThrow(/already exists/)
  })
})

describe('replayFeatures', () => {
  it('replays state, evidence and a block reason from the ledger', () => {
    const ledger = [
      ...added('F01'),
      { id: 'F01', from: 'not_started', to: 'active' },
      { id: 'F01', from: 'active', to: 'blocked', reason: 'no API' },
    ]
    expect(view([feature()], ledger)[0]).toMatchObject({
      state: 'blocked',
      blockedReason: 'no API',
    })
  })

  it('takes evidence from the passing line, falling back to its commit', () => {
    const ledger = [
      ...added('F01'),
      { id: 'F01', from: 'not_started', to: 'active' },
      { id: 'F01', from: 'active', to: 'passing', commit: 'abc', at: 't' },
    ]
    expect(view([feature()], ledger)[0].evidence).toEqual({ commit: 'abc', at: 't' })
  })

  it('counts failed verifies only since the feature last became active', () => {
    const ledger = [
      ...added('F01'),
      { id: 'F01', from: 'not_started', to: 'active' },
      { id: 'F01', event: 'verify_failed' },
      { id: 'F01', from: 'active', to: 'blocked', reason: 'r' },
      { id: 'F01', from: 'blocked', to: 'active' },
      { id: 'F01', event: 'verify_failed' },
    ]
    expect(view([feature()], ledger)[0].attempts).toBe(1)
  })

  it('gives the same states whichever branch is merged first (union merge)', () => {
    const base = [...added('F01'), ...added('F02', X)]
    const mine = [{ id: 'F01', from: 'not_started', to: 'active' }]
    const theirs = [
      { id: 'F02', from: 'not_started', to: 'active' },
      { id: 'F02', from: 'active', to: 'passing', commit: 'c', at: 't' },
    ]
    const defs = [feature(), feature({ id: 'F02', owner: X })]
    const states = (ledger) => view(defs, ledger).map((f) => f.state)
    expect(states([...base, ...mine, ...theirs])).toEqual(['active', 'passing'])
    expect(states([...base, ...theirs, ...mine])).toEqual(['active', 'passing'])
  })
})

describe('transition', () => {
  const opts = { me: ME, limits: { activePerOwner: 2 } }
  const at = (state, over) => ({ ...feature(over), state, attempts: 0 })

  it('returns the ledger line for starting a feature', () => {
    expect(transition([at('not_started')], 'F01', 'active', opts)).toEqual({
      id: 'F01',
      from: 'not_started',
      to: 'active',
    })
  })

  it('refuses a developer who does not own the feature', () => {
    expect(() => transition([at('not_started', { owner: X })], 'F01', 'active', opts)).toThrow(
      /belongs to x@example.com; you are me@example.com/,
    )
  })

  it('caps active features per owner, ignoring other owners', () => {
    const features = [
      at('active', { id: 'F01' }),
      at('active', { id: 'F02' }),
      at('active', { id: 'F03', owner: X }),
      at('not_started', { id: 'F04' }),
    ]
    expect(() => transition(features, 'F04', 'active', opts)).toThrow(
      /2 active \(F01, F02\); the limit is 2/,
    )
    const roomy = { ...opts, limits: { activePerOwner: 3 } }
    expect(transition(features, 'F04', 'active', roomy).to).toBe('active')
  })

  it('needs a reason to block and records it', () => {
    expect(() => transition([at('active')], 'F01', 'blocked', opts)).toThrow(/reason/)
    expect(transition([at('active')], 'F01', 'blocked', { ...opts, reason: 'API' })).toMatchObject({
      to: 'blocked',
      reason: 'API',
    })
  })

  it('only reaches passing with evidence from a verify run', () => {
    expect(() => transition([at('active')], 'F01', 'passing', opts)).toThrow(/evidence/)
    const evidence = { commit: 'abc', at: 'now' }
    expect(transition([at('active')], 'F01', 'passing', { ...opts, evidence })).toMatchObject({
      to: 'passing',
      evidence,
    })
  })

  it('cannot skip from not_started to passing, and treats passing as final', () => {
    const evidence = { commit: 'a', at: 'b' }
    expect(() => transition([at('not_started')], 'F01', 'passing', { ...opts, evidence })).toThrow(
      /not_started → passing/,
    )
    expect(() => transition([at('passing')], 'F01', 'active', opts)).toThrow(/passing → active/)
  })

  it('names an unknown feature', () => {
    expect(() => transition([], 'F09', 'active', opts)).toThrow(/F09/)
  })
})

describe('findLedgerDrift', () => {
  it('finds no drift when definitions match the ledger', () => {
    expect(findLedgerDrift(list(feature()), added('F01'))).toEqual([])
  })

  it('reports a feature added without the script', () => {
    expect(findLedgerDrift(list(feature({ id: 'F02' })), [])).toEqual([
      'F02 is not in the ledger (added by hand?)',
    ])
  })

  it('reports a scope widened by hand', () => {
    expect(findLedgerDrift(list(feature({ scope: ['src'] })), added('F01'))).toEqual([
      'F01 scope is [src] but the ledger says [src/routes]',
    ])
  })

  it('reports an owner changed by hand, and follows an owner hand-over', () => {
    expect(findLedgerDrift(list(feature({ owner: X })), added('F01'))).toEqual([
      'F01 owner is x@example.com but the ledger says me@example.com',
    ])
    const handedOver = [...added('F01'), { id: 'F01', event: 'owner', owner: X }]
    expect(findLedgerDrift(list(feature({ owner: X })), handedOver)).toEqual([])
  })

  it('reports a feature whose scope the ledger never recorded', () => {
    const noScope = [{ id: 'F01', from: null, to: 'not_started', owner: ME }]
    expect(findLedgerDrift(list(feature()), noScope)).toEqual(['F01 has no scope in the ledger'])
  })

  it('includes ledger history problems', () => {
    const forged = [...added('F01'), { id: 'F01', from: 'not_started', to: 'passing', by: ME }]
    expect(findLedgerDrift(list(feature()), forged).join('\n')).toMatch(/not allowed/)
  })

  it('reports a feature whose owner the ledger never recorded', () => {
    const legacy = [{ id: 'F01', from: null, to: 'not_started', scope: ['src/routes'] }]
    expect(findLedgerDrift(list(feature()), legacy)).toEqual(['F01 has no owner in the ledger'])
  })
})

describe('findLedgerAnomalies', () => {
  const by = (line, who = ME) => ({ ...line, by: who })
  const history = [
    by({ id: 'F01', from: null, to: 'not_started', scope: ['src/routes'], owner: ME }),
    by({ id: 'F01', from: 'not_started', to: 'active' }),
    by({ id: 'F01', event: 'verify_failed' }),
    by({ id: 'F01', from: 'active', to: 'passing', evidence: { commit: 'a', at: 't' } }),
  ]

  it('accepts a history written by the CLI', () => {
    expect(findLedgerAnomalies(history)).toEqual([])
  })

  it('accepts legacy lines without "by" before the first line that has one', () => {
    const legacy = [
      { id: 'F01', from: null, to: 'not_started', scope: ['src/routes'] },
      { id: 'F01', from: 'not_started', to: 'active' },
      { id: 'F01', from: 'active', to: 'passing', commit: 'c', at: 't' },
      by({ id: 'F01', event: 'owner', owner: ME }),
    ]
    expect(findLedgerAnomalies(legacy)).toEqual([])
  })

  it('flags a hand-appended line with no "by"', () => {
    const forged = [...history.slice(0, 2), { id: 'F01', from: 'active', to: 'passing' }]
    expect(findLedgerAnomalies(forged)).toContain(
      'ledger line 3 (F01) has no "by" — written by hand?',
    )
  })

  it('flags passing without evidence, and a move by someone other than the owner', () => {
    const lines = [...history.slice(0, 2), by({ id: 'F01', from: 'active', to: 'passing' }, X)]
    expect(findLedgerAnomalies(lines)).toEqual([
      'ledger line 3 (F01): passing without evidence from a verify run',
      'ledger line 3 (F01): moved by x@example.com, not the owner me@example.com',
    ])
  })

  it('flags a history that forked on two branches (union merge kept both moves)', () => {
    const forked = [
      ...history.slice(0, 2),
      by({ id: 'F01', from: 'active', to: 'blocked', reason: 'r' }),
      by({ id: 'F01', from: 'active', to: 'passing', evidence: { commit: 'a', at: 't' } }),
    ]
    expect(findLedgerAnomalies(forked)).toEqual([
      'ledger line 4 (F01): moves from "active" but the feature was "blocked" (forked or hand-written history)',
      'ledger line 4 (F01): blocked → passing is not allowed',
    ])
  })

  it('flags a hand-over or scope change by someone other than the owner', () => {
    const lines = [
      history[0],
      by({ id: 'F01', from: null, to: null, scope: ['src'] }, X),
      by({ id: 'F01', event: 'owner', owner: X }, X),
    ]
    expect(findLedgerAnomalies(lines)).toEqual([
      'ledger line 2 (F01): scope changed by x@example.com, not the owner me@example.com',
      'ledger line 3 (F01): owner changed by x@example.com, not the owner me@example.com',
    ])
  })
})

describe('resolveChangeFeatures', () => {
  const features = [feature({ id: 'F03' })]

  it('returns the features named by the changes, skipping "Feature: none"', () => {
    const proposals = [
      { name: 'login-form', text: 'Feature: F03' },
      { name: 'team-x', text: 'Feature: none (harness change)' },
    ]
    expect(resolveChangeFeatures(proposals, features)).toEqual({
      named: ['F03'],
      problems: [],
      notes: [],
    })
  })

  it('reports a feature id that is not in features.json', () => {
    expect(resolveChangeFeatures([{ name: 'x', text: 'Feature: F3' }], features).problems).toEqual(
      [],
    )
    expect(resolveChangeFeatures([{ name: 'x', text: 'Feature: F09' }], features).problems).toEqual(
      ['x names F09, which is not in features.json'],
    )
  })

  it('notes a change without a proposal or without a Feature line', () => {
    const proposals = [
      { name: 'a', text: null },
      { name: 'b', text: 'Risk tier: low' },
      { name: 'c', text: 'Feature: F3' },
    ]
    expect(resolveChangeFeatures(proposals, features).notes).toEqual([
      'a has no proposal.md',
      'b has no "Feature:" line',
      'c has a "Feature:" line that names no feature id (use F01 … or none)',
    ])
  })
})

describe('scopeForBranch', () => {
  const features = [
    { ...feature({ id: 'F03', scope: ['src/features/auth'] }), state: 'active' },
    { ...feature({ id: 'F04', owner: X, scope: ['src/features/dashboard'] }), state: 'active' },
    { ...feature({ id: 'F05', scope: ['src/features/profile'] }), state: 'active' },
  ]

  it('uses the feature named by the change this branch builds', () => {
    expect(scopeForBranch({ changeFeatures: ['F04'], features, me: ME })).toEqual({
      ids: ['F04'],
      scope: ['src/features/dashboard'],
    })
  })

  it('falls back to my own active features when no change names one', () => {
    expect(scopeForBranch({ changeFeatures: [], features, me: ME })).toEqual({
      ids: ['F03', 'F05'],
      scope: ['src/features/auth', 'src/features/profile'],
    })
  })

  it('is null when nothing applies', () => {
    expect(scopeForBranch({ changeFeatures: [], features, me: 'nobody@x.y' })).toBeNull()
  })
})

describe('changesTouched / proposalFeature', () => {
  it('lists open changes from changed files, ignoring the archive', () => {
    const files = [
      'openspec/changes/login-form/tasks.md',
      'openspec/changes/login-form/proposal.md',
      'openspec/changes/archive/2026-01-01-old/tasks.md',
      'src/a.ts',
    ]
    expect(changesTouched(files)).toEqual(['login-form'])
  })

  it('reads the feature id, and none for harness changes', () => {
    expect(proposalFeature('Risk tier: low\n\nFeature: F03\n')).toBe('F03')
    expect(proposalFeature('Feature: none (harness change)')).toBeNull()
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

describe('renderProgress / checkProgressDoc', () => {
  const features = [
    { ...feature(), state: 'passing' },
    { ...feature({ id: 'F02', title: 'Dashboard', owner: X }), state: 'active' },
    {
      ...feature({ id: 'F03', title: 'Profile', owner: X }),
      state: 'blocked',
      blockedReason: 'API',
    },
  ]
  const changes = [{ name: 'dashboard-layout', done: 1, total: 4, approved: null }]

  it('groups features by owner and lists open changes', () => {
    const out = renderProgress({ features, changes })
    expect(out).toContain('1 passing · 1 active · 1 blocked · 0 not started')
    expect(out).toContain('me@example.com: F01 Items list (passing)')
    expect(out).toContain('x@example.com: F02 Dashboard (active), F03 Profile (blocked: API)')
    expect(out).toContain('dashboard-layout 1/4 approval pending')
  })

  it('flags the old generated block in PROGRESS.md', () => {
    expect(checkProgressDoc('<!-- harness:auto:start -->\nx')).toHaveLength(1)
    expect(checkProgressDoc('## me@example.com\n- notes')).toEqual([])
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

describe('ownSection', () => {
  const doc =
    '# Progress\n\n## Team-wide\n- a\n\n## me@example.com\n\n### Next step\n\n- do x\n\n## x@example.com\n- y\n'

  it("returns only that developer's section, whitespace-normalised", () => {
    expect(ownSection(doc, 'me@example.com')).toBe('### Next step - do x')
    expect(ownSection(doc, 'x@example.com')).toBe('- y')
  })

  it('matches the heading whatever the case of the email', () => {
    expect(ownSection('## Me@Example.com\n- a\n', 'me@example.com')).toBe('- a')
  })

  it('is null for a developer without a section', () => {
    expect(ownSection(doc, 'new@example.com')).toBeNull()
  })
})

describe('findJunk', () => {
  it('picks out leftovers and leaves real files alone', () => {
    const files = ['vite.log', 'debug-run.txt', 'src/a.tsx.orig', 'notes~', 'src/.DS_Store']
    const real = [
      'src/debug.ts',
      'src/routes/Log.tsx',
      'src/lib/catalog.ts',
      'PROGRESS.md',
      // new, never-committed source must survive --fix
      'src/lib/debug-utils.ts',
      'e2e/debug-panel.spec.ts',
      'debug-notes.md',
      'src/components/ui/debug-overlay.tsx',
    ]
    expect(findJunk([...files, ...real])).toEqual(files)
  })
})

describe('parseTraceLines / formatTrace', () => {
  it('drops half-written lines and non-entries', () => {
    const text = '{"at":"2026-10-06T12:00:01Z","source":"s","step":"x","exit":0}\n{"at":"2026\n42\n'
    expect(parseTraceLines(text)).toHaveLength(1)
  })

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

  it('shows the branch when entries come from several (worker worktrees)', () => {
    const entries = [
      {
        at: '2026-11-08T09:00:00Z',
        branch: 'feat/f03/a',
        source: 'stop-hook',
        step: 'scope',
        exit: 0,
        ms: 5,
      },
      {
        at: '2026-11-08T09:00:01Z',
        branch: 'master',
        source: 'stop-hook',
        step: 'scope',
        exit: 1,
        ms: 6,
      },
    ]
    expect(formatTrace(entries)).toEqual([
      '09:00:00  feat/f03/a  stop-hook/scope  ok       5ms',
      '09:00:01  master      stop-hook/scope  ✗1       6ms',
    ])
  })
})

describe('progressProblem', () => {
  const base = {
    changed: ['src/a.ts'],
    now: 'next: x',
    before: 'next: y',
    onDefault: false,
    email: 'me@x.y',
  }

  it('passes when your section changed on a branch that changes files', () => {
    expect(progressProblem(base)).toBeNull()
  })

  it('fails when your section is the same as at the fork point', () => {
    expect(progressProblem({ ...base, now: 'same', before: 'same' })).toMatch(
      /not your PROGRESS.md section/,
    )
  })

  it('fails when only PROGRESS.md changed but not your section', () => {
    const onlyProgress = { ...base, changed: ['PROGRESS.md'], now: 'same', before: 'same' }
    expect(progressProblem(onlyProgress)).toMatch(/under "## me@x.y"/)
  })

  it('fails without a section, and without a git email', () => {
    expect(progressProblem({ ...base, now: null })).toMatch(/no section for you/)
    expect(progressProblem({ ...base, email: '' })).toMatch(/user.email/)
  })

  it('passes a section added on this branch, and anything when nothing changed', () => {
    expect(progressProblem({ ...base, before: null })).toBeNull()
    expect(progressProblem({ ...base, changed: [], now: null })).toBeNull()
  })

  it('on the default branch only asks that a section exists (the commit check does the rest)', () => {
    expect(progressProblem({ ...base, onDefault: true, now: 'same', before: 'same' })).toBeNull()
  })
})
