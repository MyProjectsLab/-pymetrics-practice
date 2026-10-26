import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const read = (path: string) => readFileSync(path, 'utf8')
it('contains only real clean canonical marketing pages in the sitemap', () => {
  const xml = new DOMParser().parseFromString(read('public/sitemap.xml'), 'application/xml')
  expect([...xml.querySelectorAll('loc')].map(e => e.textContent)).toEqual([
    'https://traitgame.com/', 'https://traitgame.com/pymetrics-practice.html', 'https://traitgame.com/blackstone-pymetrics.html',
  ])
  for (const file of ['index.html', 'pymetrics-practice.html', 'blackstone-pymetrics.html']) {
    const doc = new DOMParser().parseFromString(read(file), 'text/html')
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://traitgame.com/' + (file === 'index.html' ? '' : file))
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBeTruthy()
  }
})
it('retains crawl access to noindex pages and defaults every nonmarketing response to noindex', () => {
  expect(read('public/robots.txt')).not.toContain('Disallow: /')
  const config = JSON.parse(read('hosting/discovery-config.json'))
  function robots(path: string) {
    let value = ''
    for (const route of config.routes) if (route.headers && new RegExp(route.src).test(path)) value = route.headers['X-Robots-Tag'] ?? value
    return value
  }
  for (const path of ['/', '/pymetrics-practice.html', '/blackstone-pymetrics.html', '/sitemap.xml', '/robots.txt']) expect(robots(path)).toBe('index, follow')
  for (const path of ['/index.html', '/practice', '/mock', '/mock/report', '/arrows.html', '/practice/stop', '/unknown', '/privacy.html']) expect(robots(path)).toBe('noindex, follow')
})
it('includes twelve correct direct destinations and narrow dated primary-source employer guidance', () => {
  const guide = new DOMParser().parseFromString(read('pymetrics-practice.html'), 'text/html')
  expect(guide.querySelectorAll('.games li a')).toHaveLength(12)
  const employer = read('blackstone-pymetrics.html')
  expect(employer).toContain('2026 US Future Leaders Program')
  expect(employer).toContain('deadline has passed')
  expect(employer).toContain('blackstone.wd1.myworkdayjobs.com')
  expect(employer).toContain('not every Blackstone job')
  expect(guide.querySelectorAll('h1')).toHaveLength(1)
})
