import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { makeSeedState } from '../data/seed'
import type { User } from '../types'
import type { Action } from './actions'
import { reducer, type AppState } from './reducer'

const STORAGE_KEY = 'wms-state-v1'

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed?.warehouse?.pallets) return parsed
    }
  } catch {
    // ignore corrupt storage and fall back to seed
  }
  return { warehouse: makeSeedState(), currentUserId: null }
}

interface StoreValue {
  state: AppState
  dispatch: (action: Action) => void
  currentUser: User | null
  resetDemo: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, undefined, loadInitial)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full / unavailable — non-fatal for a demo
    }
  }, [state])

  const dispatch = (action: Action) => {
    if (action.type === 'RESET_DEMO') {
      localStorage.removeItem(STORAGE_KEY)
      // Force a fresh seed by replacing state through a login-less reset.
      baseDispatch({ type: 'LOGOUT' })
      window.location.reload()
      return
    }
    baseDispatch(action)
  }

  const currentUser =
    state.warehouse.users.find((u) => u.id === state.currentUserId) ?? null

  const resetDemo = () => dispatch({ type: 'RESET_DEMO' })

  return (
    <StoreContext.Provider value={{ state, dispatch, currentUser, resetDemo }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

/** Convenience accessor for the warehouse slice. */
export function useWarehouse() {
  return useStore().state.warehouse
}
