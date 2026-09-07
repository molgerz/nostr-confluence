import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-fg">Not found</h1>
      <Link to="/" className="text-sm text-accent-fg underline">
        back to the space list
      </Link>
    </div>
  )
}
