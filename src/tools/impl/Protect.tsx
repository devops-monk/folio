import { useState } from 'react'
import { Field, Notice, RunBar, Switch, TextInput } from '../../process/controls'
import { baseName, pdfOut, readBytes, type PanelProps } from '../../process/types'
import { protectPdf } from '../../engine/security'

export default function Protect({ files, run }: PanelProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [print, setPrint] = useState(true)
  const [copy, setCopy] = useState(true)
  const [edit, setEdit] = useState(false)
  const mismatch = confirm.length > 0 && confirm !== password

  const go = () =>
    run(async (progress) => {
      progress(0.4, 'Encrypting')
      const out = await protectPdf(await readBytes(files[0]), { password, allowPrinting: print, allowCopying: copy, allowEditing: edit })
      return {
        outputs: [pdfOut(`${baseName(files[0])}-protected.pdf`, out)],
        summary: 'Protected with AES-256',
        note: 'Keep the password somewhere safe. Nobody, including Folio, can recover it.',
      }
    })

  return (
    <div className="panel">
      <div className="card card-stack">
        <Field label="Password" hint={password && password.length < 6 ? 'Use at least 6 characters' : undefined}>
          <TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
        </Field>
        <Field label="Confirm password">
          <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={mismatch} aria-label="Confirm password" />
        </Field>
        {mismatch && <Notice>The passwords don’t match.</Notice>}
        <Field label="After opening, allow">
          <div className="card-stack" style={{ gap: 12 }}>
            <Switch checked={print} onChange={setPrint} label="Printing" />
            <Switch checked={copy} onChange={setCopy} label="Copying text and images" />
            <Switch checked={edit} onChange={setEdit} label="Editing, comments and form filling" />
          </div>
        </Field>
      </div>
      <RunBar label="Protect PDF" onClick={go} disabled={password.length < 6 || password !== confirm} />
    </div>
  )
}
