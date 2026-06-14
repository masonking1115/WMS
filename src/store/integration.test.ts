import { describe, expect, it } from 'vitest'
import { makeSeedState, INBOUND_DOOR_ID } from '../data/seed'
import { reducer, type AppState } from './reducer'
import {
  buildPickTicket,
  selectPalletsFIFO,
  verifyLoadScan,
  verifyPickScan,
  verifyUnloadScan,
} from '../rules/rules'

function seededApp(): AppState {
  return { warehouse: makeSeedState(), currentUserId: 'u5' } // Chase, forklift op
}

describe('seed integrity', () => {
  it('order ORD-1001 has a FIFO pick ticket of the oldest Vitamin Water batch', () => {
    const app = seededApp()
    const order = app.warehouse.orders.find((o) => o.orderNumber === 'ORD-1001')!
    expect(order.palletIds.length).toBe(2)
    const steps = buildPickTicket(app.warehouse, order)
    // Both steps should be batch 12345 (b-vw1), the oldest VW batch.
    for (const s of steps) expect(s.batchNumber).toBe('12345')
  })

  it('parks an inbound truck of Spring Water batch 55540 at the receiving door', () => {
    const wh = makeSeedState()
    const inbound = wh.pallets.filter((p) => p.locationId === INBOUND_DOOR_ID && p.status === 'stored')
    expect(inbound.length).toBe(10)
    expect(new Set(inbound.map((p) => p.batchId))).toEqual(new Set(['b-sw2']))
  })
})

describe('pick → load flow through the reducer', () => {
  it('picks a pallet to staging, then loads it at the assigned door, updating counts', () => {
    let app = seededApp()
    const order = app.warehouse.orders.find((o) => o.orderNumber === 'ORD-1001')!
    const palletId = order.palletIds[0]

    // Pick the pallet to Staging Area 1.
    app = reducer(app, { type: 'PICK_PALLET', palletId, toLocationId: 'S1' })
    const afterPick = app.warehouse.pallets.find((p) => p.id === palletId)!
    expect(afterPick.status).toBe('staged')
    expect(afterPick.locationId).toBe('S1')

    // It is now loadable at Door 5 (the door assigned to ORD-1001).
    expect(verifyLoadScan(app.warehouse, 'D5', palletId).ok).toBe(true)

    // Load it.
    app = reducer(app, { type: 'LOAD_PALLET', palletId, doorId: 'D5' })
    const afterLoad = app.warehouse.pallets.find((p) => p.id === palletId)!
    expect(afterLoad.status).toBe('loaded')
    expect(afterLoad.locationId).toBe('D5')

    // The move was audited.
    expect(app.warehouse.auditLog.some((e) => e.action === 'Loaded')).toBe(true)
  })

  it('rejects loading a pallet that was never picked', () => {
    const app = seededApp()
    const order = app.warehouse.orders.find((o) => o.orderNumber === 'ORD-1001')!
    // Still "stored" — not picked yet.
    expect(verifyLoadScan(app.warehouse, 'D5', order.palletIds[0]).ok).toBe(false)
  })
})

describe('unload flow enforces batch rules', () => {
  it('rejects unloading inbound Spring Water (55540) into a bay holding a different batch', () => {
    const wh = makeSeedState()
    const inbound = wh.pallets.find((p) => p.locationId === INBOUND_DOOR_ID)!
    // C20 holds batch b-sw1 (55501); inbound is b-sw2 (55540).
    expect(verifyUnloadScan(wh, 'C20', inbound.id).ok).toBe(false)
  })

  it('accepts unloading inbound Spring Water into an empty bay', () => {
    const wh = makeSeedState()
    const inbound = wh.pallets.find((p) => p.locationId === INBOUND_DOOR_ID)!
    const emptyBay = wh.bays.find((b) => b.batchId === null)!
    const res = verifyUnloadScan(wh, emptyBay.id, inbound.id)
    expect(res.ok).toBe(true)
  })
})

describe('FIFO / wrong-pallet verification on seed', () => {
  it('selects oldest Vitamin Water batch first', () => {
    const wh = makeSeedState()
    const picked = selectPalletsFIFO(wh, 'p-vw', 1)
    expect(picked[0].batchId).toBe('b-vw1') // received 2026-01-10, older than b-vw2
  })

  it('rejects scanning a pallet not on the pick ticket', () => {
    const wh = makeSeedState()
    const order = wh.orders.find((o) => o.orderNumber === 'ORD-1001')!
    const steps = buildPickTicket(wh, order)
    const decoy = wh.pallets.find((p) => !order.palletIds.includes(p.id))!
    expect(verifyPickScan(steps, decoy.id).ok).toBe(false)
  })
})
