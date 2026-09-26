import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="container" style={{ textAlign: 'center', padding: '96px 16px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>Page not found</h1>
      <p style={{ color: 'var(--text-2)', margin: '12px 0 24px' }}>
        That tool doesn’t exist, or the link is out of date.
      </p>
      <Link to="/" style={{ color: 'var(--accent)', fontWeight: 600 }}>
        Browse all tools
      </Link>
    </div>
  )
}
