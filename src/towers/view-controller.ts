/** Presentation identity is independent of a Towers attempt's durable lifetime. */
export class TowersViewSession<Screen extends string> {
  private epoch = 0
  private desired: Screen

  constructor(initial: Screen) { this.desired = initial }
  choose(screen: Screen) {
    this.desired = screen
    return { epoch: ++this.epoch, screen }
  }
  capture() { return { epoch: this.epoch, screen: this.desired } }
  current(ticket: { epoch: number; screen: Screen }) {
    return ticket.epoch === this.epoch && ticket.screen === this.desired
  }
}
