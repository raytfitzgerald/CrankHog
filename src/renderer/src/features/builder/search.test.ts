import { describe, expect, it } from 'vitest'
import { parseBuilderSearch } from './search'

describe('builder search params', () => {
  it('keeps a workout id and drops anything else', () => {
    expect(parseBuilderSearch({ id: 'user:1b2c' })).toEqual({ id: 'user:1b2c' })
    expect(parseBuilderSearch({ id: 42 })).toEqual({ id: '42' })
    expect(parseBuilderSearch({})).toEqual({})
    expect(parseBuilderSearch({ id: '  ' })).toEqual({})
    expect(parseBuilderSearch({ id: { nested: true }, other: 'x' })).toEqual({})
  })

  it('opens the run or swim builder, with the session to edit, and nothing else', () => {
    expect(parseBuilderSearch({ sport: 'run' })).toEqual({ sport: 'run' })
    expect(parseBuilderSearch({ sport: 'swim', session: 'session-swim-1' })).toEqual({ sport: 'swim', session: 'session-swim-1' })
    // a bike workout id means nothing to the run builder, and "other" has no builder
    expect(parseBuilderSearch({ sport: 'run', id: 'user:1' })).toEqual({ sport: 'run' })
    expect(parseBuilderSearch({ sport: 'other', id: 'user:1' })).toEqual({ id: 'user:1' })
  })
})
