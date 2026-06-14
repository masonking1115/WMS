// Seeded warehouse used on first load (and on "reset demo data"). Deterministic
// so the demo always looks the same. Models a small but realistic warehouse:
// a few aisles of bays, staging areas, dock doors, products with batches, pallets
// placed in bays, and a couple of open orders.

import type {
  AuditLogEntry,
  Bay,
  Batch,
  DockDoor,
  Order,
  Pallet,
  Product,
  StagingArea,
  User,
  WarehouseState,
} from '../types'

const users: User[] = [
  { id: 'u1', username: 'manager', password: 'manager', name: 'Morgan (Manager)', role: 'manager' },
  { id: 'u2', username: 'super', password: 'super', name: 'Sam (Supervisor)', role: 'supervisor' },
  { id: 'u3', username: 'invmgr', password: 'invmgr', name: 'Ivy (Inventory Mgr)', role: 'inventory_manager' },
  { id: 'u4', username: 'clerk', password: 'clerk', name: 'Casey (Shipping Clerk)', role: 'shipping_clerk' },
  { id: 'u5', username: 'chase', password: 'chase', name: 'Chase (Forklift Op)', role: 'forklift_operator' },
  { id: 'u6', username: 'inbound', password: 'inbound', name: 'Ingrid (Inbound)', role: 'inbound_scheduler' },
  { id: 'u7', username: 'outbound', password: 'outbound', name: 'Otis (Outbound)', role: 'outbound_scheduler' },
]

const products: Product[] = [
  { id: 'p-vw', sku: 'VW-20', name: 'Vitamin Water', shelfLifeDays: 270 },
  { id: 'p-sw', sku: 'SW-16', name: 'Spring Water', shelfLifeDays: 730 },
  { id: 'p-en', sku: 'EN-12', name: 'Energy Drink', shelfLifeDays: 365 },
  { id: 'p-jc', sku: 'JC-32', name: 'Orange Juice', shelfLifeDays: 120 },
]

// Batches — note expiration dates relative to the demo "today" of 2026-06-13.
const batches: Batch[] = [
  { id: 'b-vw1', batchNumber: '12345', productId: 'p-vw', receivedDate: '2026-01-10', expirationDate: '2026-10-07' },
  { id: 'b-vw2', batchNumber: '12377', productId: 'p-vw', receivedDate: '2026-03-02', expirationDate: '2026-11-27' },
  { id: 'b-sw1', batchNumber: '55501', productId: 'p-sw', receivedDate: '2026-02-15', expirationDate: '2028-02-15' },
  { id: 'b-en1', batchNumber: '70010', productId: 'p-en', receivedDate: '2026-04-01', expirationDate: '2027-04-01' },
  // Orange juice batch that is already expired as of the demo date — drives the
  // dashboard "expired product" warning.
  { id: 'b-jc1', batchNumber: '88001', productId: 'p-jc', receivedDate: '2026-01-01', expirationDate: '2026-05-01' },
  // Orange juice batch expiring soon (within ~3 weeks of demo date).
  { id: 'b-jc2', batchNumber: '88042', productId: 'p-jc', receivedDate: '2026-03-10', expirationDate: '2026-07-08' },
  // Inbound Spring Water batch sitting on a truck at the receiving door — a
  // *different* batch from the b-sw1 already in C20, so unloading it into C20
  // is correctly rejected (no batch mixing).
  { id: 'b-sw2', batchNumber: '55540', productId: 'p-sw', receivedDate: '2026-06-13', expirationDate: '2028-06-13' },
]

// Bays: aisles A–E, with realistic capacities. Forklift-friendly ids like "E68".
function makeBays(): Bay[] {
  const bays: Bay[] = []
  const layout: Record<string, number[]> = {
    A: [1, 2, 3, 4],
    B: [10, 12, 14, 16],
    C: [20, 22, 24, 26],
    D: [40, 42, 44, 46],
    E: [60, 64, 66, 68, 70],
  }
  for (const [aisle, nums] of Object.entries(layout)) {
    for (const n of nums) {
      bays.push({ kind: 'bay', id: `${aisle}${n}`, aisle, bay: n, capacity: 72, batchId: null })
    }
  }
  return bays
}

const bays = makeBays()

const stagingAreas: StagingArea[] = [
  { kind: 'staging', id: 'S1', label: 'Staging Area 1', capacity: 24 },
  { kind: 'staging', id: 'S2', label: 'Staging Area 2', capacity: 24 },
  { kind: 'staging', id: 'S3', label: 'Staging Area 3', capacity: 24 },
  { kind: 'staging', id: 'S4', label: 'Staging Area 4', capacity: 24 },
  { kind: 'staging', id: 'S5', label: 'Staging Area 5', capacity: 24 },
]

const dockDoors: DockDoor[] = [
  { kind: 'dock', id: 'D1', door: 1, assignedOrderId: null },
  { kind: 'dock', id: 'D2', door: 2, assignedOrderId: null },
  { kind: 'dock', id: 'D3', door: 3, assignedOrderId: null },
  { kind: 'dock', id: 'D4', door: 4, assignedOrderId: null },
  { kind: 'dock', id: 'D5', door: 5, assignedOrderId: 'o-1001' },
  { kind: 'dock', id: 'D6', door: 6, assignedOrderId: null },
]

// Place pallets into bays and set each bay's occupying batch. The size mix lets
// route optimization show fork-leveling grouping.
const sizes = ['L', 'M', 'S'] as const

interface Placement {
  bayId: string
  batchId: string
  count: number
}

const placements: Placement[] = [
  { bayId: 'E68', batchId: 'b-vw1', count: 6 }, // Vitamin Water 12345 (older — FIFO target)
  { bayId: 'E66', batchId: 'b-vw2', count: 5 }, // Vitamin Water 12377 (newer)
  { bayId: 'E60', batchId: 'b-vw1', count: 2 }, // small remnant — bay-combine candidate
  { bayId: 'C20', batchId: 'b-sw1', count: 40 }, // Spring Water
  { bayId: 'B10', batchId: 'b-en1', count: 24 }, // Energy Drink
  { bayId: 'A01', batchId: 'b-jc1', count: 8 }, // Expired OJ
  { bayId: 'A02', batchId: 'b-jc2', count: 12 }, // OJ expiring soon
]

function makePallets(): Pallet[] {
  const pallets: Pallet[] = []
  let seq = 0
  for (const place of placements) {
    const bay = bays.find((b) => b.id === place.bayId)
    if (bay) bay.batchId = place.batchId
    for (let i = 0; i < place.count; i++) {
      seq++
      pallets.push({
        id: `PAL-${String(1000 + seq)}`,
        batchId: place.batchId,
        caseCount: 36 + (i % 5),
        size: sizes[seq % sizes.length],
        status: 'stored',
        locationId: place.bayId,
      })
    }
  }
  return pallets
}

const pallets = makePallets()

// Inbound truck: pallets parked at receiving Dock Door 1, status "stored" but
// not yet in a bay. Unloading moves these into bays under the batch rules.
const INBOUND_DOOR = 'D1'
for (let i = 0; i < 10; i++) {
  pallets.push({
    id: `PAL-IN-${100 + i}`,
    batchId: 'b-sw2',
    caseCount: 38 + (i % 4),
    size: sizes[i % sizes.length],
    status: 'stored',
    locationId: INBOUND_DOOR,
  })
}

/** Pallets sitting on an inbound truck (at a receiving door, not yet in a bay). */
export const INBOUND_DOOR_ID = INBOUND_DOOR

// One open order assigned to Dock Door 5 (matches the spec scenarios). Two
// Vitamin Water pallets from the oldest batch (FIFO) make up the pick ticket.
function makeOrders(): Order[] {
  const vwOldest = pallets
    .filter((p) => p.batchId === 'b-vw1')
    .slice(0, 2)
    .map((p) => p.id)
  return [
    {
      id: 'o-1001',
      orderNumber: 'ORD-1001',
      customer: 'Northside Grocers',
      dockDoorId: 'D5',
      status: 'picking',
      lines: [{ productId: 'p-vw', pallets: 2 }],
      palletIds: vwOldest,
      createdAt: '2026-06-12',
    },
    {
      id: 'o-1002',
      orderNumber: 'ORD-1002',
      customer: 'Harbor Foods',
      dockDoorId: null,
      status: 'open',
      lines: [{ productId: 'p-en', pallets: 4 }],
      palletIds: [],
      createdAt: '2026-06-13',
    },
  ]
}

const orders = makeOrders()

const auditLog: AuditLogEntry[] = [
  {
    id: 'a1',
    timestamp: '2026-06-12T10:45:00',
    user: 'Chase',
    action: 'Moved',
    item: 'Vitamin Water Batch 12345',
    from: 'E68',
    to: 'Staging Area 5',
  },
]

export function makeSeedState(): WarehouseState {
  // Deep clone so callers can mutate freely without touching the seed constants.
  return structuredClone({
    users,
    products,
    batches,
    pallets,
    bays,
    stagingAreas,
    dockDoors,
    orders,
    auditLog,
  })
}

/** Demo "today" — keeps expiration warnings deterministic regardless of clock. */
export const DEMO_TODAY = '2026-06-13'
