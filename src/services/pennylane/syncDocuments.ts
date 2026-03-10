// Sync missing documents from Pennylane for all entities

import { supabase, COMPANY_ID } from '../../lib/supabase'
import { downloadAndStoreDocument } from '../pennylaneApiService'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

interface MissingDoc {
  id: string
  pennylane_id: number
  table: 'invoices' | 'devis'
  entityType: string
}

export async function syncDocuments(
  onProgress: EntityProgressCallback,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('documents')
  progress.status = 'running'
  onProgress(progress)

  try {
    // Find invoices and devis with pennylane_id but no pdf_url
    const [invoicesResult, devisResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, pennylane_id, type')
        .eq('company_id', COMPANY_ID)
        .not('pennylane_id', 'is', null)
        .is('pdf_url', null),
      supabase
        .from('devis')
        .select('id, pennylane_id')
        .eq('company_id', COMPANY_ID)
        .not('pennylane_id', 'is', null)
        .is('pdf_url', null),
    ])

    if (invoicesResult.error) {
      throw new Error(`Erreur chargement factures sans document: ${invoicesResult.error.message}`)
    }
    if (devisResult.error) {
      throw new Error(`Erreur chargement devis sans document: ${devisResult.error.message}`)
    }

    const missing: MissingDoc[] = []
    for (const inv of invoicesResult.data || []) {
      if (inv.pennylane_id) {
        missing.push({
          id: inv.id,
          pennylane_id: inv.pennylane_id,
          table: 'invoices',
          entityType: inv.type || 'supplier',
        })
      }
    }
    for (const d of devisResult.data || []) {
      if (d.pennylane_id) {
        missing.push({
          id: d.id,
          pennylane_id: d.pennylane_id,
          table: 'devis',
          entityType: 'quotes',
        })
      }
    }

    progress.total = missing.length
    onProgress({ ...progress })

    for (const doc of missing) {
      if (abortSignal?.aborted) break

      try {
        // Build the correct Pennylane file endpoint based on entity type
        let pennylaneUrl: string
        if (doc.table === 'devis') {
          pennylaneUrl = `/quotes/${doc.pennylane_id}/file`
        } else if (doc.entityType === 'customer') {
          pennylaneUrl = `/customer_invoices/${doc.pennylane_id}/file`
        } else {
          pennylaneUrl = `/supplier_invoices/${doc.pennylane_id}/file`
        }

        const storagePath = `${COMPANY_ID}/pennylane/${doc.entityType}/${doc.pennylane_id}.pdf`
        const publicUrl = await downloadAndStoreDocument(pennylaneUrl, storagePath)

        const { error: updateError } = await supabase
          .from(doc.table)
          .update({ pdf_url: publicUrl })
          .eq('id', doc.id)

        if (updateError) {
          progress.errors.push(`Doc ${doc.pennylane_id}: ${updateError.message}`)
        } else {
          progress.created++
        }
      } catch (err) {
        // Document may not exist on Pennylane - log and continue
        const msg = err instanceof Error ? err.message : 'Erreur'
        if (!msg.includes('404')) {
          progress.errors.push(`Doc ${doc.pennylane_id}: ${msg}`)
        } else {
          progress.skipped++
        }
      }

      onProgress({ ...progress })
    }

    progress.status = 'done'
  } catch (err) {
    progress.status = 'error'
    progress.errors.push(err instanceof Error ? err.message : 'Erreur inconnue')
  }

  onProgress({ ...progress })
  return progress
}
