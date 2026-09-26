import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { ImageUp, LoaderCircle, RotateCcw, Trash2, X } from 'lucide-react'
import '@fontsource/great-vibes/latin-400.css'
import '@fontsource/dancing-script/latin-400.css'
import '@fontsource/sacramento/latin-400.css'
import '@fontsource/homemade-apple/latin-400.css'
import '@fontsource/caveat/latin-400.css'
import { trimToPng, typedSignature, uploadedSignature, type SignatureImage } from './render'
import { deleteSaved, loadSaved, saveSignature, type SavedSignature } from './saved'
import './SignatureSheet.css'

type Mode = 'draw' | 'type' | 'upload'

const INKS = [
  { name: 'Black', value: '#1d1d1f' },
  { name: 'Blue', value: '#1f4bd1' },
  { name: 'Red', value: '#c5162b' },
]
const FONTS = ['Great Vibes', 'Dancing Script', 'Sacramento', 'Homemade Apple', 'Caveat']
// Homemade Apple runs very wide; shrink its preview so names fit the card.
const PREVIEW_SCALE: Record<string, number> = { 'Homemade Apple': 0.68 }

interface Props {
  onInsert: (sig: SignatureImage) => void
  onClose: () => void
}

export function SignatureSheet({ onInsert, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('draw')
  const [ink, setInk] = useState(INKS[0].value)
  const [saved, setSaved] = useState<SavedSignature[]>(loadSaved)
  const [keep, setKeep] = useState(true)
  const [busy, setBusy] = useState(false)
  // Each mode reports how to produce its image; null means "nothing to insert yet".
  const producer = useRef<(() => Promise<SignatureImage | null>) | null>(null)
  const [canInsert, setCanInsert] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const register = useCallback((fn: (() => Promise<SignatureImage | null>) | null) => {
    producer.current = fn
    setCanInsert(!!fn)
  }, [])

  const insert = async () => {
    if (!producer.current || busy) return
    setBusy(true)
    try {
      const sig = await producer.current()
      if (!sig) return
      if (keep) saveSignature(sig)
      onInsert(sig)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sig-title">
        <header className="sheet-header">
          <h2 id="sig-title">Add signature</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {saved.length > 0 && (
          <section className="sig-saved" aria-label="Saved signatures">
            <h3>Your signatures</h3>
            <div className="sig-saved-row">
              {saved.map((s) => (
                <div key={s.id} className="sig-saved-item">
                  <button className="sig-saved-use" onClick={() => onInsert(s)} aria-label="Use this signature">
                    <img src={s.src} alt="" />
                  </button>
                  <button
                    className="sig-saved-delete"
                    onClick={() => setSaved(deleteSaved(s.id))}
                    aria-label="Delete saved signature"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="segmented sig-modes" role="tablist" aria-label="Signature type">
          {(['draw', 'type', 'upload'] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} aria-checked={mode === m} onClick={() => setMode(m)}>
              {m === 'draw' ? 'Draw' : m === 'type' ? 'Type' : 'Upload'}
            </button>
          ))}
        </div>

        {mode !== 'upload' && (
          <div className="sig-inks" role="radiogroup" aria-label="Ink color">
            {INKS.map((c) => (
              <button
                key={c.value}
                role="radio"
                aria-checked={ink === c.value}
                aria-label={c.name}
                className="swatch"
                style={{ background: c.value }}
                onClick={() => setInk(c.value)}
              />
            ))}
          </div>
        )}

        <div className="sig-body">
          {mode === 'draw' && <DrawPane ink={ink} register={register} />}
          {mode === 'type' && <TypePane ink={ink} register={register} />}
          {mode === 'upload' && <UploadPane register={register} />}
        </div>

        <footer className="sheet-footer">
          <label className="sig-keep">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span className="switch" aria-hidden />
            Save on this device
          </label>
          <div className="sheet-actions">
            <button className="button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button-primary compact" onClick={insert} disabled={!canInsert || busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : 'Insert'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

type Register = (fn: (() => Promise<SignatureImage | null>) | null) => void

function DrawPane({ ink, register }: { ink: string; register: Register }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const initialInk = useRef(ink)
  const [empty, setEmpty] = useState(true)

  useLayoutEffect(() => {
    const canvas = canvasRef.current!
    // At least 2× so the signature stays crisp when enlarged on the page.
    const ratio = Math.max(window.devicePixelRatio || 1, 2)
    const pad = new SignaturePad(canvas, {
      penColor: initialInk.current,
      minWidth: 1,
      maxWidth: 3.2,
      velocityFilterWeight: 0.6,
    })
    padRef.current = pad

    const fit = () => {
      const data = pad.toData()
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')!.scale(ratio, ratio)
      pad.clear()
      pad.fromData(data)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)
    const onEnd = () => setEmpty(pad.isEmpty())
    pad.addEventListener('endStroke', onEnd)

    return () => {
      ro.disconnect()
      pad.removeEventListener('endStroke', onEnd)
      pad.off()
    }
    // The pad is created once; ink changes are applied by the effect below.
  }, [])

  // Changing ink recolors what's already drawn, like Preview's signature tool.
  useEffect(() => {
    const pad = padRef.current
    if (!pad) return
    pad.penColor = ink
    const data = pad.toData().map((g) => ({ ...g, penColor: ink }))
    pad.clear()
    pad.fromData(data)
  }, [ink])

  useEffect(() => {
    register(empty ? null : async () => trimToPng(canvasRef.current!))
  }, [empty, register])

  const undoStroke = () => {
    const pad = padRef.current!
    const data = pad.toData()
    data.pop()
    pad.clear()
    pad.fromData(data)
    setEmpty(pad.isEmpty())
  }

  const clear = () => {
    padRef.current!.clear()
    setEmpty(true)
  }

  return (
    <div className="sig-pad">
      <canvas ref={canvasRef} aria-label="Signature drawing area" />
      <div className="sig-baseline" aria-hidden>
        <span>×</span>
      </div>
      {empty && <p className="sig-placeholder">Sign here with your mouse, trackpad or finger</p>}
      <div className="sig-pad-tools">
        <button onClick={undoStroke} disabled={empty} aria-label="Undo last stroke" title="Undo last stroke">
          <RotateCcw size={16} />
        </button>
        <button onClick={clear} disabled={empty} aria-label="Clear" title="Clear">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

function TypePane({ ink, register }: { ink: string; register: Register }) {
  const [text, setText] = useState('')
  const [font, setFont] = useState(FONTS[0])

  useEffect(() => {
    const t = text.trim()
    register(t ? () => typedSignature(t, font, ink) : null)
  }, [text, font, ink, register])

  return (
    <div className="sig-type">
      <input
        className="sig-type-input"
        placeholder="Type your name"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        aria-label="Your name"
        maxLength={60}
      />
      <div className="sig-fonts" role="radiogroup" aria-label="Signature style">
        {FONTS.map((f) => (
          <button
            key={f}
            role="radio"
            aria-checked={font === f}
            className="sig-font"
            style={{ fontFamily: `"${f}"`, color: ink, fontSize: 28 * (PREVIEW_SCALE[f] ?? 1) }}
            onClick={() => setFont(f)}
          >
            {text.trim() || 'Your Name'}
          </button>
        ))}
      </div>
    </div>
  )
}

function UploadPane({ register }: { register: Register }) {
  const [file, setFile] = useState<File | null>(null)
  const [clean, setClean] = useState(true)
  const [preview, setPreview] = useState<SignatureImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) return
    let live = true
    uploadedSignature(file, clean).then(
      (img) => {
        if (!live) return
        setPreview(img)
        setError(img ? null : 'No signature found in that image.')
      },
      () => live && setError('That image couldn’t be read.'),
    )
    return () => {
      live = false
    }
  }, [file, clean])

  useEffect(() => {
    register(preview ? async () => preview : null)
  }, [preview, register])

  return (
    <div className="sig-upload">
      {preview ? (
        <div className="sig-upload-preview">
          <img src={preview.src} alt="Signature preview" />
        </div>
      ) : (
        <button className="sig-upload-drop" onClick={() => input.current?.click()}>
          <ImageUp size={26} />
          <span>Choose a photo or scan of your signature</span>
          <small>PNG, JPG or WebP. Sign on white paper for best results.</small>
        </button>
      )}
      {error && (
        <p className="sig-error" role="alert">
          {error}
        </p>
      )}
      <div className="sig-upload-row">
        <label className="sig-keep">
          <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} />
          <span className="switch" aria-hidden />
          Remove background
        </label>
        {preview && (
          <button className="button-secondary small" onClick={() => input.current?.click()}>
            Choose another
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setPreview(null)
            setFile(f)
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}
