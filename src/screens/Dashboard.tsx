import { useStore } from '../store/store'
import { DEMO_TODAY } from '../data/seed'
import {
  batchLabel,
  daysUntil,
  isExpired,
  locationLabel,
  occupancy,
  productById,
} from '../rules/rules'
import PageHeader from '../components/PageHeader'

export default function Dashboard() {
  const { state } = useStore()
  const wh = state.warehouse

  const activeOrders = wh.orders.filter((o) => o.status !== 'complete')
  const palletCount = wh.pallets.length
  const baysInUse = wh.bays.filter((b) => b.batchId !== null).length
  const stagingFree = wh.stagingAreas.filter((s) => occupancy(wh, s.id).count === 0).length

  // Capacity alerts: bays at 80%+ of capacity.
  const capacityAlerts = wh.bays
    .map((b) => ({ bay: b, occ: occupancy(wh, b.id) }))
    .filter(({ occ }) => occ.capacity > 0 && occ.count / occ.capacity >= 0.8)

  // Expired + expiring-soon (within 30 days) batches that still have pallets.
  const batchPallets = (batchId: string) => wh.pallets.filter((p) => p.batchId === batchId).length
  const expired = wh.batches.filter((b) => isExpired(b, DEMO_TODAY) && batchPallets(b.id) > 0)
  const expiringSoon = wh.batches.filter((b) => {
    if (isExpired(b, DEMO_TODAY) || batchPallets(b.id) === 0) return false
    const d = daysUntil(b.expirationDate, DEMO_TODAY)
    return d >= 0 && d <= 30
  })

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Today: ${DEMO_TODAY}`} />

      <div className="grid grid-4 mb">
        <div className="card stat">
          <span className="stat-value">{activeOrders.length}</span>
          <span className="stat-label">Active orders</span>
        </div>
        <div className="card stat">
          <span className="stat-value">{palletCount}</span>
          <span className="stat-label">Pallets in stock</span>
        </div>
        <div className="card stat">
          <span className="stat-value">
            {baysInUse}/{wh.bays.length}
          </span>
          <span className="stat-label">Bays in use</span>
        </div>
        <div className="card stat">
          <span className="stat-value">
            {stagingFree}/{wh.stagingAreas.length}
          </span>
          <span className="stat-label">Staging areas free</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Active Orders</h2>
          {activeOrders.length === 0 ? (
            <div className="empty">No active orders</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Door</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.orderNumber}</td>
                    <td>{o.customer}</td>
                    <td>{o.dockDoorId ? locationLabel(wh, o.dockDoorId) : '—'}</td>
                    <td>
                      <span className="badge badge-blue">{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Alerts &amp; Warnings</h2>

          {expired.length === 0 && expiringSoon.length === 0 && capacityAlerts.length === 0 && (
            <div className="empty">All clear — no alerts</div>
          )}

          {expired.map((b) => (
            <div className="alert alert-red" key={b.id}>
              <strong>Expired:</strong> {batchLabel(wh, b.id)} ({productById(wh, b.productId)?.name}){' '}
              — expired {Math.abs(daysUntil(b.expirationDate, DEMO_TODAY))} days ago. Do not ship.
            </div>
          ))}

          {expiringSoon.map((b) => (
            <div className="alert alert-amber" key={b.id}>
              <strong>Expiring soon:</strong> {batchLabel(wh, b.id)} — {daysUntil(b.expirationDate, DEMO_TODAY)}{' '}
              days left. Pick first (FIFO).
            </div>
          ))}

          {capacityAlerts.map(({ bay, occ }) => (
            <div className="alert alert-amber" key={bay.id}>
              <strong>{locationLabel(wh, bay.id)}</strong> nearly full — {occ.count}/{occ.capacity}.
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
