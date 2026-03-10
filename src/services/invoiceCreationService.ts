// Invoice Creation Service - Multi-line invoice creation with accounting entries
// Separated from venteService.ts per CLAUDE.md rule: max 500 lines per file

import { supabase, COMPANY_ID } from '../lib/supabase'
import type { Invoice, AccountingEntry, LettrageType } from '../types/database'
import type { CreateInvoiceFormData, InvoiceLineFormData, InvoiceLineTotals, InvoiceTotals } from '../types/invoiceForm'
import { resolveCustomerAccount, resolveByRole, resolveJournal } from './accountResolverService'
import { findOrCreateCustomer } from './venteService'

// ============ Calculations ============

/**
 * Calculate totals for a single invoice line
 */
export function calculateLineTotals(line: InvoiceLineFormData): InvoiceLineTotals {
  const discount = line.discountPercent ? line.discountPercent / 100 : 0
  const totalHT = Math.round(line.quantity * line.unitPriceHT * (1 - discount) * 100) / 100
  const vatRate = parseFloat(line.vatRate) / 100
  const totalVAT = Math.round(totalHT * vatRate * 100) / 100
  const totalTTC = Math.round((totalHT + totalVAT) * 100) / 100
  return { totalHT, totalVAT, totalTTC }
}

/**
 * Calculate invoice totals with VAT breakdown by rate
 */
export function calculateInvoiceTotals(lines: InvoiceLineFormData[]): InvoiceTotals {
  const vatMap = new Map<string, { base: number; amount: number }>()
  let totalHT = 0
  let totalVAT = 0

  for (const line of lines) {
    const lineTotals = calculateLineTotals(line)
    totalHT += lineTotals.totalHT
    totalVAT += lineTotals.totalVAT

    const existing = vatMap.get(line.vatRate) || { base: 0, amount: 0 }
    vatMap.set(line.vatRate, {
      base: existing.base + lineTotals.totalHT,
      amount: existing.amount + lineTotals.totalVAT,
    })
  }

  totalHT = Math.round(totalHT * 100) / 100
  totalVAT = Math.round(totalVAT * 100) / 100
  const totalTTC = Math.round((totalHT + totalVAT) * 100) / 100

  const vatBreakdown = Array.from(vatMap.entries())
    .map(([rate, { base, amount }]) => ({
      rate,
      base: Math.round(base * 100) / 100,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))

  return { totalHT, totalVAT, totalTTC, vatBreakdown }
}

// ============ Invoice Number Generation ============

/**
 * Generate next invoice number from invoice_settings
 * Format: {invoice_prefix}{year}-{invoice_next_number} (ex: F-2026-00001)
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()

  // Get invoice numbering config from invoice_settings
  const { data: settings, error: settingsError } = await supabase
    .from('invoice_settings')
    .select('invoice_prefix, invoice_next_number')
    .eq('company_id', COMPANY_ID)
    .single()

  if (settingsError) {
    console.error('Error fetching invoice settings:', settingsError)
    throw new Error(`Erreur recuperation config: ${settingsError.message}`)
  }

  if (!settings) {
    throw new Error('Configuration de numerotation introuvable')
  }

  const prefix = settings.invoice_prefix || 'F-'
  const nextNumber = settings.invoice_next_number || 1

  return `${prefix}${year}-${nextNumber.toString().padStart(5, '0')}`
}

/**
 * Increment invoice number in invoice_settings after successful creation
 */
export async function incrementInvoiceNumber(): Promise<void> {
  const { data: settings, error: fetchError } = await supabase
    .from('invoice_settings')
    .select('invoice_next_number')
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError) {
    console.error('Error fetching invoice settings for increment:', fetchError)
    throw new Error(`Erreur recuperation config: ${fetchError.message}`)
  }

  if (!settings) {
    throw new Error('Configuration de numerotation introuvable')
  }

  const nextNumber = (settings.invoice_next_number || 1) + 1

  const { error: updateError } = await supabase
    .from('invoice_settings')
    .update({ invoice_next_number: nextNumber })
    .eq('company_id', COMPANY_ID)

  if (updateError) {
    console.error('Error incrementing invoice number:', updateError)
    throw new Error(`Erreur increment numero facture: ${updateError.message}`)
  }

  console.log(`Invoice number incremented to ${nextNumber}`)
}

// ============ Piece Number Generation ============

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

// ============ Chart of Accounts Loader ============

async function loadChartOfAccounts() {
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

// ============ Main Creation Function ============

/**
 * Create a multi-line invoice with optional accounting entries
 * @param formData - Form data with lines
 * @param status - 'draft' (no entries) or 'sent' (with entries)
 */
export async function createInvoiceWithLines(
  formData: CreateInvoiceFormData,
  status: 'draft' | 'sent'
): Promise<Invoice> {
  // Validate
  if (!formData.customerName.trim()) {
    throw new Error('Le nom du client est requis')
  }
  if (!formData.invoiceNumber.trim()) {
    throw new Error('Le numero de facture est requis')
  }
  if (!formData.invoiceDate) {
    throw new Error('La date de facture est requise')
  }
  if (formData.lines.length === 0) {
    throw new Error('La facture doit contenir au moins une ligne')
  }

  // Validate each line
  for (let i = 0; i < formData.lines.length; i++) {
    const line = formData.lines[i]
    if (!line.description.trim()) {
      throw new Error(`Ligne ${i + 1}: la description est requise`)
    }
    if (line.quantity <= 0) {
      throw new Error(`Ligne ${i + 1}: la quantite doit etre superieure a 0`)
    }
    if (line.unitPriceHT < 0) {
      throw new Error(`Ligne ${i + 1}: le prix unitaire HT ne peut pas etre negatif`)
    }
  }

  const totals = calculateInvoiceTotals(formData.lines)

  // Find or create customer
  const customer = await findOrCreateCustomer(formData.customerName)

  // Insert invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: COMPANY_ID,
      third_party_id: customer.id,
      type: 'customer',
      number: formData.invoiceNumber,
      date: formData.invoiceDate,
      due_date: formData.dueDate || null,
      status,
      total_ht: totals.totalHT,
      total_vat: totals.totalVAT,
      total_ttc: totals.totalTTC,
      currency: formData.currency,
      notes: formData.description || null,
    })
    .select('*, third_party:third_parties(*)')
    .single()

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError)
    throw new Error(`Erreur creation facture: ${invoiceError.message}`)
  }

  // Insert invoice lines
  const lineRecords = formData.lines.map((line) => {
    const lt = calculateLineTotals(line)
    return {
      invoice_id: invoice.id,
      description: line.description.trim(),
      quantity: line.quantity,
      unit_price: line.unitPriceHT,
      vat_rate: parseFloat(line.vatRate),
      total_ht: lt.totalHT,
      total_vat: lt.totalVAT,
      total_ttc: lt.totalTTC,
      accounting_code: line.accountingCode || null,
    }
  })

  const { error: linesError } = await supabase
    .from('invoice_lines')
    .insert(lineRecords)

  if (linesError) {
    console.error('Error creating invoice lines:', linesError)
    throw new Error(`Erreur creation lignes facture: ${linesError.message}`)
  }

  // Generate accounting entries only for 'sent' status
  if (status === 'sent') {
    await generateMultiLineEntries(invoice, formData, totals)
  }

  console.log(`Created invoice ${invoice.number} (${status}) with ${formData.lines.length} lines`)

  // Increment invoice number in settings
  await incrementInvoiceNumber()

  return invoice
}

// ============ Multi-Line Accounting Entries ============

/**
 * Generate accounting entries aggregated by accounting code and VAT rate
 *
 * Debit  411xxx = total TTC (one entry for customer)
 * Credit 7xxxxx = HT per distinct accounting code
 * Credit 44571  = VAT per distinct rate
 */
async function generateMultiLineEntries(
  invoice: Invoice,
  formData: CreateInvoiceFormData,
  totals: InvoiceTotals
): Promise<AccountingEntry[]> {
  const chartOfAccounts = await loadChartOfAccounts()
  const salesJournal = await resolveJournal('sales')
  const pieceNumber = await generateSalesPieceNumber()

  const customerName = invoice.third_party?.name || formData.customerName
  if (!customerName) {
    throw new Error('Nom du client requis pour resoudre le compte client')
  }
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts)

  const date = invoice.date
  const label = `Facture ${customerName} - ${invoice.number}`

  const entries: Partial<AccountingEntry>[] = []

  // Entry 1: Debit customer account (411xxx) = TTC
  entries.push({
    company_id: COMPANY_ID,
    journal: salesJournal.code,
    date,
    piece_number: pieceNumber,
    label,
    account_code: customerAccount.code,
    debit: totals.totalTTC,
    credit: 0,
    linked_invoice_id: invoice.id,
    is_validated: false,
    lettrage_type: 'tiers' as LettrageType,
  })

  // Entries: Credit product accounts (7xxx) - aggregated by accounting code
  const htByCode = new Map<string, number>()
  for (const line of formData.lines) {
    const code = line.accountingCode || '706000'
    const lt = calculateLineTotals(line)
    htByCode.set(code, (htByCode.get(code) || 0) + lt.totalHT)
  }

  for (const [code, ht] of htByCode) {
    entries.push({
      company_id: COMPANY_ID,
      journal: salesJournal.code,
      date,
      piece_number: pieceNumber,
      label,
      account_code: code,
      debit: 0,
      credit: Math.round(ht * 100) / 100,
      linked_invoice_id: invoice.id,
      is_validated: false,
    })
  }

  // Entries: Credit TVA collectee - aggregated by rate
  for (const vat of totals.vatBreakdown) {
    if (vat.amount > 0) {
      const tvaCollectee = resolveByRole('TVA_COLLECTEE', chartOfAccounts)
      entries.push({
        company_id: COMPANY_ID,
        journal: salesJournal.code,
        date,
        piece_number: pieceNumber,
        label,
        account_code: tvaCollectee.code,
        debit: 0,
        credit: vat.amount,
        linked_invoice_id: invoice.id,
        is_validated: false,
      })
    }
  }

  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating multi-line sales entries:', error)
    throw new Error(`Erreur creation ecritures ventes multi-lignes: ${error.message}`)
  }

  console.log(`Created ${data.length} accounting entries for invoice ${invoice.number}`)
  return data
}
