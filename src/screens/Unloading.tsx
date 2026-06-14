import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { INBOUND_DOOR_ID } from '../data/seed'
import { batchLabel, findBayForBatch, locationLabel, occupancy, verifyUnloadScan } from '../rules/rules'
import PageHeader from '../components/PageHeader'
import Scanner, { type ScanCandidate, type ScanFeedback } from '../components/Scanner'

export default function Unloading() {
  const { state, dispatch } = useStore()
  const wh = state.warehouse

  // The inbound truck = pallets parked at the receiving door.
  const inbound = useMemo(
    () => wh.pallets.filter((p) => p.locationId === INBOUND_DOOR_ID && p.status === 'stored'),
    [wh],
  )
  const inboundBatchId = inbound[0]?.batchId ?? null
  const suggested = inboundBatchId ? findBayForBatch(wh, inboundBatchId) : null

  const [bayId, setBayId] = useState(suggested?.id ?? wh.bays[0]?.id ?? '')
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)

  const occ = occupancy(wh, bayId)

  const candidates: ScanCandidate[] = useMemo(() => {
    const truck: ScanCandidate[] = inbound.slice(0, 8).map((p) => ({
      id: p.id,
      label: `${p.id}`,
      sublabel: batchLabel(wh, p.batchId),
    }))
    // Decoy: a pallet from a different batch to demonstrate the mixing rejection.
    const decoy = wh.pallets.find((p) => p.batchId !== inboundBatchId && p.status === 'stored')
    const decoyCand: ScanCandidate[] = decoy
      ? [{ id: decoy.id, label: `${decoy.id}`, sublabel: `${batchLabel(wh, decoy.batchId)} (wrong batch)` }]
      : []
    return [...truck, ...decoyCand]
  }, [wh, inbound, inboundBatchId])

  const handleScan = (id: string) => {
    const res = verifyUnloadScan(wh, bayId, id)
    if (!res.ok || !res.pallet) {
      setFeedback({ ok: false, message: res.reason ?? 'Rejected' })
      dispatch({ type: 'LOG_REJECT', item: id, detail: res.reason ?? 'rejected at unload' })
      return
    }
    dispatch({ type: 'UNLOAD_PALLET', palletId: res.pallet.id, bayId })
    setFeedback({ ok: true, message: `Unloaded ${res.pallet.id} into ${locationLabel(wh, bayId)}` })
  }

  if (inbound.length === 0) {
    return (
      <div>
        <PageHeader title="Unloading" />
        <div className="card empty">No inbound truck waiting. (Reset demo data to restore the inbound truck.)</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Unloading"
        subtitle="Scan the bay, then scan each pallet off the truck. Different batches can't be mixed."
      />

      <div className="card mb">
        <div className="row wrap between">
          <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
            <label>Unload into bay</label>
            <select
              className="select"
              value={bayId}
              onChange={(e) => {
                setBayId(e.target.value)
                setFeedback(null)
              }}
            >
              {wh.bays.map((b) => {
                const o = occupancy(wh, b.id)
                const tag = b.batchId ? `Batch ${wh.batches.find((x) => x.id === b.batchId)?.batchNumber}` : 'empty'
                return (
                  <option key={b.id} value={b.id}>
                    {b.aisle}
                    {b.bay} — {tag} ({o.count}/{o.capacity})
                  </option>
                )
              })}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
            <label>Bay fill</label>
            <div className="progress-counter">
              {occ.count}/{occ.capacity}
            </div>
          </div>
        </div>
        <div className="muted mt">
          Inbound truck: <strong>{inbound.length}</strong> pallets of{' '}
          <strong>{inboundBatchId ? batchLabel(wh, inboundBatchId) : '—'}</strong>.
          {suggested && (
            <>
              {' '}
              Suggested bay: <strong>{suggested.aisle}{suggested.bay}</strong>{' '}
              <button
                className="btn btn-sm"
                style={{ marginLeft: 6 }}
                onClick={() => setBayId(suggested.id)}
              >
                Use
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Inbound Truck</h2>
          <table>
            <thead>
              <tr>
                <th>Pallet</th>
                <th>Batch</th>
                <th>Cases</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {inbound.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{wh.batches.find((b) => b.id === p.batchId)?.batchNumber}</td>
                  <td>{p.caseCount}</td>
                  <td>{p.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Scan to Unload</h2>
          {occ.full ? (
            <div className="alert alert-amber">
              {locationLabel(wh, bayId)} is full — assign a new bay to continue.
            </div>
          ) : null}
          <Scanner label="Scan pallet barcode" candidates={candidates} feedback={feedback} onScan={handleScan} disabled={occ.full} />
        </div>
      </div>
    </div>
  )
}
