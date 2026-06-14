# Warehouse Management System — Design Spec

**Date:** 2026-06-13
**Status:** Approved

## Problem

A warehouse runs four physical workflows — staging, live loading, loading, and
unloading — entirely on paper. With no scan verification, workers grab the wrong
pallet, load the wrong staging area into the wrong dock door, and unload trucks
into untracked bays. Each shipping error costs ~$2,000; mixed/expired inventory
has thrown away ~$20,000 of product. There is no audit trail and no live bay
capacity tracking.

## Goals

1. Reduce shipping errors via scan verification (reject wrong pallet/door).
2. Increase inventory accuracy (counts update immediately on every move).
3. Reduce travel time via route-optimized pick tickets.
4. Improve FIFO compliance (oldest batch picked first).
5. Track bay capacity live (`0/72 … 72/72`).
6. Track which staging areas are available.

## Decisions (locked with user)

- **Platform:** Desktop-focused web app — React + Vite + TypeScript.
- **Persistence:** Self-contained. All logic + data run client-side, seeded with
  realistic warehouse data, persisted to `localStorage`. No backend.
- **Scanning:** Click-to-scan a pallet/location from a list, **or** type/paste its
  barcode. Both trigger the same verification logic.
- **Scope:** Full spec — all 7 roles and all screens.
- **UI:** Clean white background, subtle gray borders, one blue accent; green =
  scan accepted, red = rejected.

## Domain Model

- **Product** — name, SKU, shelf-life days.
- **Batch** — batch number, product, received date, expiration date.
- **Pallet** — barcode id, batch, case count, size (S/M/L for fork leveling),
  status (`stored | picked | staged | loaded`), current location id.
- **Location** (three kinds):
  - **Bay** — aisle + bay number, capacity, the single batch it holds (no mixing).
  - **StagingArea** — capacity, available flag.
  - **DockDoor** — number, currently assigned order.
- **Order** — order number, assigned dock door, line items (product + qty).
- **PickTicket** — derived from an order: ordered list of pick locations.
- **User** — username, password, role.
- **AuditLogEntry** — timestamp, user, action, item, from → to.

## Rules Engine (pure, unit-tested)

- A pallet exists in exactly one location at a time.
- A pallet cannot be loaded if it has not been picked.
- A pallet cannot be unloaded into a full bay.
- Different batches cannot be mixed in the same bay; if full, assign a new bay.
- FIFO is preferred whenever possible (suggest oldest batch first).
- Scan verification: a pallet not on the pick ticket / not assigned to the scanned
  door / not matching the bay's batch is **rejected**; the operator cannot advance.
- Counts update immediately after every move.
- Route optimization: order pick locations by travel order, grouped so heavier/
  larger pallets are sequenced for fork leveling, FIFO-aware.

## Roles & Permissions

| Role | Capabilities |
|------|--------------|
| Manager | Manage users, system settings, permissions (all access) |
| Supervisor | View all inventory, approve adjustments, view reports, manage bays |
| Inventory Manager | Same as supervisor |
| Shipping Clerk | Create orders, assign dock doors, generate pick tickets |
| Forklift Operator | View pick tickets, scan pallets, move inventory, load/unload |
| Inbound Scheduler | View inbound orders & dashboard |
| Outbound Scheduler | View outbound orders & dashboard |

## Screens (role-gated navigation)

1. **Login** — username, password, login button.
2. **Dashboard** — active orders, inventory/capacity alerts, expired-product warnings.
3. **Pick Ticket** — order number, route-optimized pick locations, click/type scan
   verification, `n/total` progress counter.
4. **Inventory** — search, view bay contents, move inventory, bay-combine helper,
   capacity bars, staging-area availability.
5. **Loading** — scan door, scan each pallet `0/24 … 24/24`, reject wrong-door pallets.
6. **Unloading** — scan bay, scan each pallet `0/72 … `, enforce single-batch-per-bay.
7. **Reports** — inventory accuracy, error reports, productivity.
8. **Audit Log** — full move history.

## Architecture

- `src/types.ts` — domain types.
- `src/data/seed.ts` — seeded warehouse (aisles/bays, products, batches, pallets,
  staging areas, dock doors, orders, users).
- `src/rules/` — pure functions + vitest tests. The heart of the system.
- `src/store/` — React context + reducer; dispatches go through the rules engine;
  state persisted to `localStorage`.
- `src/components/` — Layout, Nav, Scanner, ProgressBar, etc.
- `src/screens/` — one file per screen above.

## Build Approach

TDD the rules engine first (scan verification, batch, FIFO, capacity, route
optimization), then build screens on top. Commit incrementally; push to
`github.com/masonking1115/WMS`.
