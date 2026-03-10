// Auto-reconciliation: use Pennylane's matched_transactions to link invoices with bank transactions
// Instead of our own matching algorithm, we trust Pennylane's reconciliation data

import { supabase, COMPANY_ID } from '../../lib/supabase'
import { getInvoiceMatchedTransactions } from '../pennylaneApiService'
import { amountsMatch, datesWithinDays } from './syncHelpers'
import type { EntitySyncProgress, EntityProgressCallback } from './syncTypes'
import { createEntityProgress } from './syncTypes'

interface InvoiceWithPennylane {
  id: string
  number: string
  total_ttc: number
  date: string
  type: string
  pennylane_id: number
}

interface BankTransaction {
  id: string
  date: string
  label: string
  amount: number
}

export async function syncReconciliation(
  onProgress: EntityProgressCallback,
  abortSignal?: AbortSignal
): Promise<EntitySyncProgress> {
  const progress = createEntityProgress('reconciliation')
  progress.status = 'running'
  onProgress(progress)

  try {
    // Fetch all invoices with pennylane_id that are NOT yet linked to a bank transaction
    const { data: invData, error: invError } = await supabase
      .from('invoices')
      .select('id, number, total_ttc, date, type, pennylane_id')
      .eq('company_id', COMPANY_ID)
      .not('pennylane_id', 'is', null)

    if (invError) {
      throw new Error(`Erreur chargement factures: ${invError.message}`)
    }

    // Filter to only invoices not already linked
    const invoiceIds = (invData || []).map(i => i.id)
    const { data: linkedTx } = await supabase
      .from('bank_transactions')
      .select('linked_invoice_id')
      .in('linked_invoice_id', invoiceIds.length > 0 ? invoiceIds : ['none'])

    const alreadyLinkedIds = new Set((linkedTx || []).map(t => t.linked_invoice_id))
    const invoices = (invData || [])
      .filter(i => !alreadyLinkedIds.has(i.id) && i.pennylane_id)
      .map(i => ({
        id: i.id,
        number: i.number,
        total_ttc: i.total_ttc,
        date: i.date,
        type: i.type,
        pennylane_id: i.pennylane_id as number,
      })) as InvoiceWithPennylane[]

    progress.total = invoices.length
    onProgress({ ...progress })

    // Fetch all unreconciled bank transactions
    const { data: txData, error: txError } = await supabase
      .from('bank_transactions')
      .select('id, date, label, amount')
      .eq('company_id', COMPANY_ID)
      .eq('is_reconciled', false)
      .is('linked_invoice_id', null)

    if (txError) {
      throw new Error(`Erreur chargement transactions: ${txError.message}`)
    }

    const transactions = (txData || []) as BankTransaction[]
    const matchedTxIds = new Set<string>()

    let debugCount = 0
    for (const inv of invoices) {
      if (abortSignal?.aborted) break

      try {
        // Ask Pennylane which transactions are matched to this invoice
        const plMatched = await getInvoiceMatchedTransactions(
          inv.pennylane_id,
          inv.type === 'customer' ? 'customer' : 'supplier'
        )

        // Debug: log first 5 API responses
        if (debugCount < 5) {
          console.log(`[Reconciliation] Invoice ${inv.number} (PL#${inv.pennylane_id}): ${plMatched.length} matched transactions`, plMatched)
          debugCount++
        }

        if (plMatched.length === 0) {
          progress.skipped++
          onProgress({ ...progress })
          continue
        }

        // For each matched Pennylane transaction, find the corresponding bank_transaction in our DB
        let matched = false
        for (const plTx of plMatched) {
          const plAmount = parseFloat(plTx.currency_amount || plTx.amount || '0')
          const plDate = plTx.date

          // Find best matching bank transaction by amount + date
          const candidate = transactions.find(t =>
            !matchedTxIds.has(t.id) &&
            amountsMatch(Math.abs(t.amount), Math.abs(plAmount)) &&
            plDate != null &&
            datesWithinDays(t.date, plDate, 5)
          )

          if (candidate) {
            const { error: linkError } = await supabase
              .from('bank_transactions')
              .update({
                linked_invoice_id: inv.id,
                is_reconciled: true,
                reconciled_at: new Date().toISOString(),
              })
              .eq('id', candidate.id)

            if (linkError) {
              progress.errors.push(`Lien ${inv.number} <-> tx ${candidate.id}: ${linkError.message}`)
            } else {
              matchedTxIds.add(candidate.id)
              matched = true
              break // One transaction per invoice is enough
            }
          }
        }

        if (matched) {
          progress.created++
        } else {
          // Pennylane says it's matched but we can't find the transaction in our DB
          // Try wider date range (Pennylane transaction dates can differ from bank statement dates)
          const plTx = plMatched[0]
          const plAmount = parseFloat(plTx.currency_amount || plTx.amount || '0')

          const widerCandidate = transactions.find(t =>
            !matchedTxIds.has(t.id) &&
            amountsMatch(Math.abs(t.amount), Math.abs(plAmount)) &&
            plTx.date != null &&
            datesWithinDays(t.date, plTx.date, 30)
          )

          if (widerCandidate) {
            const { error: linkError } = await supabase
              .from('bank_transactions')
              .update({
                linked_invoice_id: inv.id,
                is_reconciled: true,
                reconciled_at: new Date().toISOString(),
              })
              .eq('id', widerCandidate.id)

            if (!linkError) {
              matchedTxIds.add(widerCandidate.id)
              progress.created++
            } else {
              progress.errors.push(`Lien ${inv.number}: ${linkError.message}`)
              progress.skipped++
            }
          } else {
            progress.skipped++
          }
        }
      } catch (err) {
        // API call failed for this invoice (e.g., 404 = invoice not found in Pennylane)
        const msg = err instanceof Error ? err.message : 'Erreur'
        if (!msg.includes('404')) {
          progress.errors.push(`${inv.number} (PL#${inv.pennylane_id}): ${msg}`)
        }
        progress.skipped++
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
