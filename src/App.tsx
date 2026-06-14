import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/store'
import { canAccess, type ScreenKey } from './store/permissions'
import Layout from './components/Layout'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import PickTicket from './screens/PickTicket'
import Inventory from './screens/Inventory'
import Loading from './screens/Loading'
import Unloading from './screens/Unloading'
import Orders from './screens/Orders'
import Reports from './screens/Reports'
import AuditLog from './screens/AuditLog'
import Users from './screens/Users'
import type { JSX } from 'react'

export default function App() {
  const { currentUser } = useStore()

  if (!currentUser) return <Login />

  // Guard each route by the logged-in user's role.
  const guard = (screen: ScreenKey, element: JSX.Element) =>
    canAccess(currentUser.role, screen) ? element : <Navigate to="/" replace />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pick" element={guard('pick', <PickTicket />)} />
        <Route path="/inventory" element={guard('inventory', <Inventory />)} />
        <Route path="/loading" element={guard('loading', <Loading />)} />
        <Route path="/unloading" element={guard('unloading', <Unloading />)} />
        <Route path="/orders" element={guard('orders', <Orders />)} />
        <Route path="/reports" element={guard('reports', <Reports />)} />
        <Route path="/audit" element={guard('audit', <AuditLog />)} />
        <Route path="/users" element={guard('users', <Users />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
