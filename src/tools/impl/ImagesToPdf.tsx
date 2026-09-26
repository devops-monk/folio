import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { FileList } from '../../process/FileList'
import { Field, RunBar, Segmented } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { imagesToPdf, type ImageInput, type ImagesToPdfOptions } from '../../engine/images'

type Filter = 'original' | 'document' | 'bw'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * Converts any browser-decodable image to PNG/JPEG bytes, optionally with a
 * scanner-style filter: "document" boosts contrast and whitens paper,
 * "bw" thresholds to crisp black and white.
 */
async function prepare(file: File, filter: Filter): Promise<ImageInput> {
  const isJpeg = /image\/jpe?g/.test(file.type)
  const isPng = file.type === 'image/png'
  if (filter === 'original' && (isJpeg || isPng)) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), type: isJpeg ? 'jpg' : 'png' }
  }
  const img = await loadImage(file)
  const k = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * k)
  c.height = Math.round(img.naturalHeight * k)
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(img.src)

  if (filter !== 'original') {
    const data = ctx.getImageData(0, 0, c.width, c.height)
    const d = data.data
    // Paper level from the bright end of the histogram, so shadows clean up.
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++
    let acc = 0
    let paper = 255
    for (let v = 255; v >= 0; v--) {
      acc += hist[v]
      if (acc > (d.length / 4) * 0.35) {
        paper = v
        break
      }
    }
    const black = Math.max(0, paper - 150)
    for (let i = 0; i < d.length; i += 4) {
      const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
      const t = Math.min(1, Math.max(0, (l - black) / Math.max(1, paper - 20 - black)))
      const v = filter === 'bw' ? (t > 0.55 ? 255 : 0) : Math.round(255 * Math.pow(t, 1.4))
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(data, 0, 0)
  }
  const type = filter === 'bw' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, 0.88))
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: type === 'image/png' ? 'png' : 'jpg' }
}

export default function ImagesToPdf({ tool, files, setFiles, addFiles, run }: PanelProps) {
  const scan = tool.id === 'scan-to-pdf'
  const [pageSize, setPageSize] = useState<ImagesToPdfOptions['pageSize']>(scan ? 'a4' : 'fit')
  const [orientation, setOrientation] = useState<ImagesToPdfOptions['orientation']>('auto')
  const [margin, setMargin] = useState<'none' | 'small' | 'large'>(scan ? 'none' : 'small')
  const [filter, setFilter] = useState<Filter>(scan ? 'document' : 'original')
  const camera = useRef<HTMLInputElement>(null)

  const go = () =>
    run(async (progress) => {
      const images: ImageInput[] = []
      for (const [i, f] of files.entries()) {
        progress((i / files.length) * 0.8, `Preparing image ${i + 1} of ${files.length}`)
        images.push(await prepare(f, filter))
      }
      progress(0.85, 'Building PDF')
      const out = await imagesToPdf(images, {
        pageSize,
        orientation,
        margin: margin === 'none' ? 0 : margin === 'small' ? 20 : 48,
      })
      return {
        outputs: [pdfOut(`${scan ? 'scan' : baseName(files[0])}.pdf`, out)],
        summary: `${files.length} ${files.length === 1 ? 'page' : 'pages'} ready`,
      }
    })

  return (
    <div className="panel">
      <FileList files={files} onChange={setFiles} onAdd={addFiles} addLabel="Add more images" />
      {scan && (
        <>
          <button type="button" className="chip-button" style={{ alignSelf: 'center', height: 40 }} onClick={() => camera.current?.click()}>
            <Camera size={17} /> Take a photo
          </button>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFiles([...files, f])
              e.target.value = ''
            }}
          />
        </>
      )}
      <div className="card card-stack">
        <Field label="Page size">
          <Segmented
            label="Page size"
            value={pageSize}
            onChange={setPageSize}
            options={[
              { value: 'fit', label: 'Same as image' },
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'US Letter' },
            ]}
          />
        </Field>
        {pageSize !== 'fit' && (
          <>
            <Field label="Orientation">
              <Segmented
                label="Orientation"
                value={orientation}
                onChange={setOrientation}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Landscape' },
                ]}
              />
            </Field>
            <Field label="Margin">
              <Segmented
                label="Margin"
                value={margin}
                onChange={setMargin}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'small', label: 'Small' },
                  { value: 'large', label: 'Large' },
                ]}
              />
            </Field>
          </>
        )}
        <Field label={scan ? 'Enhance' : 'Color'}>
          <Segmented
            label="Image filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'original', label: 'Original' },
              { value: 'document', label: 'Document' },
              { value: 'bw', label: 'Black & white' },
            ]}
          />
        </Field>
      </div>
      <RunBar label="Create PDF" onClick={go} disabled={!files.length}>
        {files.length} {files.length === 1 ? 'image' : 'images'}
      </RunBar>
    </div>
  )
}
