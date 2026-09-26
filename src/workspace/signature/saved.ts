import type { SignatureImage } from './render'

/** Signatures the user chose to keep, stored only in this browser. */
export interface SavedSignature extends SignatureImage {
  id: string
}

const KEY = 'folio-signatures'
const MAX = 6

export function loadSaved(): SavedSignature[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as SavedSignature[]) : []
    return Array.isArray(list) ? list.filter((s) => typeof s?.src === 'string') : []
  } catch {
    return []
  }
}

function write(list: SavedSignature[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or unavailable: the signature still works for this session.
  }
}

export function saveSignature(sig: SignatureImage): SavedSignature[] {
  const list = [{ ...sig, id: crypto.randomUUID() }, ...loadSaved().filter((s) => s.src !== sig.src)].slice(0, MAX)
  write(list)
  return list
}

export function deleteSaved(id: string): SavedSignature[] {
  const list = loadSaved().filter((s) => s.id !== id)
  write(list)
  return list
}
