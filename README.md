# WMS — Warehouse Management System

A self-contained web app that brings scan verification to a warehouse running on
paper. It eliminates the costly errors described in the project brief: wrong-pallet
picks, wrong-door loads, mixed batches, over-capacity bays, and expired stock — all
while cutting travel time with route-optimized pick tickets.

Built with **React + Vite + TypeScript**. All business logic runs client-side and
state persists to `localStorage`, so there's no backend to stand up — it runs
straight from a static host.

## What it does

| Goal (from the brief) | How the app delivers it |
|------|------|
| Reduce shipping errors | Scan verification rejects the wrong pallet / wrong door and won't let the operator advance |
| Increase inventory accuracy | Every move updates counts immediately and is written to the audit log |
| Reduce travel time | Pick tickets are route-optimized (aisle→bay sweep, size-grouped for fork leveling) |
| Improve FIFO compliance | Orders auto-resolve to the oldest received batch first |
| Track bay capacity | Live `n/72` counters and capacity bars; unloading into a full bay is blocked |
| Track staging availability | Staging areas show available / in use / full |

### Screens
- **Login** — role-based access for 7 user types
- **Dashboard** — active orders, capacity alerts, expired & expiring-soon warnings
- **Pick Ticket** — route-optimized steps, scan-to-verify, `n/total` progress
- **Inventory** — search, bay grid, staging availability, move pallets, combine bays
- **Loading** — scan door → scan pallets, rejects wrong-door pallets
- **Unloading** — scan bay → scan pallets, enforces single-batch-per-bay & capacity
- **Orders** — create orders, assign dock doors, generate FIFO pick tickets
- **Reports** — inventory accuracy, scan errors prevented, productivity
- **Audit Log** — full move/scan history

## Scanning in the demo

Real barcode scan guns aren't available in a browser demo, so each scan screen lets
you either **type/paste a barcode** or **tap a candidate** from the list (the list
includes a "wrong" decoy so you can see the red rejection in action).

## Demo accounts

Username = password for all accounts:

| Username | Role |
|----------|------|
| `manager` | Manager (full access) |
| `super` | Supervisor |
| `invmgr` | Inventory Manager |
| `clerk` | Shipping Clerk |
| `chase` | Forklift Operator |
| `inbound` | Inbound Scheduler |
| `outbound` | Outbound Scheduler |

Use the **Reset** button in the sidebar to restore the seeded demo data at any time.

## Try the core flow

1. Log in as `clerk`, open **Orders**, assign a dock door to `ORD-1002` — this
   generates its FIFO pick ticket.
2. Log in as `chase`, open **Pick Ticket**, scan the listed pallets (try a decoy to
   see a rejection), then **Loading** to load them at the assigned door.
3. Open **Unloading** to put the inbound truck away — try unloading into bay `C20`
   to see the batch-mixing rejection, then into the suggested empty bay.
4. Check **Audit Log** and **Reports** to see every move and the errors prevented.

## Run locally

```bash
npm install
npm run dev      # start the dev server
npm test         # run the rules-engine + integration tests (27 tests)
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Architecture

- `src/types.ts` — domain model (Pallet, Bay, Batch, Order, …)
- `src/rules/` — **pure, unit-tested** business rules (scan verification, FIFO,
  batch/capacity rules, route optimization). This is the heart of the system.
- `src/store/` — reducer + context; every mutation flows through here and is audited;
  state persists to `localStorage`.
- `src/data/seed.ts` — deterministic seeded warehouse.
- `src/screens/` — one file per screen; `src/components/` — shared UI (Scanner, etc.).

Design notes live in `docs/superpowers/specs/` and the implementation plan in
`docs/superpowers/plans/`.
