// Domain types for the Warehouse Management System.
// These mirror the "Warehouse Objects" and rules from the spec.

export type Role =
  | 'manager'
  | 'supervisor'
  | 'inventory_manager'
  | 'shipping_clerk'
  | 'forklift_operator'
  | 'inbound_scheduler'
  | 'outbound_scheduler'

export interface User {
  id: string
  username: string
  password: string
  name: string
  role: Role
}

export interface Product {
  id: string
  sku: string
  name: string
  /** Shelf life in days from receipt; used to compute expiration. */
  shelfLifeDays: number
}

export interface Batch {
  id: string
  /** Human-facing batch number, e.g. "12345". */
  batchNumber: string
  productId: string
  receivedDate: string // ISO date
  expirationDate: string // ISO date
}

export type PalletSize = 'S' | 'M' | 'L'

export type PalletStatus = 'stored' | 'picked' | 'staged' | 'loaded'

export interface Pallet {
  /** Barcode value scanned by the gun. */
  id: string
  batchId: string
  caseCount: number
  size: PalletSize
  status: PalletStatus
  /** Id of the Bay / StagingArea / DockDoor the pallet currently sits in. */
  locationId: string
}

export type LocationKind = 'bay' | 'staging' | 'dock'

export interface Bay {
  kind: 'bay'
  id: string // e.g. "E68"
  aisle: string // "E"
  bay: number // 68
  /** Max pallets the bay holds. */
  capacity: number
  /** Batch currently occupying the bay; null when empty. No batch mixing. */
  batchId: string | null
}

export interface StagingArea {
  kind: 'staging'
  id: string // e.g. "S5"
  label: string // "Staging Area 5"
  capacity: number
}

export interface DockDoor {
  kind: 'dock'
  id: string // e.g. "D5"
  door: number // 5
  /** Order number the shipping clerk assigned to this door; null when idle. */
  assignedOrderId: string | null
}

export type Location = Bay | StagingArea | DockDoor

export interface OrderLine {
  productId: string
  /** Number of pallets requested for this product. */
  pallets: number
}

export type OrderStatus = 'open' | 'picking' | 'staged' | 'loading' | 'complete'

export interface Order {
  id: string
  orderNumber: string
  customer: string
  dockDoorId: string | null
  status: OrderStatus
  lines: OrderLine[]
  /** Pallet ids assigned to fulfil this order (resolved from FIFO + lines). */
  palletIds: string[]
  createdAt: string
}

/** A single stop on a route-optimized pick ticket. */
export interface PickStep {
  palletId: string
  locationId: string
  size: PalletSize
  batchNumber: string
  productName: string
  /** True once the operator has scanned this pallet. */
  picked: boolean
}

export interface AuditLogEntry {
  id: string
  timestamp: string // ISO
  user: string
  action: string // "Moved", "Picked", "Loaded", "Unloaded", "Rejected scan"...
  item: string // "Vitamin Water Batch 12345"
  from: string | null
  to: string | null
}

export interface WarehouseState {
  users: User[]
  products: Product[]
  batches: Batch[]
  pallets: Pallet[]
  bays: Bay[]
  stagingAreas: StagingArea[]
  dockDoors: DockDoor[]
  orders: Order[]
  auditLog: AuditLogEntry[]
}
