import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-fg">Nicht gefunden</h1>
      <Link to="/" className="text-sm text-accent-fg underline">
        zurück zur Space-Auswahl
      </Link>
    </div>
  )
}
