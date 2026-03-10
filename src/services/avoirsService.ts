// Avoirs Service - CRUD operations for customer credit notes (avoirs clients)
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { CreditNote, CreditNoteApplication, AccountingEntry, LettrageType, ChartOfAccount } from '../types/database'
import { resolveCustomerAccount, resolveByRole, resolveJournal } from './accountResolverService'

// ============ Types ============

export interface CreditNoteLineFormData {
  description: string
  quantity: number
  unitPrice: number
  vatRate: string
  accountingCode: string
}

export interface CreditNoteFormData {
  customerId: string | null
  customerName: string
  originalInvoiceId?: string
  creditNoteNumber: string
  date: string
  reason: string
  lines: CreditNoteLineFormData[]
  currency: string
}

export type CreditNoteStatus = 'draft' | 'validated' | 'applied' | 'refunded'

export interface CreditNoteFilters {
  status?: CreditNoteStatus
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
 * Generate unique piece number for credit notes journal
 * Format: AV2025000001
 */
async function generateAvoirsPieceNumber(): Promise<string> {
  const journal = await resolveJournal('credit_note')
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

/**
 * Generate credit note number
 * Format: AV-YYYY-NNNNN
 */
export async function generateCreditNoteNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `AV-${year}-`

  const { data, error } = await supabase
    .from('credit_notes')
    .select('number')
    .eq('company_id', COMPANY_ID)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching last credit note number:', error)
    throw new Error(`Erreur generation numero avoir: ${error.message}`)
  }

  let nextNumber = 1
  if (data && data.length > 0 && data[0].number) {
    const lastNumber = parseInt(data[0].number.slice(prefix.length), 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`
}

// ============ Credit Note CRUD ============

/**
 * Create a credit note from an existing invoice (retour marchandise, remise, etc.)
 */
export async function createCreditNoteFromInvoice(
  invoiceId: string,
  lines: CreditNoteLineFormData[],
  reason: string
): Promise<CreditNote> {
  // Get the original invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('id', invoiceId)
    .eq('type', 'customer')
    .single()

  if (invoiceError || !invoice) {
    console.error('Error fetching invoice:', invoiceError)
    throw new Error(`Facture non trouvee: ${invoiceError?.message || 'ID invalide'}`)
  }

  const creditNoteNumber = await generateCreditNoteNumber()
  const totalHT = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const totalVAT = lines.reduce((sum, l) => {
    const lineHT = l.quantity * l.unitPrice
    const vatRate = parseFloat(l.vatRate) / 100
    return sum + lineHT * vatRate
  }, 0)
  const totalTTC = totalHT + totalVAT

  // Create credit note
  const { data: creditNote, error } = await supabase
    .from('credit_notes')
    .insert({
      company_id: COMPANY_ID,
      customer_id: invoice.third_party_id,
      original_invoice_id: invoiceId,
      number: creditNoteNumber,
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      reason,
      total_ht: Math.round(totalHT * 100) / 100,
      total_vat: Math.round(totalVAT * 100) / 100,
      total_ttc: Math.round(totalTTC * 100) / 100,
      currency: invoice.currency || 'EUR',
    })
    .select('*, customer:third_parties(*), original_invoice:invoices(*)')
    .single()

  if (error) {
    console.error('Error creating credit note:', error)
    throw new Error(`Erreur creation avoir: ${error.message}`)
  }

  // Create credit note lines
  const lineInserts = lines.map((line) => {
    const lineHT = line.quantity * line.unitPrice
    const vatRate = parseFloat(line.vatRate) / 100
    const lineVAT = lineHT * vatRate
    return {
      credit_note_id: creditNote.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      vat_rate: parseFloat(line.vatRate),
      total_ht: Math.round(lineHT * 100) / 100,
      total_vat: Math.round(lineVAT * 100) / 100,
      total_ttc: Math.round((lineHT + lineVAT) * 100) / 100,
      accounting_code: line.accountingCode,
    }
  })

  const { error: linesError } = await supabase
    .from('credit_note_lines')
    .insert(lineInserts)

  if (linesError) {
    console.error('Error creating credit note lines:', linesError)
    throw new Error(`Erreur creation lignes avoir: ${linesError.message}`)
  }

  console.log(`Created credit note ${creditNote.number} from invoice ${invoice.number}`)
  return creditNote
}

/**
 * Create a standalone credit note (without reference to an invoice)
 */
export async function createCreditNote(
  formData: CreditNoteFormData
): Promise<CreditNote> {
  // Validate required fields
  if (!formData.customerName && !formData.customerId) {
    throw new Error('Le client est requis')
  }
  if (!formData.reason) {
    throw new Error('Le motif de l\'avoir est requis')
  }
  if (formData.lines.length === 0) {
    throw new Error('Au moins une ligne est requise')
  }

  // Find or create customer
  let customerId = formData.customerId
  if (!customerId && formData.customerName) {
    const { data: existing } = await supabase
      .from('third_parties')
      .select('id')
      .eq('company_id', COMPANY_ID)
      .ilike('name', formData.customerName.trim().toUpperCase())
      .in('type', ['customer', 'both'])
      .maybeSingle()

    if (existing) {
      customerId = existing.id
    } else {
      const { data: created, error: createError } = await supabase
        .from('third_parties')
        .insert({
          company_id: COMPANY_ID,
          name: formData.customerName.trim().toUpperCase(),
          type: 'customer',
          country: 'FR',
          payment_terms: 30,
        })
        .select('id')
        .single()

      if (createError) {
        throw new Error(`Erreur creation client: ${createError.message}`)
      }
      customerId = created.id
    }
  }

  const creditNoteNumber = formData.creditNoteNumber || await generateCreditNoteNumber()
  const totalHT = formData.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const totalVAT = formData.lines.reduce((sum, l) => {
    const lineHT = l.quantity * l.unitPrice
    const vatRate = parseFloat(l.vatRate) / 100
    return sum + lineHT * vatRate
  }, 0)
  const totalTTC = totalHT + totalVAT

  // Create credit note
  const { data: creditNote, error } = await supabase
    .from('credit_notes')
    .insert({
      company_id: COMPANY_ID,
      customer_id: customerId,
      original_invoice_id: formData.originalInvoiceId || null,
      number: creditNoteNumber,
      date: formData.date,
      status: 'draft',
      reason: formData.reason,
      total_ht: Math.round(totalHT * 100) / 100,
      total_vat: Math.round(totalVAT * 100) / 100,
      total_ttc: Math.round(totalTTC * 100) / 100,
      currency: formData.currency || 'EUR',
    })
    .select('*, customer:third_parties(*), original_invoice:invoices(*)')
    .single()

  if (error) {
    console.error('Error creating credit note:', error)
    throw new Error(`Erreur creation avoir: ${error.message}`)
  }

  // Create credit note lines
  const lineInserts = formData.lines.map((line) => {
    const lineHT = line.quantity * line.unitPrice
    const vatRate = parseFloat(line.vatRate) / 100
    const lineVAT = lineHT * vatRate
    return {
      credit_note_id: creditNote.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      vat_rate: parseFloat(line.vatRate),
      total_ht: Math.round(lineHT * 100) / 100,
      total_vat: Math.round(lineVAT * 100) / 100,
      total_ttc: Math.round((lineHT + lineVAT) * 100) / 100,
      accounting_code: line.accountingCode,
    }
  })

  const { error: linesError } = await supabase
    .from('credit_note_lines')
    .insert(lineInserts)

  if (linesError) {
    console.error('Error creating credit note lines:', linesError)
    throw new Error(`Erreur creation lignes avoir: ${linesError.message}`)
  }

  console.log(`Created standalone credit note ${creditNote.number}`)
  return creditNote
}

/**
 * Validate a credit note and generate reversed accounting entries
 *
 * Credit note entries (opposite of invoice):
 *   Debit  7xxxxx (produit)       = HT
 *   Debit  44571 (TVA collectee)  = TVA
 *   Credit 411xxx (client)        = TTC
 */
export async function validateCreditNote(
  creditNoteId: string
): Promise<{ creditNote: CreditNote; entries: AccountingEntry[] }> {
  // Get credit note with lines
  const { data: creditNote, error: fetchError } = await supabase
    .from('credit_notes')
    .select('*, customer:third_parties(*), lines:credit_note_lines(*)')
    .eq('id', creditNoteId)
    .single()

  if (fetchError || !creditNote) {
    throw new Error(`Avoir non trouve: ${fetchError?.message || 'ID invalide'}`)
  }

  if (creditNote.status !== 'draft') {
    throw new Error('Seul un avoir en brouillon peut etre valide')
  }

  const chartOfAccounts = await loadChartOfAccounts()
  const avoirsJournal = await resolveJournal('credit_note')
  const pieceNumber = await generateAvoirsPieceNumber()
  const date = creditNote.date
  const label = `Avoir ${creditNote.customer?.name || 'CLIENT'} - ${creditNote.number}`

  // Resolve customer account code from chart of accounts by customer name
  const customerName = creditNote.customer?.name
  if (!customerName) {
    throw new Error('Nom du client requis pour résoudre le compte client')
  }
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts)

  const entries: Partial<AccountingEntry>[] = []

  // Group lines by accounting code for entries
  const linesByAccount = new Map<string, { ht: number; vat: number }>()
  for (const line of creditNote.lines || []) {
    const accountCode = line.accounting_code || '706000'
    const existing = linesByAccount.get(accountCode) || { ht: 0, vat: 0 }
    existing.ht += line.total_ht
    existing.vat += line.total_vat
    linesByAccount.set(accountCode, existing)
  }

  // Entry: Debit product accounts (7xxx) = HT (reversed)
  for (const [accountCode, amounts] of linesByAccount) {
    entries.push({
      company_id: COMPANY_ID,
      journal: avoirsJournal.code,
      date,
      piece_number: pieceNumber,
      label,
      account_code: accountCode,
      debit: amounts.ht,
      credit: 0,
      linked_invoice_id: creditNote.original_invoice_id || null,
      is_validated: false,
    })
  }

  // Entry: Debit TVA collectee = TVA (reversed)
  if (creditNote.total_vat > 0) {
    const tvaCollectee = resolveByRole('TVA_COLLECTEE', chartOfAccounts)
    entries.push({
      company_id: COMPANY_ID,
      journal: avoirsJournal.code,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaCollectee.code,
      debit: creditNote.total_vat,
      credit: 0,
      linked_invoice_id: creditNote.original_invoice_id || null,
      is_validated: false,
    })
  }

  // Entry: Credit customer account (411xxx) = TTC
  entries.push({
    company_id: COMPANY_ID,
    journal: avoirsJournal.code,
    date,
    piece_number: pieceNumber,
    label,
    account_code: customerAccount.code,
    debit: 0,
    credit: creditNote.total_ttc,
    linked_invoice_id: creditNote.original_invoice_id || null,
    is_validated: false,
    lettrage_type: 'tiers' as LettrageType,
  })

  // Insert entries
  const { data: insertedEntries, error: entriesError } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (entriesError) {
    console.error('Error creating credit note entries:', entriesError)
    throw new Error(`Erreur creation ecritures avoir: ${entriesError.message}`)
  }

  // Update credit note status
  const { data: updatedCreditNote, error: updateError } = await supabase
    .from('credit_notes')
    .update({
      status: 'validated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', creditNoteId)
    .select('*, customer:third_parties(*), original_invoice:invoices(*)')
    .single()

  if (updateError) {
    throw new Error(`Erreur mise a jour avoir: ${updateError.message}`)
  }

  console.log(`Validated credit note ${creditNote.number} with ${insertedEntries.length} entries`)
  return { creditNote: updatedCreditNote, entries: insertedEntries }
}

/**
 * Apply a credit note to another invoice (reduce invoice balance)
 */
export async function applyCreditNoteToInvoice(
  creditNoteId: string,
  invoiceId: string,
  amount?: number
): Promise<CreditNoteApplication> {
  // Get credit note
  const { data: creditNote, error: cnError } = await supabase
    .from('credit_notes')
    .select('*, applications:credit_note_applications(*)')
    .eq('id', creditNoteId)
    .single()

  if (cnError || !creditNote) {
    throw new Error(`Avoir non trouve: ${cnError?.message || 'ID invalide'}`)
  }

  if (creditNote.status !== 'validated') {
    throw new Error('L\'avoir doit etre valide avant d\'etre impute')
  }

  // Calculate remaining amount on credit note
  const appliedAmount = (creditNote.applications || []).reduce(
    (sum: number, app: CreditNoteApplication) => sum + app.amount,
    0
  )
  const remainingAmount = creditNote.total_ttc - appliedAmount

  if (remainingAmount <= 0) {
    throw new Error('Cet avoir a deja ete integralement impute')
  }

  // Get target invoice
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('type', 'customer')
    .single()

  if (invError || !invoice) {
    throw new Error(`Facture non trouvee: ${invError?.message || 'ID invalide'}`)
  }

  // Calculate amount to apply
  const applyAmount = amount
    ? Math.min(amount, remainingAmount, invoice.total_ttc)
    : Math.min(remainingAmount, invoice.total_ttc)

  if (applyAmount <= 0) {
    throw new Error('Montant a imputer invalide')
  }

  // Create application record
  const { data: application, error: appError } = await supabase
    .from('credit_note_applications')
    .insert({
      credit_note_id: creditNoteId,
      invoice_id: invoiceId,
      amount: applyAmount,
      applied_at: new Date().toISOString(),
    })
    .select('*, invoice:invoices(*)')
    .single()

  if (appError) {
    throw new Error(`Erreur imputation avoir: ${appError.message}`)
  }

  // Check if credit note is fully applied
  const newRemainingAmount = remainingAmount - applyAmount
  if (newRemainingAmount < 0.01) {
    await supabase
      .from('credit_notes')
      .update({
        status: 'applied',
        updated_at: new Date().toISOString(),
      })
      .eq('id', creditNoteId)
  }

  console.log(`Applied ${applyAmount} EUR from credit note ${creditNote.number} to invoice ${invoice.number}`)
  return application
}

/**
 * Refund a credit note (payment to customer)
 */
export async function refundCreditNote(
  creditNoteId: string,
  bankAccountId: string
): Promise<{ creditNote: CreditNote; entries: AccountingEntry[] }> {
  // Get credit note
  const { data: creditNote, error: cnError } = await supabase
    .from('credit_notes')
    .select('*, customer:third_parties(*), applications:credit_note_applications(*)')
    .eq('id', creditNoteId)
    .single()

  if (cnError || !creditNote) {
    throw new Error(`Avoir non trouve: ${cnError?.message || 'ID invalide'}`)
  }

  if (creditNote.status !== 'validated') {
    throw new Error('L\'avoir doit etre valide avant d\'etre rembourse')
  }

  // Calculate remaining amount
  const appliedAmount = (creditNote.applications || []).reduce(
    (sum: number, app: CreditNoteApplication) => sum + app.amount,
    0
  )
  const refundAmount = creditNote.total_ttc - appliedAmount

  if (refundAmount <= 0) {
    throw new Error('Cet avoir a deja ete integralement impute')
  }

  // Get bank account code
  const { data: bankAccount, error: bankError } = await supabase
    .from('bank_accounts')
    .select('account_number')
    .eq('id', bankAccountId)
    .single()

  if (bankError) {
    throw new Error(`Compte bancaire non trouve: ${bankError.message}`)
  }

  const bankAccountCode = `512${bankAccount?.account_number?.slice(-3) || '000'}`

  // Generate payment entries
  const year = new Date().getFullYear()
  const prefix = `BQ${year}`
  const { data: lastPiece } = await supabase
    .from('accounting_entries')
    .select('piece_number')
    .eq('company_id', COMPANY_ID)
    .like('piece_number', `${prefix}%`)
    .order('piece_number', { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (lastPiece && lastPiece.length > 0 && lastPiece[0].piece_number) {
    const lastNum = parseInt(lastPiece[0].piece_number.slice(prefix.length), 10)
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1
    }
  }
  const pieceNumber = `${prefix}${nextNumber.toString().padStart(6, '0')}`

  // Resolve customer account code from chart of accounts by customer name
  const customerName = creditNote.customer?.name
  if (!customerName) {
    throw new Error('Nom du client requis pour résoudre le compte client')
  }
  const chartOfAccounts = await loadChartOfAccounts()
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts)

  const date = new Date().toISOString().split('T')[0]
  const label = `Remboursement avoir ${creditNote.customer?.name || 'CLIENT'} - ${creditNote.number}`

  const entries: Partial<AccountingEntry>[] = [
    // Debit customer account (411xxx) = refund amount
    {
      company_id: COMPANY_ID,
      journal: 'BQ',
      date,
      piece_number: pieceNumber,
      label,
      account_code: customerAccount.code,
      debit: refundAmount,
      credit: 0,
      is_validated: false,
      lettrage_type: 'tiers' as LettrageType,
    },
    // Credit bank account (512xxx) = refund amount
    {
      company_id: COMPANY_ID,
      journal: 'BQ',
      date,
      piece_number: pieceNumber,
      label,
      account_code: bankAccountCode,
      debit: 0,
      credit: refundAmount,
      is_validated: false,
    },
  ]

  const { data: insertedEntries, error: entriesError } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (entriesError) {
    throw new Error(`Erreur creation ecritures remboursement: ${entriesError.message}`)
  }

  // Update credit note status
  const { data: updatedCreditNote, error: updateError } = await supabase
    .from('credit_notes')
    .update({
      status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', creditNoteId)
    .select('*, customer:third_parties(*), original_invoice:invoices(*)')
    .single()

  if (updateError) {
    throw new Error(`Erreur mise a jour avoir: ${updateError.message}`)
  }

  console.log(`Refunded credit note ${creditNote.number} for ${refundAmount} EUR`)
  return { creditNote: updatedCreditNote, entries: insertedEntries }
}

// ============ Credit Note Listing ============

/**
 * Get credit notes with optional filters
 */
export async function getCreditNotes(
  filters?: CreditNoteFilters
): Promise<CreditNote[]> {
  let query = supabase
    .from('credit_notes')
    .select('*, customer:third_parties(*), original_invoice:invoices(*), applications:credit_note_applications(*)')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })

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
    query = query.eq('customer_id', filters.customerId)
  }

  if (filters?.searchTerm) {
    query = query.or(`number.ilike.%${filters.searchTerm}%,reason.ilike.%${filters.searchTerm}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching credit notes:', error)
    throw new Error(`Erreur chargement avoirs: ${error.message}`)
  }

  if (!data) {
    console.error('listCreditNotes: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour credit notes')
  }

  return data
}

/**
 * Get a single credit note by ID
 */
export async function getCreditNote(creditNoteId: string): Promise<CreditNote | null> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select(`
      *,
      customer:third_parties(*),
      original_invoice:invoices(*),
      lines:credit_note_lines(*),
      applications:credit_note_applications(*, invoice:invoices(*))
    `)
    .eq('id', creditNoteId)
    .single()

  if (error) {
    console.error('Error fetching credit note:', error)
    throw new Error(`Erreur chargement avoir: ${error.message}`)
  }

  return data
}

/**
 * Delete a credit note (only drafts can be deleted)
 */
export async function deleteCreditNote(creditNoteId: string): Promise<void> {
  // Check status first
  const { data: creditNote, error: fetchError } = await supabase
    .from('credit_notes')
    .select('status')
    .eq('id', creditNoteId)
    .single()

  if (fetchError) {
    throw new Error(`Avoir non trouve: ${fetchError.message}`)
  }

  if (creditNote.status !== 'draft') {
    throw new Error('Seuls les avoirs en brouillon peuvent etre supprimes')
  }

  // Delete lines first
  const { error: linesError } = await supabase
    .from('credit_note_lines')
    .delete()
    .eq('credit_note_id', creditNoteId)

  if (linesError) {
    throw new Error(`Erreur suppression lignes: ${linesError.message}`)
  }

  // Delete credit note
  const { error } = await supabase
    .from('credit_notes')
    .delete()
    .eq('id', creditNoteId)

  if (error) {
    throw new Error(`Erreur suppression avoir: ${error.message}`)
  }

  console.log(`Deleted credit note ${creditNoteId}`)
}

// ============ Preview Entries (for UI display) ============

export interface PreviewCreditNoteEntry {
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

  if (accountCode.startsWith('411')) {
    return customerName || 'Client'
  }

  if (accountCode.startsWith('512')) {
    return 'Banque'
  }

  if (accountCode.startsWith('7')) {
    return 'Produits divers'
  }

  return 'Compte'
}

/**
 * Preview credit note entries (without saving to database)
 */
export async function previewCreditNoteEntries(
  formData: CreditNoteFormData,
  customerId?: string
): Promise<PreviewCreditNoteEntry[]> {
  const chartOfAccounts = await loadChartOfAccounts()
  const avoirsJournal = await resolveJournal('credit_note')
  const year = new Date().getFullYear()
  const pieceNumber = `${avoirsJournal.code}${year}XXXXXX`

  // Resolve customer account code from chart of accounts
  const customerName = formData.customerName
  if (!customerName) {
    throw new Error('Nom du client requis pour la prévisualisation')
  }
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts)

  const entries: PreviewCreditNoteEntry[] = []
  const date = formData.date
  const label = `Avoir ${formData.customerName || 'CLIENT'} - ${formData.creditNoteNumber || 'N/A'}`

  // Group lines by accounting code
  const linesByAccount = new Map<string, { ht: number; vat: number }>()
  let totalHT = 0
  let totalVAT = 0

  for (const line of formData.lines) {
    const lineHT = line.quantity * line.unitPrice
    const vatRate = parseFloat(line.vatRate) / 100
    const lineVAT = lineHT * vatRate
    totalHT += lineHT
    totalVAT += lineVAT

    const accountCode = line.accountingCode || '706000'
    const existing = linesByAccount.get(accountCode) || { ht: 0, vat: 0 }
    existing.ht += lineHT
    existing.vat += lineVAT
    linesByAccount.set(accountCode, existing)
  }

  const totalTTC = totalHT + totalVAT

  // Entry: Debit product accounts (7xxx) = HT (reversed)
  for (const [accountCode, amounts] of linesByAccount) {
    entries.push({
      id: `preview-product-${accountCode}-${Date.now()}`,
      journal: avoirsJournal.code,
      pieceNumber,
      date,
      accountCode,
      accountLabel: getAccountLabel(accountCode),
      label,
      debit: Math.round(amounts.ht * 100) / 100,
      credit: 0,
    })
  }

  // Entry: Debit TVA collectee = TVA (reversed)
  if (totalVAT > 0) {
    const tvaCollectee = resolveByRole('TVA_COLLECTEE', chartOfAccounts)
    entries.push({
      id: `preview-tva-${Date.now()}`,
      journal: avoirsJournal.code,
      pieceNumber,
      date,
      accountCode: tvaCollectee.code,
      accountLabel: tvaCollectee.label,
      label,
      debit: Math.round(totalVAT * 100) / 100,
      credit: 0,
    })
  }

  // Entry: Credit customer account (411xxx) = TTC
  entries.push({
    id: `preview-customer-${Date.now()}`,
    journal: avoirsJournal.code,
    pieceNumber,
    date,
    accountCode: customerAccount.code,
    accountLabel: customerAccount.label,
    label,
    debit: 0,
    credit: Math.round(totalTTC * 100) / 100,
    lettrageType: 'tiers',
  })

  return entries
}

/**
 * Calculate totals from preview entries
 */
export function calculateCreditNoteEntryTotals(entries: PreviewCreditNoteEntry[]): {
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

// ============ Statistics ============

/**
 * Get credit note statistics for a period
 */
export async function getCreditNoteStats(
  startDate: string,
  endDate: string
): Promise<{
  totalHT: number
  totalTVA: number
  totalTTC: number
  count: number
  draftCount: number
  validatedCount: number
  appliedCount: number
  refundedCount: number
}> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select('total_ht, total_vat, total_ttc, status')
    .eq('company_id', COMPANY_ID)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) {
    console.error('Error fetching credit note stats:', error)
    throw new Error(`Erreur chargement statistiques: ${error.message}`)
  }

  if (!data) {
    console.error('getCreditNoteStats: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour credit notes')
  }

  const stats = {
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0,
    count: data.length,
    draftCount: 0,
    validatedCount: 0,
    appliedCount: 0,
    refundedCount: 0,
  }

  for (const cn of data) {
    stats.totalHT += cn.total_ht || 0
    stats.totalTVA += cn.total_vat || 0
    stats.totalTTC += cn.total_ttc || 0

    switch (cn.status) {
      case 'draft':
        stats.draftCount++
        break
      case 'validated':
        stats.validatedCount++
        break
      case 'applied':
        stats.appliedCount++
        break
      case 'refunded':
        stats.refundedCount++
        break
    }
  }

  return stats
}

/**
 * Get invoice remaining balance (after credit notes applied)
 */
export async function getInvoiceRemainingBalance(invoiceId: string): Promise<{
  originalAmount: number
  creditNotesApplied: number
  remainingBalance: number
}> {
  // Get invoice
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('total_ttc')
    .eq('id', invoiceId)
    .single()

  if (invError || !invoice) {
    throw new Error(`Facture non trouvee: ${invError?.message || 'ID invalide'}`)
  }

  // Get total credit notes applied
  const { data: applications, error: appError } = await supabase
    .from('credit_note_applications')
    .select('amount')
    .eq('invoice_id', invoiceId)

  if (appError) {
    throw new Error(`Erreur chargement imputations: ${appError.message}`)
  }

  const creditNotesApplied = (applications || []).reduce((sum, app) => sum + app.amount, 0)

  return {
    originalAmount: invoice.total_ttc,
    creditNotesApplied,
    remainingBalance: invoice.total_ttc - creditNotesApplied,
  }
}
