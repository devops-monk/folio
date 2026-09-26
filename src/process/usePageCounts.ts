import { useEffect, useState } from 'react'

/** Loads page counts for PDFs, for display in FileList. */
export function usePageCounts(files: File[]) {
  const [counts, setCounts] = useState<Map<File, number>>(new Map())
  useEffect(() => {
    let live = true
    ;(async () => {
      const { openPdf } = await import('../workspace/pdf')
      for (const f of files) {
        if (counts.has(f) || !/pdf$/i.test(f.type || f.name)) continue
        try {
          const task = await openPdf(new Uint8Array(await f.arrayBuffer()))
          const n = (await task.promise).numPages
          task.destroy()
          if (live) setCounts((m) => new Map(m).set(f, n))
        } catch {
          // Unreadable files show no count; the tool will report the error when run.
        }
      }
    })()
    return () => {
      live = false
    }
    // Only react to the file set changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])
  return counts
}
