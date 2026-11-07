// @vitest-environment node
// Owners can be a git email or a GitHub @login. The roster (team.json) links the two, and
// only the person themselves fills in their email (`npm run team -- join`).
import { describe, expect, it } from 'vitest'
import {
  findLedgerAnomalies,
  isOwner,
  loginFor,
  parseFeatureList,
  parseTeam,
  renderCodeowners,
  scopeForBranch,
  transition,
} from './lib.mjs'

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
    const list = { version: 2, features: [{ ...feature(), state: undefined, attempts: undefined }] }
    expect(() => parseFeatureList(JSON.parse(JSON.stringify(list)))).not.toThrow()
    const bad = {
      version: 2,
      features: [{ ...JSON.parse(JSON.stringify(list.features[0])), owner: 'ana' }],
    }
    expect(() => parseFeatureList(bad)).toThrow(/owner/)
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

  it('accept ledger moves whose "by" email the roster links to the owner', () => {
    const ledger = [
      {
        id: 'F03',
        from: null,
        to: 'not_started',
        scope: ['src/a'],
        owner: '@Ana-Dev',
        by: 'lead@x.io',
      },
      { id: 'F03', from: 'not_started', to: 'active', by: 'ana@x.io' },
      { id: 'F03', from: 'active', to: 'blocked', reason: 'r', by: 'eve@x.io' },
    ]
    expect(findLedgerAnomalies(ledger, team)).toEqual([
      'ledger line 3 (F03): moved by eve@x.io, not the owner @Ana-Dev',
    ])
  })
})

describe('renderCodeowners', () => {
  it('gives every rule line every member, keeping comments and patterns', () => {
    const text = '# who\n\n*            @old\n/openspec/   @old @x # specs\n'
    expect(renderCodeowners(text, ['ana-dev', 'bo'])).toBe(
      '# who\n\n*            @ana-dev @bo\n/openspec/   @ana-dev @bo\n',
    )
  })
})
