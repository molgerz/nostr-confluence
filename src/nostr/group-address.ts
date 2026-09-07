/**
 * A NIP-29 group is identified as `<relay-host>'<group-id>` — the relay is
 * part of the identity. In URLs this form is URL-encoded.
 * docs/04-permissions-nip29.md
 */
export type GroupAddress = {
  /** e.g. localhost:8080 */
  host: string
  /** e.g. engineering */
  id: string
  /** the relay's ws:// or wss:// URL */
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
