import { describe, it, expect } from 'vitest'
import { buildAuthHeader } from '../authHeader'

describe('buildAuthHeader', () => {
  it('base64-encodes x-access-token:token as a basic auth header', () => {
    const expected = 'AUTHORIZATION: basic ' + Buffer.from('x-access-token:tok123').toString('base64')
    expect(buildAuthHeader('tok123')).toBe(expected)
  })
})
