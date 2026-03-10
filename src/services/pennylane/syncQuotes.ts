// Sync Pennylane quotes -> devis + devis_lines

import { supabase, COMPANY_ID } from '../../lib/supabase'
import {
  listAllQuotes,
  downloadAndStoreDocument,
  type PennylaneQuote,
} from '../pennylaneApiService'
import { parseAmount } from './syncHelpers'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

export async function syncQuotes(
  onProgress: EntityProgressCallback,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('quotes')
  progress.status = 'running'
  onProgress(progress)

  try {
    const plQuotes = await listAllQuotes()
    progress.total = plQuotes.length
    onProgress({ ...progress })

    // Fetch existing devis
    const { data: existingData, error: fetchError } = await supabase
      .from('devis')
      .select('id, number, pennylane_id')
      .eq('company_id', COMPANY_ID)

    if (fetchError) {
      throw new Error(`Erreur chargement devis existants: ${fetchError.message}`)
    }

    const existingByPlId = new Set((existingData || []).filter(d => d.pennylane_id).map(d => d.pennylane_id))
    const existingByNumber = new Map((existingData || []).map(d => [d.number.trim().toUpperCase(), d.id]))

    // Fetch customer third_parties for lookup
    const { data: customers } = await supabase
      .from('third_parties')
      .select('id, pennylane_id, name')
      .eq('company_id', COMPANY_ID)
      .in('type', ['customer', 'both'])

    const customerByPlId = new Map<number, string>()
    const customerByName = new Map<string, string>()
    for (const c of customers || []) {
      if (c.pennylane_id) customerByPlId.set(c.pennylane_id, c.id)
      customerByName.set(c.name.trim().toUpperCase(), c.id)
    }

    // Fetch products for line item lookup
    const { data: products } = await supabase
      .from('products')
      .select('id, pennylane_id')
      .eq('company_id', COMPANY_ID)

    const productByPlId = new Map<number, string>()
    for (const p of products || []) {
      if (p.pennylane_id) productByPlId.set(p.pennylane_id, p.id)
    }

    for (const plQuote of plQuotes) {
      if (abortSignal?.aborted) break

      const plNumber = (plQuote.quote_number || '').trim()

      if (existingByPlId.has(plQuote.id)) {
        progress.skipped++
        onProgress({ ...progress })
        continue
      }
      if (plNumber && existingByNumber.has(plNumber.toUpperCase())) {
        const existId = existingByNumber.get(plNumber.toUpperCase())!
        await supabase.from('devis').update({ pennylane_id: plQuote.id }).eq('id', existId)
        progress.skipped++
        onProgress({ ...progress })
        continue
      }

      try {
        await createDevisFromPennylane(plQuote, customerByPlId, customerByName, productByPlId)
        progress.created++
      } catch (err) {
        progress.errors.push(`Devis PL#${plQuote.id}: ${err instanceof Error ? err.message : 'Erreur'}`)
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

async function createDevisFromPennylane(
  plQuote: PennylaneQuote,
  customerByPlId: Map<number, string>,
  customerByName: Map<string, string>,
  productByPlId: Map<number, string>
): Promise<void> {
  const totalTTC = parseAmount(plQuote.currency_amount)
  const totalHT = parseAmount(plQuote.currency_amount_before_tax)
  const totalVAT = parseAmount(plQuote.currency_tax)

  // Find customer
  let customerId: string | null = null
  if (plQuote.customer?.id) {
    customerId = customerByPlId.get(plQuote.customer.id) || null
  }
  if (!customerId && plQuote.customer?.name) {
    customerId = customerByName.get(plQuote.customer.name.trim().toUpperCase()) || null
  }

  const quoteNumber = (plQuote.quote_number || `PLQ-${plQuote.id}`).trim()
  const quoteDate = plQuote.date && plQuote.date.trim() ? plQuote.date.trim() : new Date().toISOString().split('T')[0]

  // Map Pennylane status
  let status: 'draft' | 'sent' | 'accepted' | 'refused' | 'expired' | 'invoiced' = 'draft'
  const plStatus = (plQuote.status || '').toLowerCase()
  if (plStatus === 'accepted' || plStatus === 'signed') status = 'accepted'
  else if (plStatus === 'sent' || plStatus === 'pending') status = 'sent'
  else if (plStatus === 'refused' || plStatus === 'rejected') status = 'refused'
  else if (plStatus === 'expired') status = 'expired'
  else if (plStatus === 'invoiced') status = 'invoiced'

  const { data: devis, error: devisError } = await supabase
    .from('devis')
    .insert({
      company_id: COMPANY_ID,
      customer_id: customerId,
      number: quoteNumber,
      date: quoteDate,
      validity_date: plQuote.deadline || null,
      status,
      total_ht: totalHT,
      total_vat: totalVAT,
      total_ttc: totalTTC,
      currency: plQuote.currency || 'EUR',
      pdf_url: null,
      pennylane_id: plQuote.id,
    })
    .select('id')
    .single()

  if (devisError) {
    throw new Error(`[${devisError.code}] ${devisError.message}`)
  }

  // Create line items
  if (plQuote.line_items && plQuote.line_items.length > 0 && devis) {
    const lines = plQuote.line_items.map((li, idx) => ({
      devis_id: devis.id,
      product_id: li.product?.id ? productByPlId.get(li.product.id) || null : null,
      description: li.label || 'Ligne sans description',
      quantity: parseAmount(li.quantity) || 1,
      unit: li.unit || 'unite',
      unit_price_ht: parseAmount(li.currency_price_before_tax),
      vat_rate: li.vat_rate || '20',
      total_ht: parseAmount(li.currency_price_before_tax) * (parseAmount(li.quantity) || 1),
      total_vat: parseAmount(li.currency_tax),
      total_ttc: parseAmount(li.currency_amount),
      sort_order: idx,
    }))

    const { error: linesError } = await supabase
      .from('devis_lines')
      .insert(lines)

    if (linesError) {
      console.error(`[Sync] Devis lines insert failed for ${quoteNumber}:`, linesError)
    }
  }

  // Download PDF
  const pdfUrl = plQuote.public_file_url || null
  if (pdfUrl && devis) {
    const ext = plQuote.filename?.split('.').pop()?.toLowerCase() || 'pdf'
    const storagePath = `${COMPANY_ID}/pennylane/quotes/${plQuote.id}.${ext}`
    const supabaseUrl = await downloadAndStoreDocument(pdfUrl, storagePath)

    await supabase.from('devis').update({ pdf_url: supabaseUrl }).eq('id', devis.id)
  }
}
