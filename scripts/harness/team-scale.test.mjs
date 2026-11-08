// @vitest-environment node
// The rules a big team needs (openspec team-scale): duplicate moves from parallel branches,
// over-limit warnings, leads handing over a departed member's feature, next free ids,
// the late-joiner message and CODEOWNERS completeness.
import { describe, expect, it } from 'vitest'
import {
  codeownersMissing,
  findLedgerAnomalies,
  findLedgerDrift,
  isLead,
  ledgerLeads,
  nextId,
  notOwnerMessage,
  overLimit,
  parseTeam,
  replayFeatures,
  transition,
} from './lib.mjs'

const team = parseTeam({
  version: 1,
  members: [
    { github: 'ana', email: 'ana@x.io' },
    { github: 'bo', email: 'bo@x.io' },
  ],
})
const joins = [
  { event: 'join', github: 'ana', by: 'ana@x.io' },
  { event: 'join', github: 'bo', by: 'bo@x.io' },
]
const added = (id, owner) => ({
  id,
  from: null,
  to: 'not_started',
  scope: ['src/a'],
  owner,
  by: 'ana@x.io',
})

describe('duplicate moves (S7: the same start on two branches)', () => {
  it('are accepted: they repeat the state the feature is already in', () => {
    const start = { id: 'F03', from: 'not_started', to: 'active', by: 'bo@x.io' }
    expect(findLedgerAnomalies([...joins, added('F03', '@bo'), start, start], team)).toEqual([])
  })

  it('still fail for a real fork, or a duplicate by someone else', () => {
    const ledger = [
      ...joins,
      added('F03', '@bo'),
      { id: 'F03', from: 'not_started', to: 'active', by: 'bo@x.io' },
      { id: 'F03', from: 'active', to: 'blocked', reason: 'r', by: 'bo@x.io' },
      { id: 'F03', from: 'not_started', to: 'active', by: 'bo@x.io' },
    ]
    expect(findLedgerAnomalies(ledger, team)).toEqual([
      'ledger line 6 (F03): moves from "not_started" but the feature was "blocked" (forked or hand-written history)',
    ])
    const byAna = [
      ...joins,
      added('F03', '@bo'),
      { id: 'F03', from: 'not_started', to: 'active', by: 'bo@x.io' },
      { id: 'F03', from: 'not_started', to: 'active', by: 'ana@x.io' },
    ]
    expect(findLedgerAnomalies(byAna, team)).toEqual([
      'ledger line 5 (F03): moved by ana@x.io, not the owner @bo',
    ])
  })
})

describe('duplicate moves: merge order', () => {
  it('a branch that started and blocked, merged after one that only started, is accepted', () => {
    // start (A), start (B), block (B): the repeat is skipped and the block applies. Only the
    // other order (block lands before the second start) is flagged as a fork.
    const start = { id: 'F03', from: 'not_started', to: 'active', by: 'bo@x.io' }
    const block = { id: 'F03', from: 'active', to: 'blocked', reason: 'r', by: 'bo@x.io' }
    expect(findLedgerAnomalies([...joins, added('F03', '@bo'), start, start, block])).toEqual([])
  })
})

describe('over the limit (S6: three branches, one start each)', () => {
  it('lists owners with more active than the limit, an email and its @login counted as one', () => {
    const f = (id, owner, state = 'active') => ({ id, owner, state })
    const features = [f('F03', '@bo'), f('F04', 'bo@x.io'), f('F05', '@BO'), f('F06', '@ana')]
    expect(overLimit(features, { activePerOwner: 2 }, team)).toEqual([
      { owner: '@bo', ids: ['F03', 'F04', 'F05'] },
    ])
    expect(overLimit(features.slice(1), { activePerOwner: 2 }, team)).toEqual([])
  })
})

describe('leads (S5: a member leaves owning a feature)', () => {
  const handover = (id, by, reason) => ({
    id,
    event: 'owner',
    owner: '@ana',
    by,
    ...(reason ? { reason } : {}),
  })
  const lead = (github, by, remove) => ({
    event: 'lead',
    github,
    by,
    ...(remove ? { remove } : {}),
  })

  it('start with the first member to join; a lead adds or removes leads', () => {
    expect(ledgerLeads(joins)).toEqual(['ana'])
    expect(ledgerLeads([...joins, lead('bo', 'ana@x.io')])).toEqual(['ana', 'bo'])
    expect(ledgerLeads([...joins, lead('bo', 'ana@x.io'), lead('ana', 'bo@x.io', true)])).toEqual([
      'bo',
    ])
    expect(isLead(['ana'], { email: 'ana@x.io', github: 'ANA' })).toBe(true)
    expect(isLead(['ana'], { email: 'bo@x.io', github: 'bo' })).toBe(false)
    expect(() => parseTeam({ ...team, leads: ['zed'] })).toThrow(/lead @zed is not a member/)
  })

  it('refuse lead changes by a non-lead, and removing the last lead', () => {
    expect(findLedgerAnomalies([...joins, lead('bo', 'bo@x.io')])).toEqual([
      'ledger line 3 (lead): lead changed by bo@x.io, who is not a lead',
    ])
    expect(findLedgerAnomalies([...joins, lead('ana', 'ana@x.io', true)])).toEqual([
      'ledger line 3 (lead): removes the last lead',
    ])
  })

  it("may hand over someone else's unfinished feature, with a reason", () => {
    const base = [...joins, added('F03', '@bo')]
    expect(findLedgerAnomalies([...base, handover('F03', 'ana@x.io', 'bo left')])).toEqual([])
    expect(findLedgerAnomalies([...base, handover('F03', 'ana@x.io')])).toEqual([
      'ledger line 4 (F03): owner changed by ana@x.io, not the owner @bo',
    ])
    // A reason doesn't make a non-lead a lead.
    expect(findLedgerAnomalies([...base, handover('F03', 'cy@x.io', 'x')])).toEqual([
      'ledger line 4 (F03): owner changed by cy@x.io, not the owner @bo',
    ])
    const shipped = [
      ...base,
      { id: 'F03', from: 'not_started', to: 'active', by: 'bo@x.io' },
      { id: 'F03', from: 'active', to: 'passing', evidence: { commit: 'a' }, by: 'bo@x.io' },
      handover('F03', 'ana@x.io', 'bo left'),
    ]
    expect(findLedgerAnomalies(shipped)).toEqual([
      'ledger line 6 (F03): a lead hands over a passing feature',
    ])
  })

  it('are checked as they were when each line was written', () => {
    // ana hands over as lead, then stops being one: her old hand-over stays valid …
    const later = [
      ...joins,
      added('F03', '@bo'),
      handover('F03', 'ana@x.io', 'bo left'),
      lead('bo', 'ana@x.io'),
      lead('ana', 'bo@x.io', true),
    ]
    expect(findLedgerAnomalies(later)).toEqual([])
    // … and making bo a lead later doesn't bless his earlier hand-over.
    const early = [
      ...joins,
      added('F04', '@ana'),
      { ...handover('F04', 'bo@x.io', 'x'), owner: '@bo' },
      lead('bo', 'ana@x.io'),
    ]
    expect(findLedgerAnomalies(early)).toEqual([
      'ledger line 4 (F04): owner changed by bo@x.io, not the owner @ana',
    ])
  })

  it('in team.json must match the ledger when listed', () => {
    const list = { version: 2, features: [] }
    expect(findLedgerDrift(list, joins, { ...team, leads: ['ana'] })).toEqual([])
    expect(findLedgerDrift(list, joins, team)).toEqual([])
    expect(findLedgerDrift(list, joins, { ...team, leads: ['bo'] })).toEqual([
      'team.json leads are [bo] but the ledger says [ana]: use npm run team -- lead',
    ])
  })
})

describe('next free id (S4)', () => {
  it('is one past the highest id here or on any other branch', () => {
    expect(nextId(['F01', 'F02', 'F13', 'F09'])).toBe('F14')
    expect(nextId([])).toBe('F01')
    expect(nextId(['F99'])).toBe('F100')
  })
})

describe('late joiner (S3b)', () => {
  it('is told to join on this branch, not to hand the feature over', () => {
    const features = replayFeatures(
      {
        version: 2,
        features: [
          { id: 'F20', title: 't', owner: '@kim', verify: 'npx vitest run a', scope: ['src/a'] },
        ],
      },
      [added('F20', '@kim')],
    )
    expect(() =>
      transition(features, 'F20', 'active', {
        me: { email: 'kim@x.io' },
        limits: { activePerOwner: 2 },
      }),
    ).toThrow(/isn't linked to a GitHub login on this branch.*npm run team -- join/)
    expect(notOwnerMessage('F20', '@kim', { email: 'bo@x.io', github: 'bo' })).toMatch(
      /you are @bo.*a lead can, with --reason/,
    )
  })
})

describe('CODEOWNERS completeness (S9)', () => {
  it('names owned lines that miss a member, and skips comments and unowned lines', () => {
    const text = '# x\n*  @ana @bo\n/openspec/  @ana # specs\ngenerated/\n'
    expect(codeownersMissing(text, ['ana', 'bo'])).toEqual(['/openspec/ misses @bo'])
    expect(codeownersMissing('*  @ANA @bo\n', ['ana', 'bo'])).toEqual([])
  })
})
