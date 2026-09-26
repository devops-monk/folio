import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { ToolDef } from '../tools/registry'
import './ToolTile.css'

export function ToolTile({ tool, tint }: { tool: ToolDef; tint: string }) {
  const Icon = tool.icon
  return (
    <Link to={`/${tool.id}`} className="tool-tile" style={{ '--tint': tint } as CSSProperties}>
      <span className="tool-icon" aria-hidden>
        <Icon size={22} strokeWidth={2} />
      </span>
      <span className="tool-text">
        <span className="tool-name">
          {tool.name}
          {!tool.ready && <span className="soon">Soon</span>}
        </span>
        <span className="tool-desc">{tool.description}</span>
      </span>
    </Link>
  )
}
