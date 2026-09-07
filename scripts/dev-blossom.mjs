#!/usr/bin/env node
/**
 * Winziger Blossom-Server für die Entwicklung (BUD-01/02).
 *
 * Nostr speichert keine Dateien — Bilder liegen auf einem Blossom- oder
 * NIP-96-Server und werden über ihre URL in den Markdown-Text eingebettet.
 * Dieser Server ist bewusst klein und NUR für die lokale Entwicklung: er
 * prüft die Upload-Autorisierung (Kind 24242) und legt Dateien unter ihrem
 * sha256 ab. Produktiv gehört ein richtiger Blossom-Server hin.
 *
 *   node scripts/dev-blossom.mjs [--port 3355]
 */
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyEvent } from 'nostr-tools'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const store = join(root, '.local', 'blossom')
const port = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 3355)

await mkdir(store, { recursive: true })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Type, Content-Length',
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS })
  res.end(JSON.stringify(body))
}

/** Autorisierung nach BUD-01: Kind 24242, t=upload, x=<hash>, gültige Signatur. */
function checkAuth(header, hash) {
  if (!header?.startsWith('Nostr ')) return 'Authorization-Header fehlt'
  let event
  try {
    event = JSON.parse(Buffer.from(header.slice(6), 'base64').toString('utf8'))
  } catch {
    return 'Authorization ist kein gültiges base64-JSON'
  }
  if (event.kind !== 24242) return 'falscher Kind, erwartet 24242'
  if (!verifyEvent(event)) return 'Signatur ungültig'
  const tag = (name) => event.tags.find((t) => t[0] === name)?.[1]
  if (tag('t') !== 'upload') return 't-Tag muss upload sein'
  if (tag('x') && tag('x') !== hash) return 'x-Tag passt nicht zum Inhalt'
  const expiration = Number(tag('expiration') ?? 0)
  if (!expiration || expiration < Math.floor(Date.now() / 1000)) return 'expiration fehlt oder ist abgelaufen'
  return null
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }

  if (req.method === 'PUT' && url.pathname === '/upload') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    if (body.length === 0) return json(res, 400, { message: 'leerer Upload' })

    const hash = createHash('sha256').update(body).digest('hex')
    const problem = checkAuth(req.headers.authorization, hash)
    if (problem) return json(res, 401, { message: problem })

    const type = req.headers['content-type'] || 'application/octet-stream'
    await writeFile(join(store, hash), body)
    await writeFile(join(store, `${hash}.type`), String(type))

    console.log(`upload ${hash.slice(0, 12)} ${body.length} B ${type}`)
    return json(res, 200, {
      url: `http://localhost:${port}/${hash}`,
      sha256: hash,
      size: body.length,
      type,
      uploaded: Math.floor(Date.now() / 1000),
    })
  }

  const match = /^\/([0-9a-f]{64})/.exec(url.pathname)
  if (match && (req.method === 'GET' || req.method === 'HEAD')) {
    const hash = match[1]
    try {
      await access(join(store, hash))
    } catch {
      return json(res, 404, { message: 'nicht gefunden' })
    }
    const body = await readFile(join(store, hash))
    let type = 'application/octet-stream'
    try {
      type = (await readFile(join(store, `${hash}.type`), 'utf8')).trim()
    } catch {
      /* Typ unbekannt */
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, ...CORS })
    res.end(req.method === 'HEAD' ? undefined : body)
    return
  }

  json(res, 404, { message: 'Blossom-Entwicklungsserver: PUT /upload oder GET /<sha256>' })
})

server.listen(port, () => {
  console.log(`Blossom-Entwicklungsserver auf http://localhost:${port}`)
  console.log(`Dateien landen in ${store}`)
  console.log('In .env.local eintragen:  VITE_BLOSSOM_SERVER=http://localhost:' + port)
})
