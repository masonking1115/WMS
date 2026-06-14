import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useStore } from '../store/store'
import { ROLE_LABELS, SCREEN_LABELS, screensFor, type ScreenKey } from '../store/permissions'

const PATHS: Record<ScreenKey, string> = {
  dashboard: '/',
  pick: '/pick',
  inventory: '/inventory',
  loading: '/loading',
  unloading: '/unloading',
  orders: '/orders',
  reports: '/reports',
  audit: '/audit',
  users: '/users',
}

const ICONS: Record<ScreenKey, string> = {
  dashboard: '▣',
  pick: '✓',
  inventory: '☰',
  loading: '⇧',
  unloading: '⇩',
  orders: '✎',
  reports: '◷',
  audit: '⎙',
  users: '⚇',
}

export default function Layout({ children }: { children: ReactNode }) {
  const { currentUser, dispatch, resetDemo } = useStore()
  if (!currentUser) return null
  const screens = screensFor(currentUser.role)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <div className="brand-name">WMS</div>
            <div className="brand-sub">Warehouse Mgmt</div>
          </div>
        </div>

        <nav>
          {screens.map((s) => (
            <NavLink
              key={s}
              to={PATHS[s]}
              end={s === 'dashboard'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{ICONS[s]}</span>
              {SCREEN_LABELS[s]}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">{currentUser.name}</div>
          <div className="user-role">{ROLE_LABELS[currentUser.role]}</div>
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => dispatch({ type: 'LOGOUT' })}>
              Log out
            </button>
            <button className="btn btn-sm" onClick={resetDemo} title="Reset all demo data">
              Reset
            </button>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  )
}
