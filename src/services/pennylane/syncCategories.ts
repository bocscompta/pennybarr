// Sync Pennylane categories -> pennylane_categories table

import { supabase, COMPANY_ID } from '../../lib/supabase'
import { listAllCategories, listAllCategoryGroups } from '../pennylaneApiService'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

export async function syncCategories(
  onProgress: EntityProgressCallback,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('categories')
  progress.status = 'running'
  onProgress(progress)

  try {
    // Fetch groups first for label lookup
    const groups = await listAllCategoryGroups()
    const groupMap = new Map<number, string>()
    for (const g of groups) {
      groupMap.set(g.id, g.label)
    }

    // Fetch categories
    const categories = await listAllCategories()
    progress.total = categories.length
    onProgress({ ...progress })

    // Fetch existing
    const { data: existing, error: fetchError } = await supabase
      .from('pennylane_categories')
      .select('pennylane_id')
      .eq('company_id', COMPANY_ID)

    if (fetchError) {
      throw new Error(`Erreur chargement catégories existantes: ${fetchError.message}`)
    }

    const existingIds = new Set((existing || []).map(e => e.pennylane_id))

    for (const cat of categories) {
      if (abortSignal?.aborted) break

      if (existingIds.has(cat.id)) {
        // Update
        const { error } = await supabase
          .from('pennylane_categories')
          .update({
            name: cat.label,
            group_name: cat.group_id ? groupMap.get(cat.group_id) || null : null,
            group_pennylane_id: cat.group_id || null,
          })
          .eq('company_id', COMPANY_ID)
          .eq('pennylane_id', cat.id)

        if (error) {
          progress.errors.push(`Catégorie ${cat.label}: ${error.message}`)
        } else {
          progress.updated++
        }
      } else {
        // Insert
        const { error } = await supabase
          .from('pennylane_categories')
          .insert({
            company_id: COMPANY_ID,
            pennylane_id: cat.id,
            name: cat.label,
            group_name: cat.group_id ? groupMap.get(cat.group_id) || null : null,
            group_pennylane_id: cat.group_id || null,
          })

        if (error) {
          progress.errors.push(`Catégorie ${cat.label}: ${error.message}`)
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
