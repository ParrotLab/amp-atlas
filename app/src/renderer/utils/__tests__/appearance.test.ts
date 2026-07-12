import { describe, it, expect } from 'vitest'
import { primaryColor, softTint } from '../appearance'

describe('primaryColor', () => {
  it('extracts the first hex from a gradient string', () => {
    expect(primaryColor('linear-gradient(135deg, #8B2BFF, #A855FF)')).toBe('#8b2bff')
  })

  it('falls back to brand violet when no hex is present', () => {
    expect(primaryColor('none')).toBe('#8b2bff')
  })
})

describe('softTint', () => {
  it('mixes the color toward white at the given ratio', () => {
    // 0.14 * 139 + 0.86 * 255 = 238.76 -> 239 ; 0.14*43+0.86*255=225.32 -> 225 ; 0.14*255+0.86*255=255
    expect(softTint('#8b2bff', 0.14)).toBe('rgb(239, 225, 255)')
  })

  it('defaults to a 0.14 ratio', () => {
    expect(softTint('#8b2bff')).toBe('rgb(239, 225, 255)')
  })
})
