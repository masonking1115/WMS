import { useState } from 'react'

export interface ScanFeedback {
  ok: boolean
  message: string
}

export interface ScanCandidate {
  id: string
  label: string
  sublabel?: string
}

/**
 * Reusable scan widget. Operators can type/paste a barcode and press Scan, or
 * click a candidate from the list (simulating a scan-gun trigger). The parent
 * owns verification and passes back `feedback` to render the green/red banner.
 */
export default function Scanner({
  label = 'Scan barcode',
  placeholder = 'Scan or type barcode…',
  candidates,
  feedback,
  disabled,
  onScan,
}: {
  label?: string
  placeholder?: string
  candidates?: ScanCandidate[]
  feedback?: ScanFeedback | null
  disabled?: boolean
  onScan: (id: string) => void
}) {
  const [value, setValue] = useState('')

  const submit = (id: string) => {
    if (!id.trim()) return
    onScan(id.trim())
    setValue('')
  }

  return (
    <div className="scanner">
      <div className="field" style={{ marginBottom: 10 }}>
        <label>{label}</label>
        <form
          className="scan-row"
          onSubmit={(e) => {
            e.preventDefault()
            submit(value)
          }}
        >
          <input
            className="input"
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={disabled}>
            Scan
          </button>
        </form>
      </div>

      {candidates && candidates.length > 0 && (
        <div>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>
            Or tap to scan:
          </div>
          <div className="row wrap">
            {candidates.map((c) => (
              <button
                key={c.id}
                className="btn btn-sm"
                disabled={disabled}
                onClick={() => submit(c.id)}
                title={c.sublabel}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <div className={`scan-feedback ${feedback.ok ? 'ok' : 'reject'}`}>
          <span>{feedback.ok ? '✓' : '✕'}</span>
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  )
}
