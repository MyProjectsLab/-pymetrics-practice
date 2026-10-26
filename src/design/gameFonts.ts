import newsreader from '@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2?url'
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'

// Owned documents replace the page head. Register the same local fonts without
// adding stylesheet nodes to their protected document structure.
export function loadGameFonts() {
  if (typeof FontFace !== 'function') return
  for (const [family, url, weight] of [['AP Newsreader', newsreader, '200 800'], ['AP Inter', inter, '100 900']]) {
    if ([...document.fonts].some(face => face.family === family)) continue
    const face = new FontFace(family, `url(${url})`, { weight, display: 'swap' })
    document.fonts.add(face)
    void face.load().catch(() => { /* The shared system-font fallback remains readable. */ })
  }
}
