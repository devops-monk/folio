import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import './controls.css'

/** Labeled row in an options panel. */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented seg-full" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="sig-keep">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
      {label}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, className, ...rest } = props
  return <input {...rest} className={`text-input ${className ?? ''}`} aria-invalid={invalid || undefined} />
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  label: string
  suffix?: string
}) {
  return (
    <div className="number-input">
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
      />
      {suffix && <span>{suffix}</span>}
    </div>
  )
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  label,
  format,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  label: string
  format: (v: number) => string
}) {
  return (
    <div className="slider">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
      <span className="slider-value">{format(value)}</span>
    </div>
  )
}

export function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="swatches left" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c}
          aria-label={c}
          className="swatch"
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

/** Sticky primary action at the bottom of a tool panel. */
export function RunBar({
  label,
  onClick,
  disabled,
  busy,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <div className="run-bar">
      {children && <div className="run-bar-info">{children}</div>}
      <button type="button" className="button-primary run-button" onClick={onClick} disabled={disabled || busy}>
        {busy ? <LoaderCircle className="spin" size={18} /> : label}
      </button>
    </div>
  )
}

/** Inline error / warning line. */
export function Notice({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  return (
    <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  )
}
