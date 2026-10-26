import type { ReactNode } from 'react'
import { Wordmark } from '../design/Wordmark'
import '../design/tokens.css'

export function Shell({ children, onLibrary }: { children: ReactNode; onLibrary: () => void }) {
  const mockContext = typeof window !== 'undefined' && window.location.pathname !== '/mock' &&
    (new URLSearchParams(window.location.search).has('mock') || new URLSearchParams(window.location.search).has('mockReport'))
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <Wordmark />
      <nav aria-label="Main navigation"><a href="/">Home</a> <a href="/practice">Assessments</a> <a href="/mock">Full mock</a></nav>
      {mockContext&&<button data-mock-return-intent onClick={onLibrary}>Return to mock</button>}
    </header>
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="site-footer">Original preparation exercises. Follow the instructions in your invitation.</footer>
  </>
}

export interface LibraryEntry {
  id: string
  name: string
  description: string
  metadata: string
  action: string
  availability: string
  illustration?: ReactNode
  href: string
}

export function GameLibrary({ entries }: {
  entries: readonly LibraryEntry[]
}) {
  return <>
    <section className="library-intro">
      <h1 tabIndex={-1}>Choose an assessment</h1>
      <p className="lead">Learn the rules, practise, then review your results. Try one task or the full set of twelve.</p>
      <p>For timed keyboard tasks, use a physical keyboard. Stop also offers untimed touch practice.</p>
      <details className="start-options"><summary>About your practice and results</summary><p>This is independent preparation, not an employer score. Follow the instructions in your actual assessment invitation.</p><p>Results stay in this browser. Clearing site data removes them; temporary results disappear when the page closes. Saved results can be deleted from each assessment’s history.</p><p>We collect completion counts and limited result totals. <a href="/privacy.html">Privacy</a>.</p></details>
    </section>
    <section aria-labelledby="library-heading">
      <h2 id="library-heading">Practice options</h2>
      <div className="game-grid">{entries.map(entry => <article className="game-card" key={entry.id}>
        {entry.id !== 'balloons' && entry.illustration}

        <h3>{entry.name}</h3>
        <p>{entry.description}</p>
        {entry.id === 'balloons' && entry.illustration}
        <p className="metadata">{entry.metadata}</p>
        <a className="game-card-action" href={entry.href}>{entry.action} <span aria-hidden="true">→</span></a>
      </article>)}</div>
    </section>
  </>
}
