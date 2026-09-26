import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Monitor, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useTheme } from './theme'
import './AppShell.css'

const themeIcon = { system: Monitor, light: Sun, dark: Moon }
const themeLabel = { system: 'Match system', light: 'Light', dark: 'Dark' }

export function AppShell() {
  const { mode, cycle } = useTheme()
  const ThemeIcon = themeIcon[mode]
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="shell">
      <header className="navbar">
        <div className="container navbar-inner">
          <Link to="/" className="brand" aria-label="Folio home">
            <img src="./favicon.svg" alt="" width={28} height={28} />
            <span>Folio</span>
          </Link>

          <div className="navbar-trailing">
            <span className="privacy-pill" title="Every tool runs locally in your browser">
              <ShieldCheck size={15} strokeWidth={2.2} aria-hidden />
              <span>On-device</span>
            </span>
            <button
              className="icon-button"
              onClick={cycle}
              aria-label={`Theme: ${themeLabel[mode]}. Click to change.`}
              title={`Theme: ${themeLabel[mode]}`}
            >
              <ThemeIcon size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer container">
        <p>
          Folio processes your files entirely in your browser. Nothing is uploaded, stored or
          tracked.
        </p>
      </footer>
    </div>
  )
}
