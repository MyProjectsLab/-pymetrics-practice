import { createRoot } from 'react-dom/client'
import { MouthV12Journey } from './Journey'
import { ExclusiveMouthDocument } from './exclusive-document'
import baseCss from '../index.css?inline'
import appCss from '../App.css?inline'
import mouthCss from './mouth.css?inline'

try {
  const exclusive = new ExclusiveMouthDocument(`${baseCss.replace(':root', ':host')}\n${appCss}\n${mouthCss}`)
  createRoot(exclusive.uiMount).render(<MouthV12Journey exclusive={exclusive}
    onLibrary={() => window.location.assign(new URL('./', document.baseURI).href)} />)
} catch {
  const body = document.createElement('body')
  const message = document.createElement('p')
  message.textContent = 'Lengths could not prepare its display. Reload this page to retry.'
  const link = document.createElement('a'); link.href = './'; link.textContent = 'Back to library'
  if (window.top !== window) link.target = '_top'
  body.append(message, link)
  if (document.body) document.body.replaceWith(body)
  else document.documentElement.append(body)
}
