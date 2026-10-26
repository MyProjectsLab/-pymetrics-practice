// Original TraitGame mark, shared with the React Wordmark's geometry.
export function decorateSiteBrand(link: HTMLAnchorElement) {
  link.className = 'ap-wordmark'
  link.setAttribute('aria-label', 'TraitGame home')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 40 40'); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true')
  for (const [d, width] of [['M6 32V8h24M10 32h24V8', '2'], ['M14 13h12m-6 0v13', '1.8']]) {
    const path = document.createElementNS(svg.namespaceURI, 'path')
    path.setAttribute('d', d); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', width)
    if (width === '1.8') path.setAttribute('stroke-linejoin', 'round')
    svg.append(path)
  }
  const name = document.createElement('span'); name.textContent = 'TraitGame'
  link.replaceChildren(svg, name)
}
