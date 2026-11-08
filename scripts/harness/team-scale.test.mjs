// @vitest-environment node
// The rules a big team needs (openspec team-scale): duplicate moves from parallel branches,
// over-limit warnings, leads handing over a departed member's feature, next free ids,
// the late-joiner message and CODEOWNERS completeness.
import { describe, expect, it } from 'vitest'
import {
  codeownersMissing,
  findLedgerAnomalies,
  isLead,
  leadsOf,
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
  it('default to the first member; named leads must be members', () => {
    expect(leadsOf(team)).toEqual(['ana'])
    expect(isLead(team, { email: 'ana@x.io', github: 'ANA' })).toBe(true)
    expect(isLead(team, { email: 'bo@x.io', github: 'bo' })).toBe(false)
    expect(leadsOf({ ...team, leads: ['bo'] })).toEqual(['bo'])
    expect(() => parseTeam({ ...team, leads: ['zed'] })).toThrow(/lead @zed is not a member/)
  })

  it("may hand over someone else's feature with a reason; others may not", () => {
    const handover = (by, reason) => [
      ...joins,
      added('F03', '@bo'),
      { id: 'F03', event: 'owner', owner: '@ana', by, ...(reason ? { reason } : {}) },
    ]
    expect(findLedgerAnomalies(handover('ana@x.io', 'bo left'), team)).toEqual([])
    expect(findLedgerAnomalies(handover('ana@x.io'), team)).toEqual([
      'ledger line 4 (F03): owner changed by ana@x.io, not the owner @bo',
    ])
    // Only a named lead: with leads: ['bo'], ana's hand-over of bo's feature is refused.
    const boLead = parseTeam({ ...team, leads: ['bo'] })
    expect(findLedgerAnomalies(handover('ana@x.io', 'bo left'), boLead)).toEqual([
      'ledger line 4 (F03): owner changed by ana@x.io, not the owner @bo',
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
