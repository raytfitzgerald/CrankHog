import { describe, expect, it } from 'vitest'
import { OBN_APP_ID } from '@core/openbikenet/protocol'
import { LIVE_CHECK_APP_ID } from './live-check'

describe('the live checks app ID', () => {
  it("is a valid OpenBikeNet app ID (spec 5), and never CrankHog's own", () => {
    expect(LIVE_CHECK_APP_ID).toMatch(/^[a-z0-9][a-z0-9-]{1,31}$/)
    expect(LIVE_CHECK_APP_ID).not.toBe(OBN_APP_ID)
  })
})
