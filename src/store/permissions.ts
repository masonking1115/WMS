import type { Role } from '../types'

// Which screens each role may open. Drives both the nav menu and route guards.
export type ScreenKey =
  | 'dashboard'
  | 'pick'
  | 'inventory'
  | 'loading'
  | 'unloading'
  | 'orders'
  | 'reports'
  | 'audit'
  | 'users'

export const SCREEN_LABELS: Record<ScreenKey, string> = {
  dashboard: 'Dashboard',
  pick: 'Pick Ticket',
  inventory: 'Inventory',
  loading: 'Loading',
  unloading: 'Unloading',
  orders: 'Orders',
  reports: 'Reports',
  audit: 'Audit Log',
  users: 'Users',
}

const ALL: ScreenKey[] = [
  'dashboard',
  'pick',
  'inventory',
  'loading',
  'unloading',
  'orders',
  'reports',
  'audit',
  'users',
]

// Permissions per the spec's "User Types: Permissions" section.
const PERMISSIONS: Record<Role, ScreenKey[]> = {
  manager: ALL,
  supervisor: ['dashboard', 'inventory', 'orders', 'reports', 'audit'],
  inventory_manager: ['dashboard', 'inventory', 'orders', 'reports', 'audit'],
  shipping_clerk: ['dashboard', 'orders', 'pick', 'inventory'],
  forklift_operator: ['dashboard', 'pick', 'inventory', 'loading', 'unloading'],
  inbound_scheduler: ['dashboard', 'orders', 'inventory'],
  outbound_scheduler: ['dashboard', 'orders', 'inventory'],
}

export function screensFor(role: Role): ScreenKey[] {
  return PERMISSIONS[role]
}

export function canAccess(role: Role, screen: ScreenKey): boolean {
  return PERMISSIONS[role].includes(screen)
}

export const ROLE_LABELS: Record<Role, string> = {
  manager: 'Manager',
  supervisor: 'Supervisor',
  inventory_manager: 'Inventory Manager',
  shipping_clerk: 'Shipping Clerk',
  forklift_operator: 'Forklift Operator',
  inbound_scheduler: 'Inbound Scheduler',
  outbound_scheduler: 'Outbound Scheduler',
}
