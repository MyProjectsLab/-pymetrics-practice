// Local-only QA evidence receiver; no product or analytics endpoint.
import { createServer } from 'node:http'
import { writeFile } from 'node:fs/promises'
let index = 0
createServer(async (request, response) => {
  if (request.headers.origin !== 'http://127.0.0.1:5589') { response.writeHead(403).end(); return }
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5589')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return }
  if (request.method !== 'POST' || request.url !== '/evidence') { response.writeHead(404).end(); return }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 5_000_000) { response.writeHead(413).end(); return }
    chunks.push(chunk)
  }
  const path = `/private/tmp/stop-v12-browser-${++index}.json`
  await writeFile(path, Buffer.concat(chunks))
  console.log(path)
  response.writeHead(200).end('Saved locally')
}).listen(5590, '127.0.0.1')
