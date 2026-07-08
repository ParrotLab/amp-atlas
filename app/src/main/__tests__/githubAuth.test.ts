import { describe, it, expect } from 'vitest'
import { interpretPoll } from '../githubAuth'

describe('interpretPoll', () => {
  it('returns token on success', () => {
    expect(interpretPoll({ access_token: 'x' })).toEqual({ done: true, token: 'x' })
  })
  it('keeps waiting on authorization_pending', () => {
    expect(interpretPoll({ error: 'authorization_pending' })).toEqual({ done: false, slowDown: false })
  })
  it('signals slow_down', () => {
    expect(interpretPoll({ error: 'slow_down' })).toEqual({ done: false, slowDown: true })
  })
  it('fails on expired/denied', () => {
    expect(interpretPoll({ error: 'expired_token' })).toEqual({ done: true, error: 'expired_token' })
    expect(interpretPoll({ error: 'access_denied' })).toEqual({ done: true, error: 'access_denied' })
  })
})
