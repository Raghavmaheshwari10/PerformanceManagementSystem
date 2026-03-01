import { describe, it, expect } from 'vitest'
import { HELP_ARTICLES, type HelpArticle } from '@/lib/help-content'

describe('HELP_ARTICLES', () => {
  it('has at least 5 articles', () => {
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(5)
  })

  it('every article has required fields', () => {
    for (const article of HELP_ARTICLES as HelpArticle[]) {
      expect(article.slug).toBeTruthy()
      expect(article.title).toBeTruthy()
      expect(article.summary).toBeTruthy()
      expect(Array.isArray(article.roles)).toBe(true)
      expect(article.body).toBeTruthy()
    }
  })

  it('slugs are unique', () => {
    const slugs = HELP_ARTICLES.map(a => a.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('has a what-is-pms article visible to all roles', () => {
    const article = HELP_ARTICLES.find(a => a.slug === 'what-is-pms')
    expect(article).toBeDefined()
    expect(article!.roles).toContain('employee')
    expect(article!.roles).toContain('manager')
    expect(article!.roles).toContain('hrbp')
    expect(article!.roles).toContain('admin')
  })

  it('setting-kpis article is for employees only', () => {
    const article = HELP_ARTICLES.find(a => a.slug === 'setting-kpis')
    expect(article).toBeDefined()
    expect(article!.roles).toContain('employee')
  })

  it('calibration article is for hrbp and admin', () => {
    const article = HELP_ARTICLES.find(a => a.slug === 'calibration')
    expect(article).toBeDefined()
    expect(article!.roles).toContain('hrbp')
    expect(article!.roles).toContain('admin')
  })
})
