/** One Towers attempt owns its revocation from Start through durable settlement. */
export interface TowersRevocation {
  reason: string
  elapsedMs: number | null
  wallTimestampMs: number
}
export class TowersAttempt {
  readonly runId: string
  readonly documentId: string
  readonly generation: number
  private anchor: number | null = null
  private revocation: TowersRevocation | null = null
  private stopped = false
  private onRevoke: (value: TowersRevocation) => void

  constructor(runId: string, documentId: string, generation: number,
    onRevoke: (value: TowersRevocation) => void) {
    this.runId = runId; this.documentId = documentId; this.generation = generation
    this.onRevoke = onRevoke
    window.addEventListener('pagehide', this.pagehide)
    document.addEventListener('visibilitychange', this.hidden)
  }
  private pagehide = () => this.revoke('Page left during play')
  private hidden = () => { if (document.visibilityState !== 'visible') this.revoke('Page hidden during play') }
  get revoked() { return this.revocation }
  get active() { return !this.stopped && !this.revocation }
  setAnchor(value: number) { if (this.active && this.anchor === null) this.anchor = value }
  revoke(reason: string) {
    if (this.stopped || this.revocation) return this.revocation
    this.revocation = { reason,
      elapsedMs: this.anchor === null ? null : Math.max(0, Math.floor(performance.now() - this.anchor)),
      wallTimestampMs: Date.now() }
    this.onRevoke(this.revocation)
    return this.revocation
  }
  stop() {
    if (this.stopped) return
    this.stopped = true
    window.removeEventListener('pagehide', this.pagehide)
    document.removeEventListener('visibilitychange', this.hidden)
  }
}
