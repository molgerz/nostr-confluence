/**
 * Eine NIP-29-Gruppe wird als `<relay-host>'<group-id>` identifiziert — das
 * Relay ist Teil der Identität. In URLs steht diese Form url-kodiert.
 * docs/04-permissions-nip29.md
 */
export type GroupAddress = {
  /** z. B. localhost:8080 */
  host: string
  /** z. B. engineering */
  id: string
  /** ws:// bzw. wss:// URL des Relays */
  relayUrl: string
}

export function parseGroupAddress(raw: string): GroupAddress | null {
  const decoded = decodeURIComponent(raw)
  const at = decoded.indexOf("'")
  if (at <= 0 || at === decoded.length - 1) return null
  const host = decoded.slice(0, at)
  const id = decoded.slice(at + 1)
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  return { host, id, relayUrl: `${local ? 'ws' : 'wss'}://${host}` }
}

export function formatGroupAddress(address: GroupAddress): string {
  return `${address.host}'${address.id}`
}
