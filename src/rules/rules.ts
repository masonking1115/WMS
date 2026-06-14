// Pure business-rule functions for the WMS. No React, no storage — just logic.
// These are the rules that prevent the costly errors described in the spec:
// wrong-pallet picks, wrong-door loads, batch mixing, over-capacity bays, and
// FIFO violations. Everything here is unit-tested in rules.test.ts.

import type {
  Bay,
  Batch,
  Location,
  Order,
  Pallet,
  PickStep,
  Product,
  WarehouseState,
} from '../types'

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getLocation(state: WarehouseState, id: string): Location | undefined {
  return (
    state.bays.find((b) => b.id === id) ||
    state.stagingAreas.find((s) => s.id === id) ||
    state.dockDoors.find((d) => d.id === id)
  )
}

export function locationLabel(state: WarehouseState, id: string): string {
  const loc = getLocation(state, id)
  if (!loc) return id
  if (loc.kind === 'bay') return `Aisle ${loc.aisle} Bay ${loc.bay}`
  if (loc.kind === 'staging') return loc.label
  return `Dock Door ${loc.door}`
}

export function capacityOf(loc: Location): number {
  return loc.kind === 'dock' ? Infinity : loc.capacity
}

export function palletsIn(state: WarehouseState, locationId: string): Pallet[] {
  return state.pallets.filter((p) => p.locationId === locationId)
}

export function batchById(state: WarehouseState, id: string): Batch | undefined {
  return state.batches.find((b) => b.id === id)
}

export function productById(state: WarehouseState, id: string): Product | undefined {
  return state.products.find((p) => p.id === id)
}

export function batchLabel(state: WarehouseState, batchId: string): string {
  const batch = batchById(state, batchId)
  if (!batch) return batchId
  const product = productById(state, batch.productId)
  return `${product?.name ?? 'Unknown'} Batch ${batch.batchNumber}`
}

// ---------------------------------------------------------------------------
// Capacity & bay rules
// ---------------------------------------------------------------------------

export interface Occupancy {
  count: number
  capacity: number
  full: boolean
}

export function occupancy(state: WarehouseState, locationId: string): Occupancy {
  const loc = getLocation(state, locationId)
  const count = palletsIn(state, locationId).length
  const capacity = loc ? capacityOf(loc) : 0
  return { count, capacity, full: count >= capacity }
}

/**
 * Can a pallet of `batchId` be unloaded into this bay?
 * Rejects when the bay is full, or when it already holds a *different* batch
 * (no batch mixing). An empty bay accepts any batch.
 */
export function canUnloadIntoBay(
  state: WarehouseState,
  bayId: string,
  batchId: string,
): { ok: boolean; reason?: string } {
  const bay = state.bays.find((b) => b.id === bayId)
  if (!bay) return { ok: false, reason: 'Bay not found' }
  if (occupancy(state, bayId).full) return { ok: false, reason: 'Bay is full' }
  if (bay.batchId && bay.batchId !== batchId) {
    return { ok: false, reason: 'Bay holds a different batch — cannot mix batches' }
  }
  return { ok: true }
}

/**
 * Pick a destination bay for an incoming batch: prefer a bay already holding the
 * same batch that still has room; otherwise the first empty bay. Returns null if
 * the warehouse is full for this batch.
 */
export function findBayForBatch(state: WarehouseState, batchId: string): Bay | null {
  const sameBatch = state.bays.find(
    (b) => b.batchId === batchId && !occupancy(state, b.id).full,
  )
  if (sameBatch) return sameBatch
  const empty = state.bays.find((b) => b.batchId === null && palletsIn(state, b.id).length === 0)
  return empty ?? null
}

// ---------------------------------------------------------------------------
// Expiration / FIFO
// ---------------------------------------------------------------------------

export function isExpired(batch: Batch, today: string): boolean {
  return batch.expirationDate < today
}

export function daysUntil(dateIso: string, today: string): number {
  const ms = new Date(dateIso).getTime() - new Date(today).getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * FIFO selection: choose `count` pallets of a product, oldest received batch
 * first. This is what keeps product from expiring on the shelf.
 */
export function selectPalletsFIFO(
  state: WarehouseState,
  productId: string,
  count: number,
): Pallet[] {
  const batchAge = new Map(state.batches.map((b) => [b.id, b.receivedDate]))
  const candidates = state.pallets
    .filter((p) => p.status === 'stored')
    .filter((p) => {
      const batch = batchById(state, p.batchId)
      return batch?.productId === productId
    })
    .sort((a, b) => {
      const da = batchAge.get(a.batchId) ?? ''
      const db = batchAge.get(b.batchId) ?? ''
      return da < db ? -1 : da > db ? 1 : 0 // oldest first
    })
  return candidates.slice(0, count)
}

// ---------------------------------------------------------------------------
// Route optimization
// ---------------------------------------------------------------------------

const sizeRank: Record<string, number> = { L: 0, M: 1, S: 2 }

/**
 * Order pick steps to cut travel time: walk the warehouse by aisle (A→Z) then by
 * bay number ascending — a clean top-to-bottom sweep. Within the same bay, larger
 * pallets come first so the operator sets the forks high once (fork leveling).
 */
export function optimizeRoute(state: WarehouseState, steps: PickStep[]): PickStep[] {
  const bayOf = (id: string) => state.bays.find((b) => b.id === id)
  return [...steps].sort((a, b) => {
    const ba = bayOf(a.locationId)
    const bb = bayOf(b.locationId)
    if (ba && bb) {
      if (ba.aisle !== bb.aisle) return ba.aisle < bb.aisle ? -1 : 1
      if (ba.bay !== bb.bay) return ba.bay - bb.bay
    }
    return sizeRank[a.size] - sizeRank[b.size]
  })
}

// ---------------------------------------------------------------------------
// Scan verification
// ---------------------------------------------------------------------------

export type ScanResult =
  | { ok: true; step: PickStep }
  | { ok: false; reason: string }

/**
 * Pick scan (spec scenarios 1 & 2): the scanned barcode must match a pallet still
 * left to pick on this ticket. Anything else — a pallet from the wrong bay, an
 * unknown barcode, an already-picked pallet — is rejected, and the operator
 * cannot advance.
 */
export function verifyPickScan(steps: PickStep[], scannedId: string): ScanResult {
  const id = scannedId.trim()
  const step = steps.find((s) => s.palletId === id)
  if (!step) {
    return { ok: false, reason: `Pallet ${id || '—'} is not on this pick ticket — wrong pallet` }
  }
  if (step.picked) {
    return { ok: false, reason: `Pallet ${id} was already picked` }
  }
  return { ok: true, step }
}

/**
 * Load scan (spec scenario 3): scan a pallet at a dock door. The pallet must
 * belong to the order assigned to that door and must already be picked/staged.
 * A pallet assigned to Door 5 cannot be loaded at Door 4.
 */
export function verifyLoadScan(
  state: WarehouseState,
  doorId: string,
  scannedId: string,
): { ok: boolean; reason?: string; pallet?: Pallet } {
  const id = scannedId.trim()
  const door = state.dockDoors.find((d) => d.id === doorId)
  if (!door) return { ok: false, reason: 'Dock door not found' }
  if (!door.assignedOrderId) return { ok: false, reason: 'No order assigned to this door' }
  const order = state.orders.find((o) => o.id === door.assignedOrderId)
  if (!order) return { ok: false, reason: 'Assigned order not found' }
  const pallet = state.pallets.find((p) => p.id === id)
  if (!pallet) return { ok: false, reason: `Unknown barcode ${id || '—'}` }
  if (!order.palletIds.includes(pallet.id)) {
    return { ok: false, reason: `Pallet ${id} is not on order ${order.orderNumber} — wrong door` }
  }
  if (pallet.status === 'stored') {
    return { ok: false, reason: `Pallet ${id} has not been picked yet — cannot load` }
  }
  if (pallet.status === 'loaded') {
    return { ok: false, reason: `Pallet ${id} is already loaded` }
  }
  return { ok: true, pallet }
}

/**
 * Unload scan (spec scenario 4): scan a pallet into a bay. Enforces the
 * single-batch-per-bay rule and capacity.
 */
export function verifyUnloadScan(
  state: WarehouseState,
  bayId: string,
  scannedId: string,
): { ok: boolean; reason?: string; pallet?: Pallet } {
  const id = scannedId.trim()
  const pallet = state.pallets.find((p) => p.id === id)
  if (!pallet) return { ok: false, reason: `Unknown barcode ${id || '—'}` }
  const check = canUnloadIntoBay(state, bayId, pallet.batchId)
  if (!check.ok) return { ok: false, reason: check.reason }
  return { ok: true, pallet }
}

// ---------------------------------------------------------------------------
// Pick-ticket derivation
// ---------------------------------------------------------------------------

/** Build the route-optimized pick ticket for an order from its assigned pallets. */
export function buildPickTicket(state: WarehouseState, order: Order): PickStep[] {
  const steps: PickStep[] = order.palletIds
    .map((pid) => state.pallets.find((p) => p.id === pid))
    .filter((p): p is Pallet => Boolean(p))
    .map((p) => {
      const batch = batchById(state, p.batchId)
      const product = batch ? productById(state, batch.productId) : undefined
      return {
        palletId: p.id,
        locationId: p.locationId,
        size: p.size,
        batchNumber: batch?.batchNumber ?? '?',
        productName: product?.name ?? 'Unknown',
        picked: p.status !== 'stored',
      }
    })
  return optimizeRoute(state, steps)
}
