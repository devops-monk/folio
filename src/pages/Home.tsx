import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { categories, searchTools, type CategoryId } from '../tools/registry'
import { ToolTile } from '../components/ToolTile'
import './Home.css'

type Filter = 'all' | CategoryId

export function Home() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K or "/" focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => searchTools(query), [query])
  const sections = categories
    .filter((c) => filter === 'all' || c.id === filter)
    .map((c) => ({ category: c, tools: results.filter((t) => t.category === c.id) }))
    .filter((s) => s.tools.length > 0)

  return (
    <div className="home container">
      <section className="hero">
        <h1>
          Every PDF tool.
          <br />
          <span className="hero-accent">Private by design.</span>
        </h1>
        <p className="hero-sub">
          Sign, fill, merge, split and compress PDFs right in your browser. Your files never
          leave your device.
        </p>

        <div className="search">
          <Search className="search-icon" size={18} strokeWidth={2.2} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search tools"
            aria-label="Search tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          />
          {query ? (
            <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} strokeWidth={3} aria-hidden />
            </button>
          ) : (
            <kbd className="search-kbd" aria-hidden>
              ⌘K
            </kbd>
          )}
        </div>
      </section>

      <nav className="chips" aria-label="Filter by category">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All tools
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className="chip"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {sections.length === 0 ? (
        <p className="empty">No tools match “{query}”.</p>
      ) : (
        sections.map(({ category, tools }) => (
          <section key={category.id} className="tool-section" aria-labelledby={`cat-${category.id}`}>
            <h2 id={`cat-${category.id}`}>{category.name}</h2>
            <div className="tool-grid">
              {tools.map((t) => (
                <ToolTile key={t.id} tool={t} tint={category.tint} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
