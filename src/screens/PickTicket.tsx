import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { batchLabel, buildPickTicket, locationLabel, verifyPickScan } from '../rules/rules'
import PageHeader from '../components/PageHeader'
import Scanner, { type ScanCandidate, type ScanFeedback } from '../components/Scanner'

export default function PickTicket() {
  const { state, dispatch } = useStore()
  const wh = state.warehouse

  const pickable = wh.orders.filter((o) => o.palletIds.length > 0 && o.status !== 'complete')
  const [orderId, setOrderId] = useState(pickable[0]?.id ?? '')
  const [stagingId, setStagingId] = useState(wh.stagingAreas[0]?.id ?? '')
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)

  const order = wh.orders.find((o) => o.id === orderId)
  const steps = useMemo(() => (order ? buildPickTicket(wh, order) : []), [wh, order])
  const remaining = steps.filter((s) => !s.picked)
  const nextStep = remaining[0]
  const done = steps.length > 0 && remaining.length === 0

  // Click-to-scan candidates: the pallets left to pick, plus a couple of decoy
  // pallets from elsewhere so the wrong-pallet rejection is demonstrable.
  const candidates: ScanCandidate[] = useMemo(() => {
    const onTicket: ScanCandidate[] = remaining.map((s) => ({
      id: s.palletId,
      label: `${s.palletId} · ${locationLabel(wh, s.locationId)}`,
      sublabel: `${s.productName} (${s.size})`,
    }))
    const decoys: ScanCandidate[] = wh.pallets
      .filter((p) => p.status === 'stored' && !steps.some((s) => s.palletId === p.id))
      .slice(0, 2)
      .map((p) => ({
        id: p.id,
        label: `${p.id} · ${locationLabel(wh, p.locationId)}`,
        sublabel: 'wrong pallet (decoy)',
      }))
    return [...onTicket, ...decoys]
  }, [wh, remaining, steps])

  const handleScan = (id: string) => {
    const res = verifyPickScan(steps, id)
    if (!res.ok) {
      setFeedback({ ok: false, message: res.reason })
      dispatch({ type: 'LOG_REJECT', item: id, detail: res.reason })
      return
    }
    dispatch({ type: 'PICK_PALLET', palletId: res.step.palletId, toLocationId: stagingId })
    setFeedback({
      ok: true,
      message: `Picked ${res.step.palletId} from ${locationLabel(wh, res.step.locationId)} → ${locationLabel(wh, stagingId)}`,
    })
  }

  if (pickable.length === 0) {
    return (
      <div>
        <PageHeader title="Pick Ticket" />
        <div className="card empty">
          No pick tickets available. Assign a dock door to an order first (Orders screen).
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Pick Ticket"
        subtitle="Route-optimized. Scan each pallet to verify before moving it to staging."
      />

      <div className="card mb">
        <div className="row wrap" style={{ gap: 20 }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Order</label>
            <select
              className="select"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value)
                setFeedback(null)
              }}
            >
              {pickable.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {o.customer}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <label>Pick to staging</label>
            <select className="select" value={stagingId} onChange={(e) => setStagingId(e.target.value)}>
              {wh.stagingAreas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, marginLeft: 'auto', alignItems: 'flex-end' }}>
            <label>Progress</label>
            <div className="progress-counter">
              {steps.length - remaining.length}/{steps.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Pick Route</h2>
          <div className="pick-list">
            {steps.map((s) => {
              const isNext = !s.picked && s.palletId === nextStep?.palletId
              return (
                <div
                  key={s.palletId}
                  className={`pick-step ${s.picked ? 'done' : ''} ${isNext ? 'next' : ''}`}
                >
                  <div>
                    <div className="pick-loc">{locationLabel(wh, s.locationId)}</div>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {s.palletId} · {batchLabel(wh, wh.pallets.find((p) => p.id === s.palletId)!.batchId)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`badge ${s.size === 'L' ? 'badge-blue' : s.size === 'M' ? 'badge-gray' : 'badge-gray'}`}>
                      Size {s.size}
                    </span>
                    {s.picked ? (
                      <span className="badge badge-green">picked</span>
                    ) : isNext ? (
                      <span className="badge badge-blue">next</span>
                    ) : (
                      <span className="badge badge-gray">waiting</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h2>Scan Verification</h2>
          {done ? (
            <div className="scan-feedback ok">
              <span>✓</span>
              <span>All {steps.length} pallets picked. Pick ticket complete.</span>
            </div>
          ) : (
            <>
              {nextStep && (
                <p className="muted">
                  Next: grab <strong>{nextStep.palletId}</strong> from{' '}
                  <strong>{locationLabel(wh, nextStep.locationId)}</strong>.
                </p>
              )}
              <Scanner
                label="Scan pallet barcode"
                candidates={candidates}
                feedback={feedback}
                onScan={handleScan}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
