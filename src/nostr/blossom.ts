import { KINDS } from './kinds'
import type { Signer } from './signer'

/**
 * Datei-Anhänge über Blossom (BUD-01/02).
 *
 * Nostr speichert keine Dateien. Ein Blob wird auf einen Blossom-Server
 * geladen, ist dort über seinen sha256 adressiert und wird per URL in den
 * Markdown-Text eingebettet. Der Upload wird mit einem Kind-24242-Event
 * autorisiert — der Server prüft die Signatur, nicht ein Passwort.
 */
export type UploadResult =
  | { ok: true; url: string; sha256: string; size: number; type: string }
  | { ok: false; reason: string }

export const BLOSSOM_SERVER: string = (import.meta.env.VITE_BLOSSOM_SERVER ?? '').trim()

export function attachmentsEnabled(): boolean {
  return BLOSSOM_SERVER.length > 0
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Gehört diese URL zu unserem konfigurierten Server? */
export function isOwnAttachment(url: string): boolean {
  if (!attachmentsEnabled()) return false
  try {
    return new URL(url).origin === new URL(BLOSSOM_SERVER).origin
  } catch {
    return false
  }
}

export async function uploadAttachment(signer: Signer, file: File): Promise<UploadResult> {
  if (!attachmentsEnabled()) {
    return { ok: false, reason: 'Kein Blossom-Server konfiguriert (VITE_BLOSSOM_SERVER).' }
  }

  const data = await file.arrayBuffer()
  const hash = await sha256Hex(data)

  const auth = await signer.signEvent({
    kind: KINDS.BLOSSOM_AUTH,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'upload'],
      ['x', hash],
      ['expiration', String(Math.floor(Date.now() / 1000) + 300)],
    ],
    content: `Anhang ${file.name} hochladen`,
  })

  try {
    const response = await fetch(`${BLOSSOM_SERVER.replace(/\/$/, '')}/upload`, {
      method: 'PUT',
      headers: {
        Authorization: `Nostr ${btoa(JSON.stringify(auth))}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: data,
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      return {
        ok: false,
        reason: `Server antwortete ${response.status}${message ? `: ${message.slice(0, 200)}` : ''}`,
      }
    }

    const body: unknown = await response.json()
    const descriptor = body as Record<string, unknown>
    const url = typeof descriptor.url === 'string' ? descriptor.url : `${BLOSSOM_SERVER}/${hash}`
    return {
      ok: true,
      url,
      sha256: hash,
      size: file.size,
      type: file.type || 'application/octet-stream',
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Upload fehlgeschlagen',
    }
  }
}

/** Markdown-Einbettung für eine hochgeladene Datei. */
export function attachmentMarkdown(result: {
  url: string
  type: string
}, name: string): string {
  const isImage = result.type.startsWith('image/')
  return isImage ? `![${name}](${result.url})` : `[${name}](${result.url})`
}
