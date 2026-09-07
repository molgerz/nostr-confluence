import { PhaseNote } from '../ui/Phase'

export function Login() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-fg">Mit Nostr anmelden</h1>
      <p className="text-sm text-fg-muted">
        Die Anmeldung läuft über eine NIP-07-Extension. Diese App speichert niemals einen
        privaten Schlüssel und bietet auch kein Feld dafür an.
      </p>
      <PhaseNote phase="Phase 1">
        window.nostr erkennen, getPublicKey, Profil aus Kind 0, danach NIP-42-AUTH gegen das
        Gruppen-Relay inklusive automatischem Retry nach Reconnect.
      </PhaseNote>
    </div>
  )
}
