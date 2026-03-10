// Shared types for Pennylane sync modules

export type SyncEntityType =
  | 'categories'
  | 'suppliers'
  | 'customers'
  | 'products'
  | 'supplier_invoices'
  | 'customer_invoices'
  | 'quotes'
  | 'reconciliation'

export interface EntitySyncProgress {
  entity: SyncEntityType
  status: 'pending' | 'running' | 'done' | 'error'
  total: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export interface FullSyncProgress {
  status: 'idle' | 'running' | 'done' | 'error'
  entities: Record<SyncEntityType, EntitySyncProgress>
  logs: string[]
  currentEntity: SyncEntityType | null
}

export type EntityProgressCallback = (progress: EntitySyncProgress) => void
export type FullProgressCallback = (progress: FullSyncProgress) => void

export function createEntityProgress(entity: SyncEntityType): EntitySyncProgress {
  return {
    entity,
    status: 'pending',
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }
}

export function createFullSyncProgress(): FullSyncProgress {
  const entities: Partial<Record<SyncEntityType, EntitySyncProgress>> = {}
  const allTypes: SyncEntityType[] = [
    'categories', 'suppliers', 'customers', 'products',
    'supplier_invoices', 'customer_invoices', 'quotes',
    'reconciliation',
  ]
  for (const t of allTypes) {
    entities[t] = createEntityProgress(t)
  }
  return {
    status: 'idle',
    entities: entities as Record<SyncEntityType, EntitySyncProgress>,
    logs: [],
    currentEntity: null,
  }
}

export const ENTITY_LABELS: Record<SyncEntityType, string> = {
  categories: 'Catégories analytiques',
  suppliers: 'Fournisseurs',
  customers: 'Clients',
  products: 'Produits',
  supplier_invoices: 'Factures fournisseurs',
  customer_invoices: 'Factures clients',
  quotes: 'Devis',
  reconciliation: 'Rapprochement',
}
