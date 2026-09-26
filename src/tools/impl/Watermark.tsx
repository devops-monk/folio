import { useEffect, useMemo, useState } from 'react'
import { Field, Notice, RunBar, Segmented, Slider, Swatches, TextInput } from '../../process/controls'
import { baseName, pdfOut, type PanelProps } from '../../process/types'
import { addWatermark } from '../../engine/stamp'
import { useLoadedPdfs } from '../../process/pdfs'
import { FirstPagePreview } from '../../process/Preview'

const COLORS = ['#8e8e93', '#1d1d1f', '#d70015', '#0040dd', '#248a3d']

export default function Watermark({ files, run }: PanelProps) {
  const pdfs = useLoadedPdfs(files)
  const [kind, setKind] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [image, setImage] = useState<File | null>(null)
  const [fontSize, setFontSize] = useState(56)
  const [color, setColor] = useState(COLORS[0])
  const [opacity, setOpacity] = useState(0.25)
  const [angle, setAngle] = useState<'0' | '45' | '90'>('45')
  const [layout, setLayout] = useState<'center' | 'tile'>('center')
  const [imageScale, setImageScale] = useState(0.5)
  const imageUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => void (imageUrl && URL.revokeObjectURL(imageUrl)), [imageUrl])

  const go = () =>
    run(async (progress) => {
      progress(0.3, 'Stamping pages')
      let img: { bytes: Uint8Array; type: 'png' | 'jpg' } | undefined
      if (kind === 'image' && image) {
        img = { bytes: new Uint8Array(await image.arrayBuffer()), type: /jpe?g/i.test(image.type) ? 'jpg' : 'png' }
      }
      const out = await addWatermark(pdfs.bytes[0], {
        text,
        image: img,
        fontSize,
        color,
        opacity,
        angle: Number(angle),
        layout,
        imageScale,
      })
      return { outputs: [pdfOut(`${baseName(files[0])}-watermarked.pdf`, out)], summary: 'Watermark added to every page' }
    })

  if (pdfs.status === 'error') return <Notice>{pdfs.error}</Notice>
  const ready = kind === 'text' ? !!text.trim() : !!image

  return (
    <div className="panel">
      <div className="two-col">
        <div className="card card-stack">
          <Field label="Watermark">
            <Segmented
              label="Watermark type"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'text', label: 'Text' },
                { value: 'image', label: 'Image' },
              ]}
            />
          </Field>
          {kind === 'text' ? (
            <>
              <Field label="Text">
                <TextInput value={text} onChange={(e) => setText(e.target.value)} maxLength={60} aria-label="Watermark text" />
              </Field>
              <Field label="Size">
                <Slider label="Font size" value={fontSize} onChange={setFontSize} min={12} max={140} step={2} format={(v) => `${v} pt`} />
              </Field>
              <Field label="Color">
                <Swatches label="Color" colors={COLORS} value={color} onChange={setColor} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Image" hint="PNG or JPG">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  aria-label="Watermark image"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Field label="Size">
                <Slider label="Image size" value={imageScale} onChange={setImageScale} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} />
              </Field>
            </>
          )}
          <Field label="Opacity">
            <Slider label="Opacity" value={opacity} onChange={setOpacity} min={0.05} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} />
          </Field>
          <Field label="Angle">
            <Segmented
              label="Angle"
              value={angle}
              onChange={setAngle}
              options={[
                { value: '0', label: 'Flat' },
                { value: '45', label: 'Diagonal' },
                { value: '90', label: 'Vertical' },
              ]}
            />
          </Field>
          <Field label="Layout">
            <Segmented
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'center', label: 'Once, centered' },
                { value: 'tile', label: 'Tiled' },
              ]}
            />
          </Field>
        </div>
        <FirstPagePreview pdfs={pdfs}>
          {(k) => {
            const item =
              kind === 'text' ? (
                <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: fontSize * k, color, whiteSpace: 'nowrap' }}>
                  {text}
                </span>
              ) : imageUrl ? (
                <img src={imageUrl} alt="" style={{ width: pdfs.sizes[0][0].w * k * imageScale }} />
              ) : null
            const style = { opacity, transform: `rotate(${-Number(angle)}deg)`, display: 'grid', placeItems: 'center' } as const
            return layout === 'center' ? (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div style={style}>{item}</div>
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: '-50%', display: 'flex', flexWrap: 'wrap', gap: 30 * k, alignContent: 'center', justifyContent: 'center', transform: `rotate(${-Number(angle)}deg)` }}>
                {Array.from({ length: 30 }, (_, i) => (
                  <div key={i} style={{ opacity }}>
                    {item}
                  </div>
                ))}
              </div>
            )
          }}
        </FirstPagePreview>
      </div>
      <RunBar label="Add watermark" onClick={go} disabled={!ready || pdfs.status !== 'ready'} />
    </div>
  )
}
