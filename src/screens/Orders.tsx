import { useState } from 'react'
import { useStore } from '../store/store'
import { locationLabel } from '../rules/rules'
import type { Order, OrderLine } from '../types'
import PageHeader from '../components/PageHeader'

export default function Orders() {
  const { state, dispatch, currentUser } = useStore()
  const wh = state.warehouse
  const canCreate = currentUser?.role === 'shipping_clerk' || currentUser?.role === 'manager'

  const [customer, setCustomer] = useState('')
  const [lines, setLines] = useState<OrderLine[]>([{ productId: wh.products[0]?.id ?? '', pallets: 1 }])
  const [error, setError] = useState('')

  // Door assignment
  const [assignOrderId, setAssignOrderId] = useState('')
  const [assignDoorId, setAssignDoorId] = useState('')

  const addLine = () => setLines([...lines, { productId: wh.products[0]?.id ?? '', pallets: 1 }])
  const updateLine = (i: number, patch: Partial<OrderLine>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))

  const nextOrderNumber = () => {
    const n = 1000 + wh.orders.length + 1
    return `ORD-${n}`
  }

  const createOrder = () => {
    setError('')
    if (!customer.trim()) return setError('Customer is required')
    if (lines.some((l) => !l.productId || l.pallets < 1)) return setError('Each line needs a product and ≥1 pallet')
    const order: Order = {
      id: `o-${Date.now()}`,
      orderNumber: nextOrderNumber(),
      customer: customer.trim(),
      dockDoorId: null,
      status: 'open',
      lines,
      palletIds: [],
      createdAt: new Date().toISOString().slice(0, 10),
    }
    dispatch({ type: 'CREATE_ORDER', order })
    setCustomer('')
    setLines([{ productId: wh.products[0]?.id ?? '', pallets: 1 }])
  }

  const assign = () => {
    setError('')
    if (!assignOrderId || !assignDoorId) return setError('Pick an order and a door')
    dispatch({ type: 'ASSIGN_DOOR', orderId: assignOrderId, doorId: assignDoorId })
    setAssignOrderId('')
    setAssignDoorId('')
  }

  const freeDoors = wh.dockDoors.filter((d) => !d.assignedOrderId)
  const openOrders = wh.orders.filter((o) => o.status !== 'complete')

  return (
    <div>
      <PageHeader title="Orders" subtitle="Create orders, assign dock doors, and generate pick tickets." />

      <div className="card mb">
        <h2>All Orders</h2>
        <table className="row-hover">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Lines</th>
              <th>Door</th>
              <th>Pick ticket</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {wh.orders.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>{o.customer}</td>
                <td>
                  {o.lines
                    .map((l) => `${l.pallets}× ${wh.products.find((p) => p.id === l.productId)?.name}`)
                    .join(', ')}
                </td>
                <td>{o.dockDoorId ? locationLabel(wh, o.dockDoorId) : '—'}</td>
                <td>{o.palletIds.length > 0 ? `${o.palletIds.length} pallets` : '—'}</td>
                <td>
                  <span className={`badge ${o.status === 'complete' ? 'badge-green' : 'badge-blue'}`}>{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="alert alert-red">{error}</div>}

      <div className="grid grid-2">
        {canCreate && (
          <div className="card">
            <h2>Create Order</h2>
            <div className="field">
              <label>Customer</label>
              <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            <label style={{ fontWeight: 500, fontSize: '0.88rem' }}>Lines</label>
            {lines.map((l, i) => (
              <div className="row mt" key={i} style={{ gap: 8 }}>
                <select
                  className="select"
                  value={l.productId}
                  onChange={(e) => updateLine(i, { productId: e.target.value })}
                >
                  {wh.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  min={1}
                  style={{ width: 90 }}
                  value={l.pallets}
                  onChange={(e) => updateLine(i, { pallets: Math.max(1, Number(e.target.value)) })}
                />
                {lines.length > 1 && (
                  <button className="btn btn-sm" onClick={() => removeLine(i)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="row mt" style={{ gap: 8 }}>
              <button className="btn btn-sm" onClick={addLine}>
                + Add line
              </button>
              <button className="btn btn-primary" onClick={createOrder}>
                Create order
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <h2>Assign Dock Door</h2>
          <p className="muted">Assigning a door generates the FIFO pick ticket for the order.</p>
          <div className="field">
            <label>Order</label>
            <select className="select" value={assignOrderId} onChange={(e) => setAssignOrderId(e.target.value)}>
              <option value="">Select order…</option>
              {openOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {o.customer}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Dock door</label>
            <select className="select" value={assignDoorId} onChange={(e) => setAssignDoorId(e.target.value)}>
              <option value="">Select door…</option>
              {freeDoors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dock Door {d.door}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={assign}>
            Assign &amp; generate pick ticket
          </button>
        </div>
      </div>
    </div>
  )
}
