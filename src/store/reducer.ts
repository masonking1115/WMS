import type { AuditLogEntry, Pallet, WarehouseState } from '../types'
import { batchLabel, locationLabel, selectPalletsFIFO } from '../rules/rules'
import type { Action } from './actions'

export interface AppState {
  warehouse: WarehouseState
  currentUserId: string | null
}

let auditSeq = 0
function audit(
  userName: string,
  action: string,
  item: string,
  from: string | null,
  to: string | null,
): AuditLogEntry {
  auditSeq++
  return {
    id: `log-${Date.now()}-${auditSeq}`,
    timestamp: new Date().toISOString(),
    user: userName,
    action,
    item,
    from,
    to,
  }
}

function currentUserName(state: AppState): string {
  const u = state.warehouse.users.find((x) => x.id === state.currentUserId)
  return u?.name.split(' ')[0] ?? 'System'
}

/** Recompute a bay's occupying batch from the pallets actually in it. */
function refreshBayBatch(wh: WarehouseState, bayId: string): void {
  const bay = wh.bays.find((b) => b.id === bayId)
  if (!bay) return
  const inBay = wh.pallets.find((p) => p.locationId === bayId)
  bay.batchId = inBay ? inBay.batchId : null
}

function movePallet(
  wh: WarehouseState,
  pallet: Pallet,
  toLocationId: string,
  status: Pallet['status'],
): void {
  const fromBay = pallet.locationId
  pallet.locationId = toLocationId
  pallet.status = status
  // Keep bay batch occupancy in sync on both ends of the move.
  if (wh.bays.some((b) => b.id === fromBay)) refreshBayBatch(wh, fromBay)
  if (wh.bays.some((b) => b.id === toLocationId)) {
    const bay = wh.bays.find((b) => b.id === toLocationId)!
    if (!bay.batchId) bay.batchId = pallet.batchId
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, currentUserId: action.userId }

    case 'LOGOUT':
      return { ...state, currentUserId: null }

    case 'PICK_PALLET': {
      const wh = structuredClone(state.warehouse)
      const pallet = wh.pallets.find((p) => p.id === action.palletId)
      if (!pallet) return state
      const from = locationLabel(wh, pallet.locationId)
      movePallet(wh, pallet, action.toLocationId, 'staged')
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Picked', batchLabel(wh, pallet.batchId), from, locationLabel(wh, action.toLocationId)),
      )
      return { ...state, warehouse: wh }
    }

    case 'LOAD_PALLET': {
      const wh = structuredClone(state.warehouse)
      const pallet = wh.pallets.find((p) => p.id === action.palletId)
      if (!pallet) return state
      const from = locationLabel(wh, pallet.locationId)
      movePallet(wh, pallet, action.doorId, 'loaded')
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Loaded', batchLabel(wh, pallet.batchId), from, locationLabel(wh, action.doorId)),
      )
      return { ...state, warehouse: wh }
    }

    case 'UNLOAD_PALLET': {
      const wh = structuredClone(state.warehouse)
      const pallet = wh.pallets.find((p) => p.id === action.palletId)
      if (!pallet) return state
      const from = locationLabel(wh, pallet.locationId)
      movePallet(wh, pallet, action.bayId, 'stored')
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Unloaded', batchLabel(wh, pallet.batchId), from, locationLabel(wh, action.bayId)),
      )
      return { ...state, warehouse: wh }
    }

    case 'MOVE_PALLET': {
      const wh = structuredClone(state.warehouse)
      const pallet = wh.pallets.find((p) => p.id === action.palletId)
      if (!pallet) return state
      const from = locationLabel(wh, pallet.locationId)
      const isBay = wh.bays.some((b) => b.id === action.toLocationId)
      movePallet(wh, pallet, action.toLocationId, isBay ? 'stored' : pallet.status)
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Moved', batchLabel(wh, pallet.batchId), from, locationLabel(wh, action.toLocationId)),
      )
      return { ...state, warehouse: wh }
    }

    case 'COMBINE_BAYS': {
      const wh = structuredClone(state.warehouse)
      const moving = wh.pallets.filter((p) => p.locationId === action.fromBayId)
      for (const pallet of moving) movePallet(wh, pallet, action.toBayId, 'stored')
      if (moving.length) {
        wh.auditLog.unshift(
          audit(
            currentUserName(state),
            'Combined bays',
            `${moving.length} pallet(s)`,
            locationLabel(wh, action.fromBayId),
            locationLabel(wh, action.toBayId),
          ),
        )
      }
      return { ...state, warehouse: wh }
    }

    case 'CREATE_ORDER': {
      const wh = structuredClone(state.warehouse)
      wh.orders.push(action.order)
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Created order', action.order.orderNumber, null, null),
      )
      return { ...state, warehouse: wh }
    }

    case 'ASSIGN_DOOR': {
      const wh = structuredClone(state.warehouse)
      const order = wh.orders.find((o) => o.id === action.orderId)
      const door = wh.dockDoors.find((d) => d.id === action.doorId)
      if (!order || !door) return state
      // Free any door previously holding this order.
      wh.dockDoors.forEach((d) => {
        if (d.assignedOrderId === order.id) d.assignedOrderId = null
      })
      door.assignedOrderId = order.id
      order.dockDoorId = door.id
      // Resolve pallets for the order via FIFO if not already assigned.
      if (order.palletIds.length === 0) {
        const ids: string[] = []
        for (const line of order.lines) {
          ids.push(...selectPalletsFIFO(wh, line.productId, line.pallets).map((p) => p.id))
        }
        order.palletIds = ids
      }
      order.status = 'picking'
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Assigned door', order.orderNumber, null, `Dock Door ${door.door}`),
      )
      return { ...state, warehouse: wh }
    }

    case 'COMPLETE_ORDER': {
      const wh = structuredClone(state.warehouse)
      const order = wh.orders.find((o) => o.id === action.orderId)
      if (!order) return state
      order.status = 'complete'
      if (order.dockDoorId) {
        const door = wh.dockDoors.find((d) => d.id === order.dockDoorId)
        if (door) door.assignedOrderId = null
      }
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Completed order', order.orderNumber, null, null),
      )
      return { ...state, warehouse: wh }
    }

    case 'LOG_REJECT': {
      const wh = structuredClone(state.warehouse)
      wh.auditLog.unshift(
        audit(currentUserName(state), 'Rejected scan', action.item, null, action.detail),
      )
      return { ...state, warehouse: wh }
    }

    case 'RESET_DEMO':
      return state // handled in provider (needs fresh seed)

    default:
      return state
  }
}
