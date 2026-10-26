// Run from the repository root after npm run build. Only generated dist changes.
import { copyFile, readFile, writeFile } from 'node:fs/promises'
await copyFile('docs/qa/stop-v1.2/repair/browser-probe.js', 'dist/qa-browser-probe.js')
const path = 'dist/index.html'
const html = await readFile(path, 'utf8')
if (!html.includes('/qa-browser-probe.js')) await writeFile(path, html.replace('</body>', '<script type="module" src="/qa-browser-probe.js"></script></body>'))
