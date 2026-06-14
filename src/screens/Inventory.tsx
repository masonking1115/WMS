import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import {
  batchById,
  batchLabel,
  canUnloadIntoBay,
  occupancy,
  productById,
} from '../rules/rules'
import PageHeader from '../components/PageHeader'
import CapacityBar from '../components/CapacityBar'

export default function Inventory() {
  const { state, dispatch } = useStore()
  const wh = state.warehouse
  const [query, setQuery] = useState('')

  // Move-pallet form state
  const [movePallet, setMovePallet] = useState('')
  const [moveTo, setMoveTo] = useState('')
  const [moveError, setMoveError] = useState('')

  // Bay-combine form state
  const [fromBay, setFromBay] = useState('')
  const [toBay, setToBay] = useState('')
  const [combineError, setCombineError] = useState('')

  const q = query.trim().toLowerCase()
  const matchedPallets = useMemo(
    () =>
      wh.pallets.filter((p) => {
        if (!q) return true
        const batch = batchById(wh, p.batchId)
        const product = batch ? productById(wh, batch.productId) : undefined
        return (
          p.id.toLowerCase().includes(q) ||
          p.locationId.toLowerCase().includes(q) ||
          (batch?.batchNumber ?? '').toLowerCase().includes(q) ||
          (product?.name ?? '').toLowerCase().includes(q)
        )
      }),
    [wh, q],
  )

  // Low-occupancy bays that share a batch → bay-combine suggestions (free a bay).
  const combineSuggestions = useMemo(() => {
    const out: { from: string; to: string; batch: string }[] = []
    const occupied = wh.bays.filter((b) => b.batchId)
    for (const a of occupied) {
      const aOcc = occupancy(wh, a.id)
      if (aOcc.count === 0 || aOcc.count > a.capacity * 0.34) continue // only small remnants
      const target = occupied.find(
        (b) => b.id !== a.id && b.batchId === a.batchId && occupancy(wh, b.id).count + aOcc.count <= b.capacity,
      )
      if (target) out.push({ from: a.id, to: target.id, batch: batchLabel(wh, a.batchId!) })
    }
    return out
  }, [wh])

  const allLocations = [
    ...wh.bays.map((b) => ({ id: b.id, label: `Aisle ${b.aisle} Bay ${b.bay}` })),
    ...wh.stagingAreas.map((s) => ({ id: s.id, label: s.label })),
  ]

  const doMove = () => {
    setMoveError('')
    const pallet = wh.pallets.find((p) => p.id === movePallet)
    if (!pallet) return setMoveError('Select a pallet')
    if (!moveTo) return setMoveError('Select a destination')
    const targetBay = wh.bays.find((b) => b.id === moveTo)
    if (targetBay) {
      const check = canUnloadIntoBay(wh, targetBay.id, pallet.batchId)
      if (!check.ok) return setMoveError(check.reason ?? 'Cannot move there')
    }
    dispatch({ type: 'MOVE_PALLET', palletId: movePallet, toLocationId: moveTo })
    setMovePallet('')
    setMoveTo('')
  }

  const doCombine = (from: string, to: string) => {
    setCombineError('')
    if (from === to) return setCombineError('Bays must differ')
    const fromBatch = wh.bays.find((b) => b.id === from)?.batchId
    const target = wh.bays.find((b) => b.id === to)
    if (!fromBatch || !target) return setCombineError('Pick two occupied bays')
    if (target.batchId && target.batchId !== fromBatch) return setCombineError('Cannot mix batches')
    const need = occupancy(wh, from).count
    if (occupancy(wh, to).count + need > target.capacity) return setCombineError('Target bay lacks room')
    dispatch({ type: 'COMBINE_BAYS', fromBayId: from, toBayId: to })
    setFromBay('')
    setToBay('')
  }

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Search stock, view bays, and move inventory." />

      <div className="card mb">
        <input
          className="input"
          placeholder="Search by pallet, location, batch #, or product…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <table className="row-hover mt">
          <thead>
            <tr>
              <th>Pallet</th>
              <th>Product</th>
              <th>Batch</th>
              <th>Location</th>
              <th>Cases</th>
              <th>Size</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {matchedPallets.slice(0, 60).map((p) => {
              const batch = batchById(wh, p.batchId)
              const product = batch ? productById(wh, batch.productId) : undefined
              return (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{product?.name}</td>
                  <td>{batch?.batchNumber}</td>
                  <td>{p.locationId}</td>
                  <td>{p.caseCount}</td>
                  <td>{p.size}</td>
                  <td>
                    <span className="badge badge-gray">{p.status}</span>
                  </td>
                </tr>
              )
            })}
            {matchedPallets.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No matching inventory
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {matchedPallets.length > 60 && (
          <div className="muted mt">Showing first 60 of {matchedPallets.length} pallets.</div>
        )}
      </div>

      <div className="grid grid-2 mb">
        <div className="card">
          <h2>Bays</h2>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {wh.bays.map((b) => {
              const occ = occupancy(wh, b.id)
              return (
                <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <div className="row between">
                    <strong>
                      {b.aisle}
                      {b.bay}
                    </strong>
                    {b.batchId ? (
                      <span className="badge badge-blue">Batch {batchById(wh, b.batchId)?.batchNumber}</span>
                    ) : (
                      <span className="badge badge-gray">empty</span>
                    )}
                  </div>
                  <div className="mt">
                    <CapacityBar count={occ.count} capacity={occ.capacity} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h2>Staging Areas</h2>
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th>Occupancy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wh.stagingAreas.map((s) => {
                const occ = occupancy(wh, s.id)
                return (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td style={{ width: 160 }}>
                      <CapacityBar count={occ.count} capacity={occ.capacity} />
                    </td>
                    <td>
                      {occ.count === 0 ? (
                        <span className="badge badge-green">available</span>
                      ) : occ.full ? (
                        <span className="badge badge-red">full</span>
                      ) : (
                        <span className="badge badge-amber">in use</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Move Pallet</h2>
          {moveError && <div className="alert alert-red">{moveError}</div>}
          <div className="field">
            <label>Pallet</label>
            <select className="select" value={movePallet} onChange={(e) => setMovePallet(e.target.value)}>
              <option value="">Select pallet…</option>
              {wh.pallets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} ({p.locationId})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Move to</label>
            <select className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Select location…</option>
              {allLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={doMove}>
            Move
          </button>
        </div>

        <div className="card">
          <h2>Combine Bays (free up space)</h2>
          {combineError && <div className="alert alert-red">{combineError}</div>}
          {combineSuggestions.length > 0 ? (
            <div className="mb">
              <div className="muted mb">Suggestions (same batch, frees a bay):</div>
              {combineSuggestions.map((s, i) => (
                <div key={i} className="row between mb" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                  <span>
                    Move <strong>{s.from}</strong> → <strong>{s.to}</strong> · {s.batch}
                  </span>
                  <button className="btn btn-sm btn-primary" onClick={() => doCombine(s.from, s.to)}>
                    Combine
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted mb">No combine opportunities right now.</div>
          )}
          <div className="row" style={{ gap: 10 }}>
            <select className="select" value={fromBay} onChange={(e) => setFromBay(e.target.value)}>
              <option value="">From bay…</option>
              {wh.bays.filter((b) => b.batchId).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.aisle}
                  {b.bay}
                </option>
              ))}
            </select>
            <select className="select" value={toBay} onChange={(e) => setToBay(e.target.value)}>
              <option value="">To bay…</option>
              {wh.bays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.aisle}
                  {b.bay}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => doCombine(fromBay, toBay)}>
              Combine
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
