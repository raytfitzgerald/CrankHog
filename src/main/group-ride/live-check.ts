// Test helper, never imported by the app: the app ID the opt-in live checks
// use for their own connections to the public OpenBikeNet server. Every
// connection's app ID and version show up in the server's public /v0/stats,
// so test runs get an ID of their own and stay out of CrankHog's numbers.
export const LIVE_CHECK_APP_ID = 'crankhog-live-check'
