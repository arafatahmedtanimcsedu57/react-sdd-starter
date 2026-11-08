// @vitest-environment node
// Owners can be a git email or a GitHub @login. The roster (team.json) links the two, and
// only the person themselves fills in their email (`npm run team -- join`).
import { describe, expect, it } from 'vitest'
import {
  findLedgerAnomalies,
  findLedgerDrift,
  findOutOfScope,
  isOwner,
  loginFor,
  parseFeatureList,
  parseTeam,
  renderCodeowners,
  scopeForBranch,
  transition,
} from './lib.mjs'
import { ALWAYS_IN_SCOPE } from './io.mjs'

const team = parseTeam({
  version: 1,
  members: [{ github: 'Ana-Dev', email: 'ana@x.io' }, { github: 'bo' }],
})
const ana = { email: 'ana@x.io', github: loginFor(team, 'ana@x.io') }

describe('parseTeam / loginFor', () => {
  it('validates logins and refuses duplicates, case-insensitively', () => {
    expect(() => parseTeam({ version: 1, members: [{ github: 'not a login' }] })).toThrow(/github/)
    expect(() => parseTeam({ version: 1, members: [{ github: 'bo' }, { github: 'BO' }] })).toThrow(
      /twice: bo/i,
    )
    expect(() =>
      parseTeam({
        version: 1,
        members: [
          { github: 'a', email: 'x@y.z' },
          { github: 'b', email: 'X@y.z' },
        ],
      }),
    ).toThrow(/x@y.z/i)
  })

  it('finds the login for an email, case-insensitively, only for joined members', () => {
    expect(loginFor(team, 'ANA@x.io')).toBe('Ana-Dev')
    expect(loginFor(team, 'bo@x.io')).toBeUndefined()
  })
})

describe('isOwner', () => {
  it('matches a feature owned by the email or by the @login', () => {
    expect(isOwner('ana@x.io', ana)).toBe(true)
    expect(isOwner('@ana-dev', ana)).toBe(true)
    expect(isOwner('@bo', ana)).toBe(false)
    expect(isOwner('@ana-dev', { email: 'ana@x.io' })).toBe(false) // not joined: no login
    expect(isOwner('ANA@x.io', ana)).toBe(true)
  })
})

describe('@login owners', () => {
  const feature = (over) => ({
    id: 'F03',
    title: 'Login',
    owner: '@Ana-Dev',
    verify: 'npx vitest run a',
    scope: ['src/features/auth'],
    state: 'not_started',
    attempts: 0,
    ...over,
  })

  it('are accepted by the feature list', () => {
    const definition = (owner) => {
      const { id, title, verify, scope } = feature()
      return { id, title, owner, verify, scope }
    }
    expect(() => parseFeatureList({ version: 2, features: [definition('@Ana-Dev')] })).not.toThrow()
    expect(() => parseFeatureList({ version: 2, features: [definition('ana')] })).toThrow(/owner/)
  })

  it('can be moved by the member the roster links to', () => {
    const opts = { me: ana, limits: { activePerOwner: 2 } }
    expect(transition([feature()], 'F03', 'active', opts).to).toBe('active')
    expect(() => transition([feature({ owner: '@bo' })], 'F03', 'active', opts)).toThrow(
      /belongs to @bo; you are @Ana-Dev/,
    )
  })

  it('count toward the per-owner cap and the branch scope', () => {
    const active = [
      feature({ id: 'F04', state: 'active' }),
      feature({ id: 'F05', state: 'active' }),
    ]
    expect(() =>
      transition([...active, feature()], 'F03', 'active', {
        me: ana,
        limits: { activePerOwner: 2 },
      }),
    ).toThrow(/2 active \(F04, F05\)/)
    expect(scopeForBranch({ changeFeatures: [], features: active, me: ana }).ids).toEqual([
      'F04',
      'F05',
    ])
  })

  it('resolve each "by" with the joins recorded before that line, so a re-join is safe', () => {
    const ledger = [
      {
        id: 'F03',
        from: null,
        to: 'not_started',
        scope: ['src/a'],
        owner: '@Ana-Dev',
        by: 'lead@x.io',
      },
      { event: 'join', github: 'ana-dev', by: 'ana@old.io' },
      { id: 'F03', from: 'not_started', to: 'active', by: 'ana@old.io' },
      { event: 'join', github: 'ana-dev', by: 'ana@x.io' },
      { id: 'F03', from: 'active', to: 'blocked', reason: 'r', by: 'ana@x.io' },
      { id: 'F03', from: 'blocked', to: 'active', by: 'eve@x.io' },
    ]
    expect(findLedgerAnomalies(ledger)).toEqual([
      'ledger line 6 (F03): moved by eve@x.io, not the owner @Ana-Dev',
    ])
  })

  it('reject a move made before its author joined', () => {
    const ledger = [
      { id: 'F03', from: null, to: 'not_started', scope: ['src/a'], owner: '@bo', by: 'lead@x.io' },
      { id: 'F03', from: 'not_started', to: 'active', by: 'bo@x.io' },
      { event: 'join', github: 'bo', by: 'bo@x.io' },
    ]
    expect(findLedgerAnomalies(ledger)).toEqual([
      'ledger line 2 (F03): moved by bo@x.io, not the owner @bo',
    ])
  })
})

describe('roster drift', () => {
  const list = { version: 2, features: [] }

  it('flags a team.json email that no recorded join backs (a hand edit)', () => {
    const roster = parseTeam({ version: 1, members: [{ github: 'bo', email: 'eve@x.io' }] })
    expect(findLedgerDrift(list, [], roster)).toEqual([
      'team.json links @bo to eve@x.io, but no `npm run team -- join` recorded it',
    ])
    const joined = [{ event: 'join', github: 'BO', by: 'eve@x.io' }]
    expect(findLedgerDrift(list, joined, roster)).toEqual([])
  })
})

describe('renderCodeowners', () => {
  it('gives every owned rule every member, keeping comments, patterns and line endings', () => {
    const text = '# who\n\n*            @old\n/openspec/   @old @x # specs\n'
    expect(renderCodeowners(text, ['ana-dev', 'bo'])).toBe(
      '# who\n\n*            @ana-dev @bo\n/openspec/   @ana-dev @bo # specs\n',
    )
    expect(renderCodeowners('*  @a\r\n', ['p'])).toBe('*  @p\r\n')
  })

  it('keeps escaped spaces in patterns, and leaves deliberately unowned lines alone', () => {
    expect(renderCodeowners('docs\\ folder/ @a\n', ['p', 'q'])).toBe('docs\\ folder/ @p @q\n')
    expect(renderCodeowners('generated/ \nvendor/\n', ['p'])).toBe('generated/ \nvendor/\n')
  })
})

describe('roster files', () => {
  it('are in scope on any branch, so a /kickoff re-run passes with a feature active', () => {
    expect(findOutOfScope(['team.json', '.github/CODEOWNERS'], ['src/x'], ALWAYS_IN_SCOPE)).toEqual(
      [],
    )
  })
})
