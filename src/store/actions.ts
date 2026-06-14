import type { Order } from '../types'

// All the ways state can change. Every mutation flows through the reducer so that
// rules + audit logging happen in one place.
export type Action =
  | { type: 'LOGIN'; userId: string }
  | { type: 'LOGOUT' }
  | { type: 'PICK_PALLET'; palletId: string; toLocationId: string }
  | { type: 'LOAD_PALLET'; palletId: string; doorId: string }
  | { type: 'UNLOAD_PALLET'; palletId: string; bayId: string }
  | { type: 'MOVE_PALLET'; palletId: string; toLocationId: string }
  | { type: 'COMBINE_BAYS'; fromBayId: string; toBayId: string }
  | { type: 'CREATE_ORDER'; order: Order }
  | { type: 'ASSIGN_DOOR'; orderId: string; doorId: string }
  | { type: 'COMPLETE_ORDER'; orderId: string }
  | { type: 'LOG_REJECT'; item: string; detail: string }
  | { type: 'RESET_DEMO' }
