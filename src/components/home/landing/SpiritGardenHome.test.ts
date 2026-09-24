import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const homeSource = readFileSync('src/components/home/landing/SpiritGardenHome.tsx', 'utf8')
const pageSource = readFileSync('src/app/(site)/page.tsx', 'utf8')

describe('SpiritGarden home content boundary', () => {
  it('keeps the hero while removing the retired garden content section', () => {
    expect(homeSource).not.toContain('id="garden-content"')
    expect(homeSource).not.toContain('sg-social-proof')
    expect(homeSource).not.toContain('sg-garden-grid')
    expect(homeSource).toContain('className="sg-hero-stage sg-hero-stage--garden"')
  })

  it('does not fetch data exclusively used by the retired section', () => {
    expect(pageSource).not.toContain('fetchFeaturedProject')
    expect(pageSource).not.toContain('fetchHomeSoulMeters')
    expect(pageSource).toContain('getHeroSeason')
  })
})
