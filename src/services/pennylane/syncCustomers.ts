// Sync Pennylane customers -> third_parties (type=customer)

import { supabase, COMPANY_ID } from '../../lib/supabase'
import { listAllCustomers } from '../pennylaneApiService'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

export async function syncCustomers(
  onProgress: EntityProgressCallback,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('customers')
  progress.status = 'running'
  onProgress(progress)

  try {
    const customers = await listAllCustomers()
    progress.total = customers.length
    onProgress({ ...progress })

    const { data: existing, error: fetchError } = await supabase
      .from('third_parties')
      .select('id, name, pennylane_id')
      .eq('company_id', COMPANY_ID)
      .in('type', ['customer', 'both'])

    if (fetchError) {
      throw new Error(`Erreur chargement clients existants: ${fetchError.message}`)
    }

    const existingByPlId = new Map<number, string>()
    const existingByName = new Map<string, string>()
    for (const tp of existing || []) {
      if (tp.pennylane_id) existingByPlId.set(tp.pennylane_id, tp.id)
      existingByName.set(tp.name.trim().toUpperCase(), tp.id)
    }

    for (const customer of customers) {
      if (abortSignal?.aborted) break

      const normalizedName = customer.name.trim().toUpperCase()
      const existingId = existingByPlId.get(customer.id) || existingByName.get(normalizedName)

      if (existingId) {
        // Pennylane uses reg_no for SIREN and billing_address for address fields
        const { error } = await supabase
          .from('third_parties')
          .update({
            pennylane_id: customer.id,
            email: customer.emails?.[0] || null,
            phone: customer.phone || null,
            address: customer.billing_address?.address || null,
            postal_code: customer.billing_address?.postal_code || null,
            city: customer.billing_address?.city || null,
            country: customer.billing_address?.country_alpha2 || 'FR',
            siren: customer.reg_no || null,
            vat_number: customer.vat_number || null,
          })
          .eq('id', existingId)

        if (error) {
          progress.errors.push(`Client ${customer.name}: ${error.message}`)
        } else {
          progress.updated++
        }
      } else {
        // Pennylane uses reg_no for SIREN and billing_address for address fields
        const { error } = await supabase
          .from('third_parties')
          .insert({
            company_id: COMPANY_ID,
            type: 'customer',
            name: normalizedName,
            pennylane_id: customer.id,
            email: customer.emails?.[0] || null,
            phone: customer.phone || null,
            address: customer.billing_address?.address || null,
            postal_code: customer.billing_address?.postal_code || null,
            city: customer.billing_address?.city || null,
            country: customer.billing_address?.country_alpha2 || 'FR',
            siren: customer.reg_no || null,
            vat_number: customer.vat_number || null,
            payment_terms: 30,
          })

        if (error) {
          progress.errors.push(`Client ${customer.name}: ${error.message}`)
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
