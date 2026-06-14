import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { batchLabel, locationLabel, verifyLoadScan } from '../rules/rules'
import PageHeader from '../components/PageHeader'
import Scanner, { type ScanCandidate, type ScanFeedback } from '../components/Scanner'

export default function Loading() {
  const { state, dispatch } = useStore()
  const wh = state.warehouse

  // Only doors with an assigned order can be loaded.
  const loadableDoors = wh.dockDoors.filter((d) => d.assignedOrderId)
  const [doorId, setDoorId] = useState(loadableDoors[0]?.id ?? '')
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)

  const door = wh.dockDoors.find((d) => d.id === doorId)
  const order = wh.orders.find((o) => o.id === door?.assignedOrderId)

  const orderPallets = useMemo(
    () => (order ? order.palletIds.map((id) => wh.pallets.find((p) => p.id === id)!).filter(Boolean) : []),
    [wh, order],
  )
  const loaded = orderPallets.filter((p) => p.status === 'loaded')
  const total = orderPallets.length
  const done = total > 0 && loaded.length === total

  // Candidates: pallets on this order not yet loaded, plus a decoy from another order.
  const candidates: ScanCandidate[] = useMemo(() => {
    const onOrder: ScanCandidate[] = orderPallets
      .filter((p) => p.status !== 'loaded')
      .map((p) => ({
        id: p.id,
        label: `${p.id} · ${locationLabel(wh, p.locationId)}`,
        sublabel: p.status === 'stored' ? 'not yet picked' : 'staged',
      }))
    const decoy = wh.pallets.find((p) => order && !order.palletIds.includes(p.id) && p.status === 'staged')
    const decoyCand: ScanCandidate[] = decoy
      ? [{ id: decoy.id, label: `${decoy.id} · ${locationLabel(wh, decoy.locationId)}`, sublabel: 'wrong door (decoy)' }]
      : []
    return [...onOrder, ...decoyCand]
  }, [wh, orderPallets, order])

  const handleScan = (id: string) => {
    const res = verifyLoadScan(wh, doorId, id)
    if (!res.ok || !res.pallet) {
      setFeedback({ ok: false, message: res.reason ?? 'Rejected' })
      dispatch({ type: 'LOG_REJECT', item: id, detail: res.reason ?? 'rejected at load' })
      return
    }
    dispatch({ type: 'LOAD_PALLET', palletId: res.pallet.id, doorId })
    setFeedback({ ok: true, message: `Loaded ${res.pallet.id} onto Dock Door ${door?.door}` })
  }

  if (loadableDoors.length === 0) {
    return (
      <div>
        <PageHeader title="Loading" />
        <div className="card empty">No doors have an order assigned. Assign one on the Orders screen.</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Loading" subtitle="Scan the door, then scan each pallet. Wrong-door pallets are rejected." />

      <div className="card mb">
        <div className="row wrap between">
          <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
            <label>Dock door</label>
            <select
              className="select"
              value={doorId}
              onChange={(e) => {
                setDoorId(e.target.value)
                setFeedback(null)
              }}
            >
              {loadableDoors.map((d) => {
                const o = wh.orders.find((x) => x.id === d.assignedOrderId)
                return (
                  <option key={d.id} value={d.id}>
                    Dock Door {d.door} — {o?.orderNumber}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
            <label>Loaded</label>
            <div className="progress-counter">
              {loaded.length}/{total}
            </div>
          </div>
        </div>
        {order && (
          <div className="muted mt">
            Order <strong>{order.orderNumber}</strong> for {order.customer}.
          </div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Pallets on this Order</h2>
          <table>
            <thead>
              <tr>
                <th>Pallet</th>
                <th>From</th>
                <th>Batch</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orderPallets.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{locationLabel(wh, p.locationId)}</td>
                  <td>{batchLabel(wh, p.batchId)}</td>
                  <td>
                    {p.status === 'loaded' ? (
                      <span className="badge badge-green">loaded</span>
                    ) : p.status === 'staged' ? (
                      <span className="badge badge-blue">staged</span>
                    ) : (
                      <span className="badge badge-amber">not picked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Scan to Load</h2>
          {done ? (
            <div className="scan-feedback ok">
              <span>✓</span>
              <span>All {total} pallets loaded onto Dock Door {door?.door}.</span>
            </div>
          ) : (
            <Scanner label="Scan pallet barcode" candidates={candidates} feedback={feedback} onScan={handleScan} />
          )}
          {done && order && (
            <button
              className="btn btn-primary mt"
              onClick={() => dispatch({ type: 'COMPLETE_ORDER', orderId: order.id })}
            >
              Complete order
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
