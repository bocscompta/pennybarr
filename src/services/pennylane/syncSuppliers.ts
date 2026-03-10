// Sync Pennylane suppliers -> third_parties (type=supplier)

import { supabase, COMPANY_ID } from '../../lib/supabase'
import { listAllSuppliers } from '../pennylaneApiService'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

export async function syncSuppliers(
  onProgress: EntityProgressCallback,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('suppliers')
  progress.status = 'running'
  onProgress(progress)

  try {
    const suppliers = await listAllSuppliers()
    progress.total = suppliers.length
    onProgress({ ...progress })

    // Fetch existing by pennylane_id
    const { data: existing, error: fetchError } = await supabase
      .from('third_parties')
      .select('id, name, pennylane_id')
      .eq('company_id', COMPANY_ID)
      .eq('type', 'supplier')

    if (fetchError) {
      throw new Error(`Erreur chargement fournisseurs existants: ${fetchError.message}`)
    }

    const existingByPlId = new Map<number, string>()
    const existingByName = new Map<string, string>()
    for (const tp of existing || []) {
      if (tp.pennylane_id) existingByPlId.set(tp.pennylane_id, tp.id)
      existingByName.set(tp.name.trim().toUpperCase(), tp.id)
    }

    for (const supplier of suppliers) {
      if (abortSignal?.aborted) break

      const normalizedName = supplier.name.trim().toUpperCase()
      const existingId = existingByPlId.get(supplier.id) || existingByName.get(normalizedName)

      if (existingId) {
        // Update with pennylane_id and fresh data
        const { error } = await supabase
          .from('third_parties')
          .update({
            pennylane_id: supplier.id,
            email: supplier.emails?.[0] || null,
            address: supplier.address || null,
            postal_code: supplier.postal_code || null,
            city: supplier.city || null,
            country: supplier.country_alpha2 || 'FR',
          })
          .eq('id', existingId)

        if (error) {
          progress.errors.push(`Fournisseur ${supplier.name}: ${error.message}`)
        } else {
          progress.updated++
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('third_parties')
          .insert({
            company_id: COMPANY_ID,
            type: 'supplier',
            name: normalizedName,
            pennylane_id: supplier.id,
            email: supplier.emails?.[0] || null,
            address: supplier.address || null,
            postal_code: supplier.postal_code || null,
            city: supplier.city || null,
            country: supplier.country_alpha2 || 'FR',
            payment_terms: 30,
          })

        if (error) {
          progress.errors.push(`Fournisseur ${supplier.name}: ${error.message}`)
        } else {
          progress.created++
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
