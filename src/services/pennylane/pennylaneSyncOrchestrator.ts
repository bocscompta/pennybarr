// Pennylane Full Sync Orchestrator
// Runs all sync entities in dependency order

import type {
  FullSyncProgress,
  FullProgressCallback,
  SyncEntityType,
  EntitySyncProgress,
} from './syncTypes'
import { createFullSyncProgress, ENTITY_LABELS } from './syncTypes'
import { logMessage } from './syncHelpers'
import { syncCategories } from './syncCategories'
import { syncSuppliers } from './syncSuppliers'
import { syncCustomers } from './syncCustomers'
import { syncProducts } from './syncProducts'
import { syncSupplierInvoices } from './syncSupplierInvoices'
import { syncCustomerInvoices } from './syncCustomerInvoices'
import { syncQuotes } from './syncQuotes'
import { syncReconciliation } from './syncReconciliation'

export interface SyncOptions {
  dateFrom?: string
  entities?: SyncEntityType[]
}

// Ordered list of all sync entities with their runner functions
const SYNC_PIPELINE: {
  entity: SyncEntityType
  run: (
    onProgress: (p: EntitySyncProgress) => void,
    dateFrom?: string,
    abortSignal?: AbortSignal
  ) => Promise<EntitySyncProgress>
}[] = [
  { entity: 'categories', run: (p, _d, a) => syncCategories(p, a) },
  { entity: 'suppliers', run: (p, _d, a) => syncSuppliers(p, a) },
  { entity: 'customers', run: (p, _d, a) => syncCustomers(p, a) },
  { entity: 'products', run: (p, _d, a) => syncProducts(p, a) },
  { entity: 'supplier_invoices', run: (p, d, a) => syncSupplierInvoices(p, d, a) },
  { entity: 'customer_invoices', run: (p, d, a) => syncCustomerInvoices(p, d, a) },
  { entity: 'quotes', run: (p, _d, a) => syncQuotes(p, a) },
  // Documents: PDFs are downloaded inline during syncSupplierInvoices/syncCustomerInvoices
  // via public_file_url. Pennylane V2 API has no /file endpoint for re-download.
  { entity: 'reconciliation', run: (p, _d, a) => syncReconciliation(p, a) },
]

export async function runFullPennylaneSync(
  onProgress: FullProgressCallback,
  options: SyncOptions = {},
  abortSignal?: AbortSignal
): Promise<FullSyncProgress> {
  const fullProgress = createFullSyncProgress()
  fullProgress.status = 'running'

  const log = (msg: string) => {
    fullProgress.logs.push(logMessage(msg))
    onProgress({ ...fullProgress })
  }

  log('Démarrage de la synchronisation complète Pennylane...')

  // Filter pipeline if specific entities requested
  const pipeline = options.entities
    ? SYNC_PIPELINE.filter(s => options.entities!.includes(s.entity))
    : SYNC_PIPELINE

  for (const step of pipeline) {
    if (abortSignal?.aborted) {
      log('Synchronisation annulée par l\'utilisateur')
      break
    }

    fullProgress.currentEntity = step.entity
    log(`Synchronisation: ${ENTITY_LABELS[step.entity]}...`)
    onProgress({ ...fullProgress })

    try {
      const entityResult = await step.run(
        (entityProgress) => {
          fullProgress.entities[step.entity] = { ...entityProgress }
          onProgress({ ...fullProgress })
        },
        options.dateFrom,
        abortSignal
      )

      fullProgress.entities[step.entity] = entityResult

      const { created, updated, skipped, errors } = entityResult
      log(
        `${ENTITY_LABELS[step.entity]}: ${created} créés, ${updated} mis à jour, ${skipped} ignorés` +
        (errors.length > 0 ? `, ${errors.length} erreurs` : '')
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      fullProgress.entities[step.entity].status = 'error'
      fullProgress.entities[step.entity].errors.push(msg)
      log(`ERREUR ${ENTITY_LABELS[step.entity]}: ${msg}`)
      // Continue with next entity
    }
  }

  fullProgress.status = abortSignal?.aborted ? 'idle' : 'done'
  fullProgress.currentEntity = null
  log('Synchronisation terminée.')
  onProgress({ ...fullProgress })

  return fullProgress
}

// Re-export for backward compatibility
export type { FullSyncProgress, SyncEntityType }
