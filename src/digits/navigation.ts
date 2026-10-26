import type { DigitsAttempt, DigitsStore } from './storage'
export type Destination = 'boot' | 'prepare' | 'run' | 'history' | 'review' | 'library'
export interface NavigationTicket {
  readonly epoch: number
  readonly destination: Destination
  readonly handle: DigitsStore | null
  readonly target?: string
  readonly channel?: string
  readonly sequence?: number
  readonly allowRetired?: boolean
}
export function digitsTarget(attempt: DigitsAttempt) {
  return JSON.stringify([attempt.arm.identity.installationId, attempt.sessionId, attempt.requestId])
}
/** The route and target authority have one synchronous owner. Retirement is absorbing
 * for a target, while explicit navigation can detach it and select another target. */
export class DigitsNavigation {
  private alive = true
  private nextEpoch = 0
  private destination: Destination = 'boot'
  private handle: DigitsStore | null = null
  private target: string | null = null
  private channels = new Map<string, number>()
  private retired = new Set<string>()
  get epoch() { return this.nextEpoch }
  get currentTarget() { return this.target }
  get currentHandle() { return this.handle }
  get currentDestination() { return this.destination }
  begin(destination: Destination, handle: DigitsStore | null, target?: string): NavigationTicket {
    this.nextEpoch++; this.destination = destination; this.handle = handle
    this.target = target ?? null; this.channels.clear()
    return this.capture()
  }
  activate(): NavigationTicket { this.alive = true; return this.begin('boot', null) }
  dispose() { this.alive = false; this.nextEpoch++; this.channels.clear() }
  capture(channel?: string, allowRetired = false): NavigationTicket {
    const sequence = channel ? (this.channels.get(channel) ?? 0) + 1 : undefined
    if (channel) this.channels.set(channel, sequence!)
    return { epoch: this.nextEpoch, destination: this.destination, handle: this.handle,
      ...(this.target ? { target: this.target } : {}),
      ...(channel ? { channel, sequence } : {}), allowRetired }
  }
  admits(ticket: NavigationTicket) {
    return this.alive && ticket.epoch === this.nextEpoch && ticket.destination === this.destination &&
      ticket.handle === this.handle && (ticket.target === undefined || ticket.target === this.target) &&
      (!ticket.target || ticket.allowRetired || !this.retired.has(ticket.target)) &&
      (!ticket.channel || this.channels.get(ticket.channel) === ticket.sequence)
  }
  adopt(ticket: NavigationTicket, handle: DigitsStore): NavigationTicket | null {
    if (!this.admits(ticket)) return null
    this.handle = handle
    return { ...ticket, handle }
  }
  select(ticket: NavigationTicket, attempt: DigitsAttempt): NavigationTicket | null {
    const key = digitsTarget(attempt)
    if (!this.admits(ticket) || this.retired.has(key) ||
      ticket.handle?.installationId !== attempt.arm.identity.installationId ||
      ticket.target && ticket.target !== key) return null
    this.target = key
    return { ...ticket, target: key }
  }
  isRetired(key: string) { return this.retired.has(key) }
  retire(key: string): NavigationTicket | null {
    this.retired.add(key)
    if (!this.alive || this.target !== key) return null
    const handle = this.handle
    this.begin('review', handle, key)
    return this.capture(undefined, true)
  }
  retireInstallation(installationId: string) {
    if (this.target && JSON.parse(this.target)[0] === installationId) return this.retire(this.target)
    return null
  }
}
