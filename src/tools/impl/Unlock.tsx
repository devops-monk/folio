import { useEffect, useState } from 'react'
import { Field, Notice, RunBar, TextInput } from '../../process/controls'
import { baseName, pdfOut, readBytes, type PanelProps } from '../../process/types'
import { unlockPdf } from '../../engine/security'
import { isEncrypted, WrongPasswordError } from '../../engine/load'

export default function Unlock({ files, run }: PanelProps) {
  const [password, setPassword] = useState('')
  const [locked, setLocked] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    readBytes(files[0]).then(isEncrypted).then((v) => live && setLocked(v))
    return () => {
      live = false
    }
  }, [files])

  const go = () =>
    run(async (progress) => {
      progress(0.4, 'Removing password')
      try {
        const out = await unlockPdf(await readBytes(files[0]), password)
        return { outputs: [pdfOut(`${baseName(files[0])}-unlocked.pdf`, out)], summary: 'Password removed', note: 'The new file opens without a password and has no restrictions.' }
      } catch (err) {
        if (err instanceof WrongPasswordError) throw new Error('That password isn’t right. Please try again.')
        throw err
      }
    })

  if (locked === false) {
    return <Notice tone="info">This PDF isn’t password-protected, so there’s nothing to unlock.</Notice>
  }

  return (
    <div className="panel">
      <div className="card card-stack">
        <Field label="Password" hint="The password used to open this PDF">
          <TextInput
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && password && go()}
            aria-label="Password"
          />
        </Field>
        <Notice tone="info">You can only unlock files you have the password for.</Notice>
      </div>
      <RunBar label="Unlock PDF" onClick={go} disabled={!password || locked === null} />
    </div>
  )
}
