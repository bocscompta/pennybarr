// Vente Service - CRUD operations for customer invoices (sales)
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { Invoice, AccountingEntry, LettrageType, ChartOfAccount } from '../types/database'
import { resolveCustomerAccount, resolveByRole, resolveJournal } from './accountResolverService'
import { isLettrageComplete } from '../utils/lettrageColors'

// ============ Types ============

export interface CustomerInvoiceFormData {
  customerId: string | null
  customerName: string
  invoiceNumber: string
  invoiceDate: string      // Format: YYYY-MM-DD
  dueDate: string          // Format: YYYY-MM-DD
  accountingCode: string   // Compte produit (7xxx)
  entryLabel: string
  totalTTC: number
  totalHT: number
  totalVAT: number
  vatRate: string          // '20', '10', '5.5', '0'
  currency: string         // 'EUR', 'USD'
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export interface InvoiceFilters {
  status?: InvoiceStatus
  startDate?: string
  endDate?: string
  customerId?: string
  searchTerm?: string
}

// ============ Chart of Accounts Loader ============

async function loadChartOfAccounts(): Promise<ChartOfAccount[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error loading chart of accounts:', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('Plan comptable vide ou introuvable pour cette entreprise')
  }

  return data
}

// ============ Piece Number Generation ============

/**
 * Generate unique piece number for sales journal
 * Format: VE2025000001
 */
async function generateSalesPieceNumber(): Promise<string> {
  const journal = await resolveJournal('sales')
  const year = new Date().getFullYear()
  const prefix = `${journal.code}${year}`

  const { data, error } = await supabase
    .from('accounting_entries')
    .select('piece_number')
    .eq('company_id', COMPANY_ID)
    .like('piece_number', `${prefix}%`)
    .order('piece_number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching last piece number:', error)
    throw new Error(`Erreur generation numero piece: ${error.message}`)
  }

  let nextNumber = 1
  if (data && data.length > 0 && data[0].piece_number) {
    const lastNumber = parseInt(data[0].piece_number.slice(prefix.length), 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(6, '0')}`
}

// ============ Customer Management ============

/**
 * Find or create a customer by name
 */
export async function findOrCreateCustomer(name: string): Promise<{ id: string; name: string }> {
  if (!name || !name.trim()) {
    throw new Error('Le nom du client est requis')
  }

  const normalizedName = name.trim().toUpperCase()

  // Try to find existing customer
  const { data: existing, error: searchError } = await supabase
    .from('third_parties')
    .select('id, name')
    .eq('company_id', COMPANY_ID)
    .ilike('name', normalizedName)
    .in('type', ['customer', 'both'])
    .maybeSingle()

  if (searchError) {
    console.error('Error searching customer:', searchError)
    throw new Error(`Erreur recherche client: ${searchError.message}`)
  }

  if (existing) {
    console.log(`Found existing customer: ${existing.name} (${existing.id})`)
    return existing
  }

  // Create new customer
  const { data: created, error: createError } = await supabase
    .from('third_parties')
    .insert({
      company_id: COMPANY_ID,
      name: normalizedName,
      type: 'customer',
      country: 'FR',
      payment_terms: 30,
    })
    .select('id, name')
    .single()

  if (createError) {
    console.error('Error creating customer:', createError)
    throw new Error(`Erreur creation client: ${createError.message}`)
  }

  console.log(`Created new customer: ${created.name} (${created.id})`)
  return created
}

// ============ Customer Invoice CRUD ============

/**
 * Create a customer invoice (facture client)
 */
export async function createCustomerInvoice(
  formData: CustomerInvoiceFormData
): Promise<Invoice> {
  // Validate required fields
  if (!formData.customerName) {
    throw new Error('Le nom du client est requis')
  }
  if (!formData.invoiceNumber) {
    throw new Error('Le numero de facture est requis')
  }
  if (!formData.invoiceDate) {
    throw new Error('La date de facture est requise')
  }
  if (formData.totalTTC <= 0) {
    throw new Error('Le montant TTC doit etre superieur a 0')
  }

  // Find or create customer
  const customer = await findOrCreateCustomer(formData.customerName)

  // Create invoice
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      company_id: COMPANY_ID,
      third_party_id: customer.id,
      type: 'customer',
      number: formData.invoiceNumber,
      date: formData.invoiceDate,
      due_date: formData.dueDate || null,
      status: 'sent',  // Customer invoices start as sent
      total_ht: formData.totalHT,
      total_vat: formData.totalVAT,
      total_ttc: formData.totalTTC,
      currency: formData.currency || 'EUR',
    })
    .select('*, third_party:third_parties(*)')
    .single()

  if (error) {
    console.error('Error creating customer invoice:', error)
    throw new Error(`Erreur creation facture client: ${error.message}`)
  }

  // Generate accounting entries
  await generateSalesEntries(invoice, formData)

  console.log(`Created customer invoice ${invoice.number} for ${customer.name}`)
  return invoice
}

// ============ Accounting Entries Generation ============

/**
 * Generate accounting entries for a customer invoice (facture client)
 *
 * Standard entries:
 *   Debit  411xxx (client)        = TTC
 *   Credit 7xxxxx (produit)       = HT
 *   Credit 44571 (TVA collectee)  = TVA
 */
export async function generateSalesEntries(
  invoice: Invoice,
  formData: CustomerInvoiceFormData
): Promise<AccountingEntry[]> {
  const chartOfAccounts = await loadChartOfAccounts()
  const salesJournal = await resolveJournal('sales')
  const pieceNumber = await generateSalesPieceNumber()

  // Resolve customer account code from chart of accounts by customer name
  const customerName = invoice.third_party?.name || formData.customerName
  if (!customerName) {
    throw new Error('Nom du client requis pour résoudre le compte client')
  }
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts)

  const entries: Partial<AccountingEntry>[] = []
  const date = invoice.date
  const label = formData.entryLabel || `Facture ${invoice.third_party?.name || 'CLIENT'} - ${invoice.number}`

  // Entry 1: Debit customer account (411xxx) = TTC
  entries.push({
    company_id: COMPANY_ID,
    journal: salesJournal.code,
    date,
    piece_number: pieceNumber,
    label,
    account_code: customerAccount.code,
    debit: formData.totalTTC,
    credit: 0,
    linked_invoice_id: invoice.id,
    is_validated: false,
    lettrage_type: 'tiers' as LettrageType,
  })

  // Entry 2: Credit product account (7xxx) = HT
  entries.push({
    company_id: COMPANY_ID,
    journal: salesJournal.code,
    date,
    piece_number: pieceNumber,
    label,
    account_code: formData.accountingCode || '706000',  // Default: prestations de services
    debit: 0,
    credit: formData.totalHT,
    linked_invoice_id: invoice.id,
    is_validated: false,
  })

  // Entry 3: Credit TVA collectee = TVA (if VAT > 0)
  if (formData.totalVAT > 0) {
    const tvaCollectee = resolveByRole('TVA_COLLECTEE', chartOfAccounts)
    entries.push({
      company_id: COMPANY_ID,
      journal: salesJournal.code,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaCollectee.code,
      debit: 0,
      credit: formData.totalVAT,
      linked_invoice_id: invoice.id,
      is_validated: false,
    })
  }

  // Insert entries
  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating sales entries:', error)
    throw new Error(`Erreur creation ecritures ventes: ${error.message}`)
  }

  console.log(`Created ${data.length} sales entries for invoice ${invoice.number}`)
  return data
}

// ============ Invoice Listing ============

/**
 * Get customer invoices with optional filters
 */
export async function getCustomerInvoices(
  filters?: InvoiceFilters
): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .order('date', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate)
  }

  if (filters?.customerId) {
    query = query.eq('third_party_id', filters.customerId)
  }

  if (filters?.searchTerm) {
    query = query.or(`number.ilike.%${filters.searchTerm}%,third_party.name.ilike.%${filters.searchTerm}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching customer invoices:', error)
    throw new Error(`Erreur chargement factures clients: ${error.message}`)
  }

  if (!data) {
    console.error('listCustomerInvoices: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour customer invoices')
  }

  return data
}

/**
 * Get a single customer invoice by ID
 */
export async function getCustomerInvoice(invoiceId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('id', invoiceId)
    .eq('type', 'customer')
    .single()

  if (error) {
    console.error('Error fetching customer invoice:', error)
    throw new Error(`Erreur chargement facture client: ${error.message}`)
  }

  return data
}

// ============ Invoice Status Management ============

/**
 * Update customer invoice status
 */
export async function updateCustomerInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('type', 'customer')
    .select('*, third_party:third_parties(*)')
    .single()

  if (error) {
    console.error('Error updating customer invoice status:', error)
    throw new Error(`Erreur mise a jour statut facture: ${error.message}`)
  }

  console.log(`Updated invoice ${data.number} status to ${status}`)
  return data
}

/**
 * Mark invoice as paid and generate payment entries
 */
export async function markInvoiceAsPaid(
  invoiceId: string,
  transactionId: string,
  bankAccountCode: string = '512000'
): Promise<{ invoice: Invoice; entries: AccountingEntry[] }> {
  // Get the invoice first
  const invoice = await getCustomerInvoice(invoiceId)
  if (!invoice) {
    throw new Error('Facture non trouvee')
  }

  // Update status to paid
  const updatedInvoice = await updateCustomerInvoiceStatus(invoiceId, 'paid')

  // Generate payment entries
  const entries = await generateCustomerPaymentEntries(
    invoice,
    transactionId,
    bankAccountCode
  )

  // Auto-letter the customer account entries
  await autoLetterCustomerPayment(invoiceId, transactionId)

  return { invoice: updatedInvoice, entries }
}

// ============ Payment Entries Generation ============

/**
 * Generate accounting entries for customer payment receipt
 *
 * Payment entries:
 *   Debit  512xxx (banque)   = TTC
 *   Credit 411xxx (client)   = TTC
 */
export async function generateCustomerPaymentEntries(
  invoice: Invoice,
  transactionId: string,
  bankAccountCode: string = '512000'
): Promise<AccountingEntry[]> {
  const year = new Date().getFullYear()
  const prefix = `BQ${year}`

  // Generate piece number for bank journal
  const { data: lastPiece, error: pieceError } = await supabase
    .from('accounting_entries')
    .select('piece_number')
    .eq('company_id', COMPANY_ID)
    .like('piece_number', `${prefix}%`)
    .order('piece_number', { ascending: false })
    .limit(1)

  if (pieceError) {
    throw new Error(`Erreur generation numero piece: ${pieceError.message}`)
  }

  let nextNumber = 1
  if (lastPiece && lastPiece.length > 0 && lastPiece[0].piece_number) {
    const lastNum = parseInt(lastPiece[0].piece_number.slice(prefix.length), 10)
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1
    }
  }
  const pieceNumber = `${prefix}${nextNumber.toString().padStart(6, '0')}`

  // Resolve customer account code from chart of accounts by customer name
  const customerName = invoice.third_party?.name
  if (!customerName) {
    throw new Error('Nom du client requis pour résoudre le compte client')
  }
  const chartOfAccounts = await loadChartOfAccounts()
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts)

  const date = new Date().toISOString().split('T')[0]
  const label = `Encaissement facture ${invoice.third_party?.name || 'CLIENT'} - ${invoice.number}`

  const entries: Partial<AccountingEntry>[] = [
    // Entry 1: Debit bank account (512xxx) = TTC
    {
      company_id: COMPANY_ID,
      journal: 'BQ',
      date,
      piece_number: pieceNumber,
      label,
      account_code: bankAccountCode,
      debit: invoice.total_ttc,
      credit: 0,
      linked_invoice_id: invoice.id,
      linked_transaction_id: transactionId,
      is_validated: false,
    },
    // Entry 2: Credit customer account (411xxx) = TTC
    {
      company_id: COMPANY_ID,
      journal: 'BQ',
      date,
      piece_number: pieceNumber,
      label,
      account_code: customerAccount.code,
      debit: 0,
      credit: invoice.total_ttc,
      linked_invoice_id: invoice.id,
      linked_transaction_id: transactionId,
      is_validated: false,
      lettrage_type: 'tiers' as LettrageType,
    },
  ]

  // Insert entries
  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating payment entries:', error)
    throw new Error(`Erreur creation ecritures encaissement: ${error.message}`)
  }

  console.log(`Created ${data.length} payment entries for invoice ${invoice.number}`)
  return data
}

// ============ Lettrage (Matching) ============

/**
 * Auto-letter customer invoice entries with payment entries
 */
export async function autoLetterCustomerPayment(
  invoiceId: string,
  transactionId: string
): Promise<{ code: string; entries: AccountingEntry[] } | null> {
  // Get all entries linked to this invoice and transaction
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .or(`linked_invoice_id.eq.${invoiceId},linked_transaction_id.eq.${transactionId}`)
    .is('lettrage_code', null)

  if (error || !entries || entries.length === 0) {
    return null
  }

  // Group entries by account code
  const byAccount = new Map<string, AccountingEntry[]>()
  for (const entry of entries) {
    const existing = byAccount.get(entry.account_code) || []
    existing.push(entry)
    byAccount.set(entry.account_code, existing)
  }

  // Letter customer account (411xxx) if balanced
  for (const [accountCode, accountEntries] of byAccount) {
    if (accountCode.startsWith('411') && accountEntries.length >= 2) {
      if (isLettrageComplete(accountEntries)) {
        return letterCustomerEntries(accountEntries.map(e => e.id))
      }
    }
  }

  return null
}

/**
 * Letter customer entries together
 */
async function letterCustomerEntries(
  entryIds: string[]
): Promise<{ code: string; entries: AccountingEntry[] }> {
  if (entryIds.length < 2) {
    throw new Error('Au moins 2 ecritures sont necessaires pour le lettrage')
  }

  // Get the entries
  const { data: entries, error: fetchError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .in('id', entryIds)

  if (fetchError || !entries) {
    throw new Error(`Erreur chargement ecritures: ${fetchError?.message}`)
  }

  const accountCode = entries[0].account_code

  // Get next lettrage code
  const { data: lastCode, error: codeError } = await supabase
    .from('accounting_entries')
    .select('lettrage_code')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', accountCode)
    .not('lettrage_code', 'is', null)
    .order('lettrage_code', { ascending: false })
    .limit(1)

  if (codeError) {
    throw new Error(`Erreur recherche code lettrage: ${codeError.message}`)
  }

  let code = 'A'
  if (lastCode && lastCode.length > 0 && lastCode[0].lettrage_code) {
    code = incrementLettrageCode(lastCode[0].lettrage_code)
  }

  // Update entries with lettrage info
  const { data: updated, error: updateError } = await supabase
    .from('accounting_entries')
    .update({
      lettrage_code: code,
      lettrage_date: new Date().toISOString(),
      lettrage_type: 'tiers' as LettrageType,
    })
    .eq('company_id', COMPANY_ID)
    .in('id', entryIds)
    .select()

  if (updateError) {
    throw new Error(`Erreur mise a jour lettrage: ${updateError.message}`)
  }

  console.log(`Lettered ${updated.length} customer entries with code ${code}`)

  return { code, entries: updated }
}

/**
 * Increment lettrage code (A -> B, Z -> AA, AZ -> BA)
 */
function incrementLettrageCode(code: string): string {
  const chars = code.split('')
  let i = chars.length - 1

  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A'
      i--
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      return chars.join('')
    }
  }

  return 'A' + chars.join('')
}

// ============ Preview Entries (for UI display) ============

export interface PreviewSalesEntry {
  id: string
  journal: string
  pieceNumber: string
  date: string
  accountCode: string
  accountLabel: string
  label: string
  debit: number
  credit: number
  lettrageType?: LettrageType
}

/**
 * Get account label from code (PCG standard)
 */
function getAccountLabel(accountCode: string, customerName?: string): string {
  const standardAccounts: Record<string, string> = {
    '44571': 'TVA collectee',
    '512000': 'Banque',
    '706000': 'Prestations de services',
    '707000': 'Ventes de marchandises',
    '701000': 'Ventes de produits finis',
    '708000': 'Produits des activites annexes',
  }

  if (standardAccounts[accountCode]) {
    return standardAccounts[accountCode]
  }

  // Customer account (411xxx)
  if (accountCode.startsWith('411')) {
    return customerName || 'Client'
  }

  // Bank accounts (512xxx)
  if (accountCode.startsWith('512')) {
    return 'Banque'
  }

  // Generic revenue accounts
  if (accountCode.startsWith('7')) {
    return 'Produits divers'
  }

  return 'Compte'
}

/**
 * Preview sales invoice entries (without saving to database)
 */
export async function previewSalesEntries(
  formData: CustomerInvoiceFormData,
  customerId?: string
): Promise<PreviewSalesEntry[]> {
  const chartOfAccounts = await loadChartOfAccounts()
  const salesJournal = await resolveJournal('sales')
  const year = new Date().getFullYear()
  const pieceNumber = `${salesJournal.code}${year}XXXXXX`

  // Resolve customer account code from chart of accounts
  const customerName = formData.customerName
  if (!customerName) {
    throw new Error('Nom du client requis pour la prévisualisation')
  }
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts)

  const entries: PreviewSalesEntry[] = []
  const date = formData.invoiceDate
  const label = formData.entryLabel || `Facture ${formData.customerName || 'CLIENT'} - ${formData.invoiceNumber || 'N/A'}`

  // Entry 1: Debit customer account (411xxx) = TTC
  entries.push({
    id: `preview-customer-${Date.now()}`,
    journal: salesJournal.code,
    pieceNumber,
    date,
    accountCode: customerAccount.code,
    accountLabel: customerAccount.label,
    label,
    debit: formData.totalTTC,
    credit: 0,
    lettrageType: 'tiers',
  })

  // Entry 2: Credit product account (7xxx) = HT
  const productAccountCode = formData.accountingCode || '706000'
  entries.push({
    id: `preview-product-${Date.now()}`,
    journal: salesJournal.code,
    pieceNumber,
    date,
    accountCode: productAccountCode,
    accountLabel: getAccountLabel(productAccountCode),
    label,
    debit: 0,
    credit: formData.totalHT,
  })

  // Entry 3: Credit TVA collectee = TVA (if VAT > 0)
  if (formData.totalVAT > 0) {
    const tvaCollectee = resolveByRole('TVA_COLLECTEE', chartOfAccounts)
    entries.push({
      id: `preview-tva-${Date.now()}`,
      journal: salesJournal.code,
      pieceNumber,
      date,
      accountCode: tvaCollectee.code,
      accountLabel: tvaCollectee.label,
      label,
      debit: 0,
      credit: formData.totalVAT,
    })
  }

  return entries
}

/**
 * Calculate totals from preview entries
 */
export function calculateSalesEntryTotals(entries: PreviewSalesEntry[]): {
  debit: number
  credit: number
  balanced: boolean
} {
  const debit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const credit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)
  return {
    debit,
    credit,
    balanced: Math.abs(debit - credit) < 0.01,
  }
}

// ============ Delete Invoice ============

/**
 * Delete a customer invoice and its accounting entries
 */
export async function deleteCustomerInvoice(invoiceId: string): Promise<void> {
  // First delete related accounting entries
  const { error: entriesError } = await supabase
    .from('accounting_entries')
    .delete()
    .eq('linked_invoice_id', invoiceId)

  if (entriesError) {
    console.error('Error deleting accounting entries:', entriesError)
    throw new Error(`Erreur suppression ecritures: ${entriesError.message}`)
  }

  // Then delete the invoice
  const { error: invoiceError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('type', 'customer')

  if (invoiceError) {
    console.error('Error deleting customer invoice:', invoiceError)
    throw new Error(`Erreur suppression facture: ${invoiceError.message}`)
  }

  console.log(`Deleted customer invoice ${invoiceId}`)
}

// ============ Statistics ============

/**
 * Get sales statistics for a period
 */
export async function getSalesStats(
  startDate: string,
  endDate: string
): Promise<{
  totalHT: number
  totalTVA: number
  totalTTC: number
  invoiceCount: number
  paidCount: number
  unpaidCount: number
  overdueCount: number
}> {
  const { data, error } = await supabase
    .from('invoices')
    .select('total_ht, total_vat, total_ttc, status, due_date')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) {
    console.error('Error fetching sales stats:', error)
    throw new Error(`Erreur chargement statistiques: ${error.message}`)
  }

  if (!data) {
    console.error('getSalesStats: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour sales stats')
  }

  const today = new Date().toISOString().split('T')[0]

  const stats = {
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0,
    invoiceCount: data.length,
    paidCount: 0,
    unpaidCount: 0,
    overdueCount: 0,
  }

  for (const invoice of data) {
    stats.totalHT += invoice.total_ht || 0
    stats.totalTVA += invoice.total_vat || 0
    stats.totalTTC += invoice.total_ttc || 0

    if (invoice.status === 'paid') {
      stats.paidCount++
    } else if (invoice.status !== 'cancelled') {
      stats.unpaidCount++
      if (invoice.due_date && invoice.due_date < today) {
        stats.overdueCount++
      }
    }
  }

  return stats
}
