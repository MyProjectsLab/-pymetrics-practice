/** UI navigation only. Never stores answers, proofs, attempts or game state. */
export class PreparationTrail<T extends string = string> {
  private current: T | null = null
  private previous: T[] = []
  private readonly screens: readonly T[]
  constructor(screens: readonly T[]) { this.screens = screens }

  enter(screen: string) {
    // Preparation can briefly show a storage/readiness operation in progress.
    if (screen === 'pending' || screen === 'loading') return
    if (!this.screens.includes(screen as T)) { this.clear(); return }
    if (this.current === screen) return
    if (this.current !== null) this.previous.push(this.current)
    this.current = screen as T
  }
  get canBack() { return this.previous.length > 0 }
  back(): T | null {
    const previous = this.previous.pop() ?? null
    if (previous !== null) this.current = previous
    return previous
  }
  clear() { this.current = null; this.previous = [] }
}
