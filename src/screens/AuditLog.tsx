import { useStore } from '../store/store'
import PageHeader from '../components/PageHeader'

const ACTION_BADGE: Record<string, string> = {
  Picked: 'badge-blue',
  Loaded: 'badge-green',
  Unloaded: 'badge-green',
  Moved: 'badge-gray',
  'Combined bays': 'badge-gray',
  'Rejected scan': 'badge-red',
  'Created order': 'badge-blue',
  'Assigned door': 'badge-blue',
  'Completed order': 'badge-green',
}

export default function AuditLog() {
  const { state } = useStore()
  const log = state.warehouse.auditLog

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every move and scan, newest first." />
      <div className="card">
        {log.length === 0 ? (
          <div className="empty">No activity yet</div>
        ) : (
          <table className="row-hover">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Item</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.timestamp).toLocaleString()}</td>
                  <td>{e.user}</td>
                  <td>
                    <span className={`badge ${ACTION_BADGE[e.action] ?? 'badge-gray'}`}>{e.action}</span>
                  </td>
                  <td>{e.item}</td>
                  <td className="muted">{e.from ?? '—'}</td>
                  <td className="muted">{e.to ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
