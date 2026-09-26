import type { ToolDef } from '../tools/registry'

/** A file produced by a tool. */
export interface Output {
  name: string
  bytes: Uint8Array
  type: string
}

export interface Result {
  outputs: Output[]
  /** One-line summary shown above the downloads, e.g. "Saved 62% · 4.1 MB → 1.6 MB". */
  summary?: string
  /** Softer explanation shown under the summary. */
  note?: string
}

export type ProgressFn = (fraction: number, label?: string) => void
export type Job = (progress: ProgressFn) => Promise<Result>

export interface PanelProps {
  tool: ToolDef
  files: File[]
  setFiles: (files: File[]) => void
  /** Opens the file picker to add more files (multi-file tools). */
  addFiles: () => void
  run: (job: Job) => void
}

export function baseName(file: File | string) {
  const name = typeof file === 'string' ? file : file.name
  return name.replace(/\.[^.]+$/, '')
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export const pdfOut = (name: string, bytes: Uint8Array): Output => ({ name, bytes, type: 'application/pdf' })

export async function readBytes(file: File) {
  return new Uint8Array(await file.arrayBuffer())
}
