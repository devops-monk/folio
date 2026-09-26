import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'folio-theme'

function readSaved(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
  return 'system'
}

function apply(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') delete root.dataset.theme
  else root.dataset.theme = mode
  try {
    if (mode === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    // Non-persistent is fine; the theme still applies for this visit.
  }
}

interface ThemeState {
  mode: ThemeMode
  cycle: () => void
}

const order: ThemeMode[] = ['system', 'light', 'dark']

export const useTheme = create<ThemeState>((set, get) => ({
  mode: readSaved(),
  cycle: () => {
    const next = order[(order.indexOf(get().mode) + 1) % order.length]
    apply(next)
    set({ mode: next })
  },
}))
