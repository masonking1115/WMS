import { describe, expect, it } from 'vitest'
import type { PickStep, WarehouseState } from '../types'
import {
  buildPickTicket,
  canUnloadIntoBay,
  findBayForBatch,
  isExpired,
  occupancy,
  optimizeRoute,
  selectPalletsFIFO,
  verifyLoadScan,
  verifyPickScan,
  verifyUnloadScan,
} from './rules'

// Minimal hand-built warehouse used across the rule tests.
function makeState(): WarehouseState {
  return {
    users: [],
    products: [{ id: 'p1', sku: 'VW', name: 'Vitamin Water', shelfLifeDays: 365 }],
    batches: [
      { id: 'b1', batchNumber: '11111', productId: 'p1', receivedDate: '2026-01-01', expirationDate: '2027-01-01' },
      { id: 'b2', batchNumber: '22222', productId: 'p1', receivedDate: '2026-03-01', expirationDate: '2027-03-01' },
      { id: 'bexp', batchNumber: '00000', productId: 'p1', receivedDate: '2025-01-01', expirationDate: '2026-01-01' },
    ],
    pallets: [
      { id: 'PAL-E68', batchId: 'b1', caseCount: 40, size: 'L', status: 'stored', locationId: 'E68' },
      { id: 'PAL-E66', batchId: 'b2', caseCount: 30, size: 'S', status: 'stored', locationId: 'E66' },
      { id: 'PAL-C20', batchId: 'b2', caseCount: 30, size: 'M', status: 'stored', locationId: 'C20' },
    ],
    bays: [
      { kind: 'bay', id: 'E68', aisle: 'E', bay: 68, capacity: 2, batchId: 'b1' },
      { kind: 'bay', id: 'E66', aisle: 'E', bay: 66, capacity: 2, batchId: 'b2' },
      { kind: 'bay', id: 'C20', aisle: 'C', bay: 20, capacity: 72, batchId: 'b2' },
      { kind: 'bay', id: 'C22', aisle: 'C', bay: 22, capacity: 2, batchId: null },
      { kind: 'bay', id: 'A01', aisle: 'A', bay: 1, capacity: 1, batchId: 'b1' },
    ],
    stagingAreas: [{ kind: 'staging', id: 'S5', label: 'Staging Area 5', capacity: 24 }],
    dockDoors: [
      { kind: 'dock', id: 'D5', door: 5, assignedOrderId: 'o1' },
      { kind: 'dock', id: 'D4', door: 4, assignedOrderId: null },
    ],
    orders: [
      {
        id: 'o1',
        orderNumber: 'ORD-1001',
        customer: 'Acme',
        dockDoorId: 'D5',
        status: 'picking',
        lines: [{ productId: 'p1', pallets: 2 }],
        palletIds: ['PAL-E68', 'PAL-E66'],
        createdAt: '2026-06-10',
      },
    ],
    auditLog: [],
  }
}

describe('capacity & occupancy', () => {
  it('counts pallets in a location', () => {
    const s = makeState()
    expect(occupancy(s, 'E68').count).toBe(1)
    expect(occupancy(s, 'E68').capacity).toBe(2)
    expect(occupancy(s, 'E68').full).toBe(false)
  })

  it('marks a bay full when at capacity', () => {
    const s = makeState()
    s.pallets.push({ id: 'PAL-A01', batchId: 'b1', caseCount: 1, size: 'S', status: 'stored', locationId: 'A01' })
    expect(occupancy(s, 'A01').full).toBe(true) // capacity 1, now holds 1
  })
})

describe('batch / unload rules', () => {
  it('rejects unloading a different batch into an occupied bay (no mixing)', () => {
    const s = makeState()
    const res = canUnloadIntoBay(s, 'C20', 'b1') // C20 holds b2
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/mix/i)
  })

  it('accepts the same batch into a bay with room', () => {
    const s = makeState()
    expect(canUnloadIntoBay(s, 'C20', 'b2').ok).toBe(true)
  })

  it('rejects unloading into a full bay', () => {
    const s = makeState()
    s.pallets.push({ id: 'X', batchId: 'b1', caseCount: 1, size: 'S', status: 'stored', locationId: 'A01' })
    expect(canUnloadIntoBay(s, 'A01', 'b1').ok).toBe(false)
  })

  it('finds the same-batch bay first, else an empty bay', () => {
    const s = makeState()
    expect(findBayForBatch(s, 'b2')?.id).toBe('E66') // first same-batch bay with room
    // fill C20 and E66 so b2 must go to an empty bay
    s.bays.find((b) => b.id === 'C20')!.capacity = 1
    s.bays.find((b) => b.id === 'E66')!.capacity = 1
    expect(findBayForBatch(s, 'b2')?.id).toBe('C22') // empty
  })
})

describe('FIFO & expiration', () => {
  it('selects oldest received batch first', () => {
    const s = makeState()
    const picked = selectPalletsFIFO(s, 'p1', 1)
    expect(picked[0].id).toBe('PAL-E68') // b1 received 2026-01-01, older than b2
  })

  it('detects an expired batch', () => {
    const s = makeState()
    const expired = s.batches.find((b) => b.id === 'bexp')!
    expect(isExpired(expired, '2026-06-13')).toBe(true)
    const fresh = s.batches.find((b) => b.id === 'b1')!
    expect(isExpired(fresh, '2026-06-13')).toBe(false)
  })
})

describe('route optimization', () => {
  it('orders steps by aisle then bay (travel sweep)', () => {
    const s = makeState()
    const steps: PickStep[] = [
      { palletId: 'PAL-E68', locationId: 'E68', size: 'L', batchNumber: '1', productName: 'x', picked: false },
      { palletId: 'PAL-C20', locationId: 'C20', size: 'M', batchNumber: '2', productName: 'x', picked: false },
      { palletId: 'PAL-E66', locationId: 'E66', size: 'S', batchNumber: '2', productName: 'x', picked: false },
    ]
    const route = optimizeRoute(s, steps)
    expect(route.map((r) => r.locationId)).toEqual(['C20', 'E66', 'E68'])
  })
})

describe('pick scan verification', () => {
  it('accepts a pallet that is on the ticket', () => {
    const s = makeState()
    const steps = buildPickTicket(s, s.orders[0])
    const res = verifyPickScan(steps, 'PAL-E68')
    expect(res.ok).toBe(true)
  })

  it('rejects the wrong pallet (E66 when not on ticket)', () => {
    const s = makeState()
    // ticket only has E68 + E66; scan a bay not on the ticket
    const steps = buildPickTicket(s, s.orders[0])
    const res = verifyPickScan(steps, 'PAL-C20')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/wrong pallet/i)
  })

  it('rejects a pallet already picked', () => {
    const s = makeState()
    const steps = buildPickTicket(s, s.orders[0]).map((st) =>
      st.palletId === 'PAL-E68' ? { ...st, picked: true } : st,
    )
    expect(verifyPickScan(steps, 'PAL-E68').ok).toBe(false)
  })
})

describe('load scan verification', () => {
  it('rejects a pallet not on the door’s order (wrong door)', () => {
    const s = makeState()
    s.pallets.find((p) => p.id === 'PAL-E68')!.status = 'staged'
    const res = verifyLoadScan(s, 'D5', 'PAL-C20') // C20 not on order o1
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/wrong door/i)
  })

  it('rejects loading a pallet that has not been picked', () => {
    const s = makeState()
    // PAL-E68 is on order but still "stored"
    expect(verifyLoadScan(s, 'D5', 'PAL-E68').ok).toBe(false)
  })

  it('accepts a staged pallet on the correct door', () => {
    const s = makeState()
    s.pallets.find((p) => p.id === 'PAL-E68')!.status = 'staged'
    expect(verifyLoadScan(s, 'D5', 'PAL-E68').ok).toBe(true)
  })

  it('rejects when no order is assigned to the door', () => {
    const s = makeState()
    expect(verifyLoadScan(s, 'D4', 'PAL-E68').ok).toBe(false)
  })
})

describe('unload scan verification', () => {
  it('rejects an unknown barcode', () => {
    const s = makeState()
    expect(verifyUnloadScan(s, 'C22', 'NOPE').ok).toBe(false)
  })

  it('rejects mixing batches in a bay', () => {
    const s = makeState()
    // C20 holds b2; try to unload PAL-E68 (b1) there
    expect(verifyUnloadScan(s, 'C20', 'PAL-E68').ok).toBe(false)
  })

  it('accepts a matching batch into an empty bay', () => {
    const s = makeState()
    expect(verifyUnloadScan(s, 'C22', 'PAL-E68').ok).toBe(true)
  })
})
