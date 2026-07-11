// Shared system appearance options (used by the Add-System modal and Settings).

/** First #rrggbb hex found in a gradient string, lowercased. Falls back to brand violet. */
export function primaryColor(gradient: string): string {
  const m = gradient.match(/#([0-9a-fA-F]{6})/)
  return m ? `#${m[1].toLowerCase()}` : '#8b2bff'
}

/** Mix a hex color toward white. colorRatio is how much of the color remains (0..1). */
export function softTint(hex: string, colorRatio = 0.14): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c * colorRatio + 255 * (1 - colorRatio))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

export const GRADIENTS: { value: string }[] = [
  { value: 'linear-gradient(135deg, #8B2BFF, #A855FF)' },
  { value: 'linear-gradient(135deg, #FF7B00, #FFB875)' },
  { value: 'linear-gradient(135deg, #3D0052, #7A3D8F)' },
  { value: 'linear-gradient(135deg, #16A34A, #22C55E)' },
  { value: 'linear-gradient(135deg, #2563EB, #60A5FA)' },
  { value: 'linear-gradient(135deg, #E11D48, #FB7185)' },
  { value: 'linear-gradient(135deg, #D97706, #FCD34D)' },
  { value: 'linear-gradient(135deg, #0D9488, #5EEAD4)' },
  { value: 'linear-gradient(135deg, #7C3AED, #C084FC)' },
  { value: 'linear-gradient(135deg, #0EA5E9, #7DD3FC)' },
  { value: 'linear-gradient(135deg, #1A1A2E, #4A4743)' },
  { value: 'linear-gradient(135deg, #BE185D, #F9A8D4)' },
  { value: 'linear-gradient(135deg, #059669, #A7F3D0)' },
  { value: 'linear-gradient(135deg, #DC2626, #FCA5A5)' },
]
