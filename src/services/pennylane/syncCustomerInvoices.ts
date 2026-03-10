// Sync Pennylane customer invoices -> invoices (type=customer)

import { supabase, COMPANY_ID } from '../../lib/supabase'
import {
  listAllCustomerInvoices,
  downloadAndStoreDocument,
  type PennylaneCustomerInvoice,
} from '../pennylaneApiService'
import { findOrCreateThirdParty } from '../invoiceService'
import { parseAmount, extractSupplierFromLabel, cleanThirdPartyName } from './syncHelpers'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

export async function syncCustomerInvoices(
  onProgress: EntityProgressCallback,
  dateFrom?: string,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('customer_invoices')
  progress.status = 'running'
  onProgress(progress)

  try {
    const plInvoices = await listAllCustomerInvoices(undefined, dateFrom)
    progress.total = plInvoices.length
    onProgress({ ...progress })

    // Fetch existing
    const { data: existingData, error: fetchError } = await supabase
      .from('invoices')
      .select('id, number, pennylane_id')
      .eq('company_id', COMPANY_ID)
      .eq('type', 'customer')

    if (fetchError) {
      throw new Error(`Erreur chargement factures clients existantes: ${fetchError.message}`)
    }

    const existingByPlId = new Set((existingData || []).filter(i => i.pennylane_id).map(i => i.pennylane_id))
    const existingByNumber = new Map((existingData || []).map(i => [i.number.trim().toUpperCase(), i.id]))

    for (const plInv of plInvoices) {
      if (abortSignal?.aborted) break

      const plNumber = (plInv.invoice_number || '').trim()

      if (existingByPlId.has(plInv.id)) {
        progress.skipped++
        onProgress({ ...progress })
        continue
      }
      if (plNumber && existingByNumber.has(plNumber.toUpperCase())) {
        const existId = existingByNumber.get(plNumber.toUpperCase())!
        await supabase.from('invoices').update({ pennylane_id: plInv.id }).eq('id', existId)
        progress.skipped++
        onProgress({ ...progress })
        continue
      }

      try {
        await createCustomerInvoiceFromPennylane(plInv)
        progress.created++
      } catch (err) {
        progress.errors.push(`Facture client PL#${plInv.id}: ${err instanceof Error ? err.message : 'Erreur'}`)
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

async function createCustomerInvoiceFromPennylane(plInv: PennylaneCustomerInvoice): Promise<void> {
  // Skip empty/ghost invoices first (Pennylane sometimes returns invoices with 0€ and no data)
  const totalTTC = parseAmount(plInv.currency_amount)
  const totalHT = parseAmount(plInv.currency_amount_before_tax)
  const totalVAT = parseAmount(plInv.currency_tax)

  if (totalTTC === 0) return

  // Priority: customer entity name (cleaned) > extracted from label
  const customerName = plInv.customer?.name
    ? cleanThirdPartyName(plInv.customer.name)
    : extractSupplierFromLabel(plInv.label)

  if (!customerName) {
    throw new Error(`Impossible de déterminer le client pour la facture PL#${plInv.id} (label: ${plInv.label})`)
  }

  const thirdParty = await findOrCreateThirdParty(customerName, 'customer')
  const invoiceDate = plInv.date && plInv.date.trim() ? plInv.date.trim() : new Date().toISOString().split('T')[0]
  const invoiceNumber = (plInv.invoice_number || `PLC-${plInv.id}`).trim()
  const pdfUrl = plInv.public_file_url || null
  const isPaid = plInv.paid || plInv.status === 'paid'

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .upsert({
      company_id: COMPANY_ID,
      third_party_id: thirdParty.id,
      type: 'customer',
      number: invoiceNumber,
      date: invoiceDate,
      due_date: plInv.due_date || null,
      status: isPaid ? 'paid' : 'sent',
      total_ht: totalHT,
      total_vat: totalVAT,
      total_ttc: totalTTC,
      currency: plInv.currency || 'EUR',
      pdf_url: null,
      pennylane_id: plInv.id,
    }, { onConflict: 'company_id,type,number' })
    .select('id')
    .single()

  if (invoiceError) {
    throw new Error(`[${invoiceError.code}] ${invoiceError.message}`)
  }

  // Download document (non-blocking: invoice is created even if download fails)
  if (pdfUrl && invoice) {
    try {
      const ext = plInv.filename?.split('.').pop()?.toLowerCase() || 'pdf'
      const storagePath = `${COMPANY_ID}/pennylane/customer/${plInv.id}.${ext}`
      const supabaseUrl = await downloadAndStoreDocument(pdfUrl, storagePath)

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ pdf_url: supabaseUrl })
        .eq('id', invoice.id)

      if (updateError) {
        console.error(`[Sync] pdf_url update failed for invoice ${invoice.id}:`, updateError.message)
      }
    } catch (dlErr) {
      console.error(`[Sync] Document download failed for PL#${plInv.id}:`, dlErr instanceof Error ? dlErr.message : dlErr)
    }
  }
}
