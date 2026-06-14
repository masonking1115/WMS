import { useStore } from '../store/store'
import { ROLE_LABELS, screensFor, SCREEN_LABELS } from '../store/permissions'
import PageHeader from '../components/PageHeader'

export default function Users() {
  const { state } = useStore()
  const users = state.warehouse.users

  return (
    <div>
      <PageHeader title="Users" subtitle="Roles and permissions (manager view)." />
      <div className="card">
        <table className="row-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>
                  <code>{u.username}</code>
                </td>
                <td>
                  <span className="badge badge-blue">{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="muted" style={{ fontSize: '0.82rem' }}>
                  {screensFor(u.role)
                    .map((s) => SCREEN_LABELS[s])
                    .join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
