/** Unit-only presentation port. Authority fixtures do not claim visual proof;
 * exact resources, decoding and closed-root rendering run in real Chromium. */
export class ArrowsStaticSurface {
  private host: HTMLElement
  constructor(host: HTMLElement) { this.host = host }
  async prepare() { return 1 }
  prepared() { return true }
  show(stage: string) { const node = document.createElement('div'); node.dataset.arrowsStage = stage; this.host.replaceChildren(node) }
  clear() { this.host.replaceChildren() }
  dispose() { this.host.replaceChildren() }
  admit() { return true }
  composition() { return true }
}
