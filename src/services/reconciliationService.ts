// Reconciliation Service - Match invoices with bank transactions
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { BankTransaction, Invoice, InvoiceFormData, ChartOfAccount } from '../types/database'
import { autoLetterInvoicePayment, generateRTEntries } from './accountingService'

// ============ Reconciliation ============

/**
 * Reconcile an invoice with a bank transaction
 * Updates transaction to mark it as reconciled
 * Also auto-letters the supplier account entries
 */
/**
 * Reconcile an invoice with a bank transaction
 * Updates transaction to mark it as reconciled
 * Also auto-letters the supplier account entries
 * If autoliquidated: generates RT entries (TVA recovery on receipts)
 *
 * @param formData Optional invoice form data (needed for RT entries on autoliquidation)
 */
export async function reconcileInvoiceWithTransaction(
  invoiceId: string,
  transactionId: string,
  formData?: InvoiceFormData,
  transactionDate?: string,
  transactionLabel?: string,
  chartOfAccounts?: ChartOfAccount[]
): Promise<BankTransaction> {
  // Update bank transaction
  const { data, error } = await supabase
    .from('bank_transactions')
    .update({
      linked_invoice_id: invoiceId,
      is_reconciled: true,
      reconciled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .select()
    .single()

  if (error) {
    console.error('Error reconciling transaction:', error)
    throw new Error(`Erreur réconciliation: ${error.message}`)
  }

  // Auto-letter the supplier account entries
  try {
    const lettrageResult = await autoLetterInvoicePayment(invoiceId, transactionId)
    if (lettrageResult) {
      console.log(`Auto-lettered ${lettrageResult.entries.length} entries with code ${lettrageResult.code}`)
    }
  } catch (lettrageError) {
    // Don't fail reconciliation if lettering fails
    console.warn('Auto-lettering failed, continuing:', lettrageError)
  }

  // Generate RT entries if autoliquidated invoice
  if (formData && formData.vatRate.startsWith('autoliq-')) {
    try {
      // Fetch the invoice to pass to generateRTEntries
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select('*, third_party:third_parties(*)')
        .eq('id', invoiceId)
        .single()

      if (invError || !invoice) {
        console.warn('Could not fetch invoice for RT entries:', invError)
      } else {
        const rtEntries = await generateRTEntries(invoice, formData, transactionDate, transactionLabel, chartOfAccounts)
        if (rtEntries.length > 0) {
          console.log(`Generated ${rtEntries.length} RT entries for autoliquidated invoice ${invoiceId}`)
        }
      }
    } catch (rtError) {
      // Don't fail reconciliation if RT generation fails
      console.warn('RT entries generation failed, continuing:', rtError)
    }
  }

  console.log(`Reconciled transaction ${transactionId} with invoice ${invoiceId}`)
  return data
}

/**
 * Unreconcile a transaction (remove invoice link)
 */
export async function unreconcileTransaction(transactionId: string): Promise<BankTransaction> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .update({
      linked_invoice_id: null,
      is_reconciled: false,
      reconciled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .select()
    .single()

  if (error) {
    console.error('Error unreconciling transaction:', error)
    throw new Error(`Erreur annulation réconciliation: ${error.message}`)
  }

  console.log(`Unreconciled transaction ${transactionId}`)
  return data
}

// ============ Matching Suggestions ============

/**
 * Find invoices that might match a transaction
 * Based on: amount, date proximity, third party
 */
export async function findMatchingInvoices(
  transaction: BankTransaction,
  tolerance: number = 0.01  // Amount tolerance (default 1 cent)
): Promise<Invoice[]> {
  const amount = Math.abs(transaction.amount)

  // Search for unpaid invoices with matching amount
  const { data, error } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('company_id', COMPANY_ID)
    .neq('status', 'paid')
    .gte('total_ttc', amount - tolerance)
    .lte('total_ttc', amount + tolerance)
    .order('date', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error finding matching invoices:', error)
    throw new Error(`Erreur recherche factures: ${error.message}`)
  }

  if (!data) {
    console.error('findMatchingInvoices: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour matching invoices')
  }

  return data
}

/**
 * Find transactions that might match an invoice
 * Based on: amount, date proximity
 */
export async function findMatchingTransactions(
  invoice: Invoice,
  tolerance: number = 0.01
): Promise<BankTransaction[]> {
  const amount = invoice.total_ttc

  // Search for unreconciled transactions with matching amount
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_reconciled', false)
    .lte('amount', -(amount - tolerance))  // Negative for outgoing payments
    .gte('amount', -(amount + tolerance))
    .order('date', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error finding matching transactions:', error)
    throw new Error(`Erreur recherche transactions: ${error.message}`)
  }

  if (!data) {
    console.error('findMatchingTransactions: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour matching transactions')
  }

  return data
}

// ============ Bulk Operations ============

/**
 * Get reconciliation status for a list of transactions
 */
export async function getReconciliationStatus(
  transactionIds: string[]
): Promise<Map<string, boolean>> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('id, is_reconciled')
    .in('id', transactionIds)

  if (error) {
    console.error('Error fetching reconciliation status:', error)
    throw new Error(`Erreur statut réconciliation: ${error.message}`)
  }

  const statusMap = new Map<string, boolean>()
  data?.forEach(t => statusMap.set(t.id, t.is_reconciled))
  return statusMap
}

/**
 * Get unreconciled transactions count
 */
export async function getUnreconciledCount(): Promise<number> {
  const { count, error } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('is_reconciled', false)

  if (error) {
    console.error('Error counting unreconciled:', error)
    throw new Error(`Erreur comptage: ${error.message}`)
  }

  return count || 0
}

/**
 * Calculate reconciliation progress
 */
export async function getReconciliationProgress(): Promise<{
  total: number
  reconciled: number
  percentage: number
}> {
  const { count: total, error: totalError } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)

  if (totalError) {
    console.error('Error counting total:', totalError)
    throw new Error(`Erreur comptage total: ${totalError.message}`)
  }

  const { count: reconciled, error: reconciledError } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('is_reconciled', true)

  if (reconciledError) {
    console.error('Error counting reconciled:', reconciledError)
    throw new Error(`Erreur comptage réconciliées: ${reconciledError.message}`)
  }

  const totalCount = total || 0
  const reconciledCount = reconciled || 0
  const percentage = totalCount > 0 ? Math.round((reconciledCount / totalCount) * 100) : 0

  return {
    total: totalCount,
    reconciled: reconciledCount,
    percentage,
  }
}

// ============ Smart Suggestions ============

export interface InvoiceSuggestion {
  invoice: Invoice
  score: number
  reason: string
}

/**
 * Calculate similarity score between transaction label and invoice/third party
 * Returns 0-100
 */
function calculateLabelSimilarity(label: string, invoice: Invoice): number {
  const labelLower = label.toLowerCase()
  const thirdPartyName = invoice.third_party?.name?.toLowerCase() || ''
  const invoiceNumber = invoice.number?.toLowerCase() || ''

  // Check for exact third party match
  if (thirdPartyName && labelLower.includes(thirdPartyName)) {
    return 80
  }

  // Check for partial third party match (first word)
  const firstWord = thirdPartyName.split(' ')[0]
  if (firstWord && firstWord.length > 3 && labelLower.includes(firstWord)) {
    return 60
  }

  // Check for invoice number match
  if (invoiceNumber && labelLower.includes(invoiceNumber)) {
    return 40
  }

  return 0
}

/**
 * Calculate date proximity score
 * Returns 0-100 based on how close the dates are
 */
function calculateDateScore(transactionDate: string, invoiceDate: string): number {
  const txDate = new Date(transactionDate)
  const invDate = new Date(invoiceDate)
  const diffDays = Math.abs((txDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 3) return 100
  if (diffDays <= 7) return 80
  if (diffDays <= 14) return 60
  if (diffDays <= 30) return 40
  if (diffDays <= 60) return 20
  return 0
}

/**
 * Find invoices that might match a transaction with intelligent scoring
 * Returns suggestions sorted by score with reasons
 *
 * Rules:
 * - Amount must match within 1% (not 10%)
 * - Invoices already linked to another transaction are excluded
 * - Cancelled invoices are excluded
 * - Minimum score threshold of 30 to appear as suggestion (low because tolerance is tight)
 */
export async function suggestInvoicesForTransaction(
  transaction: BankTransaction
): Promise<InvoiceSuggestion[]> {
  const amount = Math.abs(transaction.amount)

  // Tight tolerance: 1% or 0.10€ minimum (whichever is larger)
  const tolerance = Math.max(amount * 0.01, 0.10)

  // Search for invoices with matching amount (tight tolerance)
  const { data, error } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('company_id', COMPANY_ID)
    .neq('status', 'paid')
    .neq('status', 'cancelled')
    .gte('total_ttc', amount - tolerance)
    .lte('total_ttc', amount + tolerance)
    .order('date', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error finding matching invoices:', error)
    throw new Error(`Erreur recherche factures: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  // Exclude invoices already linked to a bank transaction
  const invoiceIds = data.map(i => i.id)
  const { data: linkedTxData } = await supabase
    .from('bank_transactions')
    .select('linked_invoice_id')
    .in('linked_invoice_id', invoiceIds)

  const alreadyLinkedIds = new Set(
    (linkedTxData || []).map(t => t.linked_invoice_id).filter(Boolean)
  )

  const availableInvoices = data.filter(i => !alreadyLinkedIds.has(i.id))

  if (availableInvoices.length === 0) {
    return []
  }

  // Score each invoice
  const suggestions: InvoiceSuggestion[] = availableInvoices.map(invoice => {
    let score = 0
    const reasons: string[] = []

    // Amount scoring (max 40 points)
    // Since tolerance is already tight (1% or 0.10€ min), any match is significant
    const amountDiff = Math.abs(invoice.total_ttc - amount)
    const pctDiff = amount > 0 ? (amountDiff / amount) * 100 : 0
    if (amountDiff < 0.01) {
      score += 40
      reasons.push('Montant exact')
    } else if (amountDiff < 0.10) {
      score += 38
      reasons.push('Montant quasi-exact')
    } else if (pctDiff < 0.5) {
      score += 35
      reasons.push(`Écart ${amountDiff.toFixed(2)}€`)
    } else {
      // Still within our 1% tolerance
      score += 30
      reasons.push(`Écart ${amountDiff.toFixed(2)}€`)
    }

    // Third party / label matching (max 30 points)
    const labelScore = calculateLabelSimilarity(transaction.label || '', invoice)
    if (labelScore >= 80) {
      score += 30
      reasons.push('Tiers correspondant')
    } else if (labelScore >= 60) {
      score += 20
      reasons.push('Tiers partiel')
    } else if (labelScore >= 40) {
      score += 10
      reasons.push('Réf. facture trouvée')
    }

    // Date proximity scoring (max 30 points)
    const dateScore = calculateDateScore(transaction.date, invoice.date)
    if (dateScore >= 80) {
      score += 30
      reasons.push('Date proche')
    } else if (dateScore >= 40) {
      score += 15
      reasons.push('Date similaire')
    }

    return {
      invoice,
      score,
      reason: reasons.join(' • ')
    }
  })

  // Filter: minimum score 30, sort by score descending, return top 5
  // Threshold is low because amount tolerance is already tight (1%)
  return suggestions
    .filter(s => s.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

// ============ Smart Auto-Reconciliation ============

export interface SmartReconcileResult {
  matched: number
  suggestions: Array<{
    transactionId: string
    invoiceId: string
    score: number
    reason: string
  }>
}

/**
 * Smart auto-reconciliation
 * Automatically matches transactions where score >= 90
 * Returns suggestions for others
 */
export async function smartAutoReconcile(): Promise<SmartReconcileResult> {
  // Get unreconciled transactions
  const { data: transactions, error: txError } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_reconciled', false)
    .lt('amount', 0) // Only outgoing payments
    .limit(100)

  if (txError) {
    console.error('Error fetching transactions:', txError)
    throw new Error(`Erreur chargement transactions: ${txError.message}`)
  }

  if (!transactions || transactions.length === 0) {
    return { matched: 0, suggestions: [] }
  }

  // Get unpaid invoices
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('company_id', COMPANY_ID)
    .neq('status', 'paid')
    .eq('type', 'supplier')

  if (invError) {
    console.error('Error fetching invoices:', invError)
    throw new Error(`Erreur chargement factures: ${invError.message}`)
  }

  if (!invoices || invoices.length === 0) {
    return { matched: 0, suggestions: [] }
  }

  let matchedCount = 0
  const suggestions: SmartReconcileResult['suggestions'] = []
  const usedInvoiceIds = new Set<string>()

  for (const tx of transactions) {
    const txAmount = Math.abs(tx.amount)

    // Find best matching invoice
    let bestMatch: { invoice: Invoice; score: number; reason: string } | null = null

    for (const invoice of invoices) {
      if (usedInvoiceIds.has(invoice.id)) continue

      let score = 0
      const reasons: string[] = []

      // Amount scoring
      const amountDiff = Math.abs(invoice.total_ttc - txAmount)
      if (amountDiff < 0.01) {
        score += 40
        reasons.push('Montant exact')
      } else if (amountDiff < 1) {
        score += 30
        reasons.push('Montant proche')
      } else if (amountDiff < txAmount * 0.05) {
        score += 15
      } else {
        continue // Skip if amount diff > 5%
      }

      // Third party matching
      const labelScore = calculateLabelSimilarity(tx.label || '', invoice)
      if (labelScore >= 80) {
        score += 35
        reasons.push('Tiers correspondant')
      } else if (labelScore >= 60) {
        score += 20
        reasons.push('Tiers partiel')
      }

      // Date proximity
      const dateScore = calculateDateScore(tx.date, invoice.date)
      if (dateScore >= 80) {
        score += 25
        reasons.push('Date proche')
      } else if (dateScore >= 40) {
        score += 10
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { invoice, score, reason: reasons.join(' • ') }
      }
    }

    if (bestMatch) {
      if (bestMatch.score >= 90) {
        // Auto-match: high confidence
        await reconcileInvoiceWithTransaction(bestMatch.invoice.id, tx.id)

        // Update invoice status
        await supabase
          .from('invoices')
          .update({ status: 'paid' })
          .eq('id', bestMatch.invoice.id)

        usedInvoiceIds.add(bestMatch.invoice.id)
        matchedCount++

        console.log(`Auto-matched transaction ${tx.id} with invoice ${bestMatch.invoice.id} (score: ${bestMatch.score})`)
      } else if (bestMatch.score >= 50) {
        // Suggest: medium confidence
        suggestions.push({
          transactionId: tx.id,
          invoiceId: bestMatch.invoice.id,
          score: bestMatch.score,
          reason: bestMatch.reason
        })
      }
    }
  }

  return {
    matched: matchedCount,
    suggestions
  }
}

// ============ Basic Auto-Reconciliation ============

/**
 * Attempt to auto-reconcile transactions with exact matching invoices
 */
export async function autoReconcile(): Promise<{
  matched: number
  transactions: Array<{ transactionId: string; invoiceId: string }>
}> {
  // Get unreconciled transactions
  const { data: transactions, error: txError } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_reconciled', false)
    .lt('amount', 0)  // Only outgoing payments
    .limit(100)

  if (txError) {
    console.error('Error fetching transactions:', txError)
    throw new Error(`Erreur chargement transactions: ${txError.message}`)
  }

  if (!transactions || transactions.length === 0) {
    return { matched: 0, transactions: [] }
  }

  // Get unpaid invoices
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .neq('status', 'paid')
    .eq('type', 'supplier')

  if (invError) {
    console.error('Error fetching invoices:', invError)
    throw new Error(`Erreur chargement factures: ${invError.message}`)
  }

  if (!invoices || invoices.length === 0) {
    return { matched: 0, transactions: [] }
  }

  // Try to match by exact amount
  const matches: Array<{ transactionId: string; invoiceId: string }> = []

  for (const tx of transactions) {
    const txAmount = Math.abs(tx.amount)

    const matchingInvoice = invoices.find(inv => {
      // Check if amounts match (with 1 cent tolerance)
      return Math.abs(inv.total_ttc - txAmount) < 0.01
    })

    if (matchingInvoice) {
      // Reconcile
      await reconcileInvoiceWithTransaction(matchingInvoice.id, tx.id)

      // Update invoice status
      await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', matchingInvoice.id)

      matches.push({
        transactionId: tx.id,
        invoiceId: matchingInvoice.id,
      })

      // Remove from available invoices
      const idx = invoices.indexOf(matchingInvoice)
      if (idx > -1) invoices.splice(idx, 1)
    }
  }

  return {
    matched: matches.length,
    transactions: matches,
  }
}
