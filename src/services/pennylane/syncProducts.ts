// Sync Pennylane products -> products table

import { supabase, COMPANY_ID } from '../../lib/supabase'
import { listAllProducts } from '../pennylaneApiService'
import { parseAmount } from './syncHelpers'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

export async function syncProducts(
  onProgress: EntityProgressCallback,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('products')
  progress.status = 'running'
  onProgress(progress)

  try {
    const products = await listAllProducts()
    progress.total = products.length
    onProgress({ ...progress })

    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('id, pennylane_id, code')
      .eq('company_id', COMPANY_ID)

    if (fetchError) {
      throw new Error(`Erreur chargement produits existants: ${fetchError.message}`)
    }

    const existingByPlId = new Map<number, string>()
    const existingByCode = new Map<string, string>()
    for (const p of existing || []) {
      if (p.pennylane_id) existingByPlId.set(p.pennylane_id, p.id)
      existingByCode.set(p.code, p.id)
    }

    for (const product of products) {
      if (abortSignal?.aborted) break

      const code = `PL-${product.id}`
      const existingId = existingByPlId.get(product.id) || existingByCode.get(code)
      const price = parseAmount(product.price)

      if (existingId) {
        const { error } = await supabase
          .from('products')
          .update({
            name: product.label,
            description: product.description || null,
            type: product.substance === 'service' ? 'service' : 'product',
            sale_price_ht: price,
            vat_rate: product.vat_rate || '20',
            unit: product.unit || 'unite',
            pennylane_id: product.id,
          })
          .eq('id', existingId)

        if (error) {
          progress.errors.push(`Produit ${product.label}: ${error.message}`)
        } else {
          progress.updated++
        }
      } else {
        const { error } = await supabase
          .from('products')
          .insert({
            company_id: COMPANY_ID,
            code,
            name: product.label,
            description: product.description || null,
            type: product.substance === 'service' ? 'service' : 'product',
            sale_price_ht: price,
            vat_rate: product.vat_rate || '20',
            unit: product.unit || 'unite',
            pennylane_id: product.id,
          })

        if (error) {
          progress.errors.push(`Produit ${product.label}: ${error.message}`)
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
