// Accounting Service - Generate accounting entries (PCG French standard)
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { AccountingEntry, InvoiceFormData, Invoice, LettrageType, ChartOfAccount } from '../types/database'
import { determineLettrageType, isLettrageComplete } from '../utils/lettrageColors'
import { convertAmountWithRate } from './exchangeRateService'
import {
  ROLE_PREFIX,
  resolveByPrefix,
  resolveSupplierAccount,
  resolveLabel,
  resolveBankAccount,
  resolveJournal,
} from './accountResolverService'

// ============ Constants ============

// Journal codes - resolved dynamically from accounting_journals table
// Async helpers exported for external consumers migrating off the old constants
export async function getJournalAchats(): Promise<string> {
  return (await resolveJournal('purchase')).code
}
export async function getJournalBanque(): Promise<string> {
  return (await resolveJournal('bank')).code
}
export async function getJournalOD(): Promise<string> {
  return (await resolveJournal('misc')).code
}
export async function getJournalRT(): Promise<string> {
  return (await resolveJournal('recovery')).code
}

// PCG role prefix aliases - used in regularization functions for DB queries
// These are NOT account codes, just search prefixes to find real codes in chart_of_accounts
const ACCOUNT_CCA = ROLE_PREFIX.CCA
const ACCOUNT_FNP = ROLE_PREFIX.FNP
const ACCOUNT_TVA_FNP = ROLE_PREFIX.TVA_FNP
const ACCOUNT_PCA = ROLE_PREFIX.PCA
const ACCOUNT_AAR = ROLE_PREFIX.AAR

// ============ CCA & FNP Types ============

export interface CCAConfig {
  startDate: string      // Début période CCA
  endDate: string        // Fin période CCA
  amount: number         // Montant à étaler
  closingDate: string    // Date de clôture pour calcul prorata
}

export interface FNPFormData {
  thirdPartyName: string
  thirdPartyId?: string
  description: string
  accountingCode: string  // Compte charge 6xxx
  estimatedHT: number
  estimatedTVA: number
  estimatedTTC: number
  vatRate: string
  closingDate: string     // Date de clôture
}

// ============ PCA Types (Produits Constatés d'Avance) ============

export interface PCAConfig {
  startDate: string      // Début période du produit
  endDate: string        // Fin période du produit
  amount: number         // Montant à étaler
  closingDate: string    // Date de clôture pour calcul prorata
}

export interface PCAFormData {
  thirdPartyName: string
  thirdPartyId?: string
  description: string
  productAccountCode: string  // Compte produit 7xxx
  amount: number
  startDate: string
  endDate: string
  closingDate: string
}

// ============ AAR Types (Avoirs À Recevoir) ============

export interface AARFormData {
  supplierName: string
  supplierId?: string
  description: string
  purchaseAccountCode: string  // Compte charge 6xxx
  expectedHT: number
  expectedTVA: number
  expectedTTC: number
  vatRate: string
  closingDate: string
}

// ============ Regularization Entry Result ============

export interface RegularizationEntries {
  closingEntries: PreviewEntry[]      // Écritures à la clôture
  reversalEntries: PreviewEntry[]     // Contre-passation au 01/01/N+1
  closingDate: string
  reversalDate: string
  totalAmount: number
}

// ============ Preview Entry Type (for UI display before saving) ============

export interface PreviewEntry {
  id: string  // Temporary ID for React keys
  journal: string
  pieceNumber: string
  date: string
  accountCode: string
  accountLabel: string  // Account name for display
  label: string
  debit: number
  credit: number
  lettrageCode?: string
  lettrageType?: LettrageType
  isAutoliquidation?: boolean
}

// ============ Preview Entries Generation (for UI display) ============

/**
 * Parse VAT rate from string format
 */
function parseVatRate(vatRate: string): { rate: number; isAutoliquidated: boolean } {
  if (vatRate.startsWith('autoliq-')) {
    const rate = parseFloat(vatRate.replace('autoliq-', ''))
    return { rate: rate / 100, isAutoliquidated: true }
  }
  const rate = parseFloat(vatRate)
  return { rate: rate / 100, isAutoliquidated: false }
}

/**
 * Generate a temporary piece number for preview
 */
function generateTempPieceNumber(_journal: string): string {
  return Math.random().toString(36).substring(2, 12).toUpperCase()
}

/**
 * Get account label from chart of accounts (database lookup).
 * Uses resolveLabel from accountResolverService for DB-backed resolution.
 *
 * @param chartOfAccounts Chart of accounts from DB (required for accurate labels)
 */
export function getAccountLabel(
  accountCode: string,
  chartOfAccounts: ChartOfAccount[],
  thirdPartyName?: string
): string {
  return resolveLabel(accountCode, chartOfAccounts, thirdPartyName)
}

/**
 * Preview invoice entries (without saving to database)
 * Used to display entries in the form before user validates
 *
 * Si la devise !== EUR et exchangeRate fourni, tous les montants
 * sont convertis en EUR pour les écritures comptables.
 */
export async function previewInvoiceEntries(
  formData: InvoiceFormData,
  _thirdPartyId?: string,
  chartOfAccounts?: ChartOfAccount[]
): Promise<PreviewEntry[]> {
  if (!chartOfAccounts || chartOfAccounts.length === 0) {
    console.error('previewInvoiceEntries: chartOfAccounts is required')
    throw new Error('Le plan comptable est requis pour générer les écritures. Chargez les paramètres.')
  }

  const journalAchats = (await resolveJournal('purchase')).code
  const { rate: vatRateDecimal, isAutoliquidated } = parseVatRate(formData.vatRate)
  const pieceNumber = generateTempPieceNumber(journalAchats)

  // Resolve supplier account from chart_of_accounts by name
  const supplier = resolveSupplierAccount(formData.thirdPartyName || 'FOURNISSEUR', chartOfAccounts)

  const entries: PreviewEntry[] = []
  const date = formData.invoiceDate
  const label = formData.entryLabel || `Facture ${formData.thirdPartyName || 'FOURNISSEUR'} - ${formData.invoiceNumber || 'N/A'}`

  // Conversion EUR: si devise étrangère avec taux de change
  const needsConversion = formData.currency !== 'EUR' && formData.exchangeRate && formData.exchangeRate > 0
  const rate = needsConversion ? formData.exchangeRate! : 1

  // Montants en EUR (convertis si nécessaire)
  const htEUR = needsConversion ? convertAmountWithRate(formData.totalHT, rate) : formData.totalHT

  // Calcul TVA
  const tvaDeductible = isAutoliquidated
    ? Math.round(htEUR * vatRateDecimal * 100) / 100
    : (needsConversion ? convertAmountWithRate(formData.totalVAT, rate) : formData.totalVAT)

  // Resolve charge account from chart_of_accounts (resolves short code like '6157' to full code '615700000')
  const chargeCodeInput = formData.accountingCode
  if (!chargeCodeInput) {
    console.error('previewInvoiceEntries: accountingCode is required')
    throw new Error('Le code de compte de charge est requis.')
  }
  const chargeAccount = resolveByPrefix(chargeCodeInput, chartOfAccounts)
  const chargeCode = chargeAccount.code
  const chargeLabel = chargeAccount.label

  const supplierCredit = isAutoliquidated ? htEUR : (needsConversion ? convertAmountWithRate(formData.totalTTC, rate) : formData.totalTTC)

  // Resolve TVA accounts from chart_of_accounts
  const tvaDeductAccount = isAutoliquidated
    ? resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE_ENCAISS, chartOfAccounts)
    : resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE, chartOfAccounts)
  const tvaCollectAccount = resolveByPrefix(ROLE_PREFIX.TVA_COLLECTEE_ENCAISS, chartOfAccounts)

  // Ordre Pennylane: TVA déductible, Charge, Fournisseur, TVA collectée

  // Entry 1: Debit TVA déductible
  if (tvaDeductible > 0) {
    entries.push({
      id: `preview-tva-deduct-${Date.now()}`,
      journal: journalAchats,
      pieceNumber,
      date,
      accountCode: tvaDeductAccount.code,
      accountLabel: tvaDeductAccount.label,
      label,
      debit: tvaDeductible,
      credit: 0,
      lettrageCode: isAutoliquidated ? 'A' : undefined,
      lettrageType: isAutoliquidated ? 'autoliquidation' : undefined,
      isAutoliquidation: isAutoliquidated,
    })
  }

  // Entry 2: Debit charge account (6xxx) = HT en EUR
  entries.push({
    id: `preview-charge-${Date.now()}`,
    journal: journalAchats,
    pieceNumber,
    date,
    accountCode: chargeCode,
    accountLabel: chargeLabel,
    label,
    debit: htEUR,
    credit: 0,
    isAutoliquidation: isAutoliquidated,
  })

  // Entry 3: Credit supplier account (401xxx)
  entries.push({
    id: `preview-supplier-${Date.now()}`,
    journal: journalAchats,
    pieceNumber,
    date,
    accountCode: supplier.code,
    accountLabel: supplier.label,
    label,
    debit: 0,
    credit: supplierCredit,
    lettrageCode: 'A',
    lettrageType: 'tiers',
  })

  // Entry 4: Autoliquidation - TVA collectée
  if (isAutoliquidated && tvaDeductible > 0) {
    entries.push({
      id: `preview-tva-collect-${Date.now()}`,
      journal: journalAchats,
      pieceNumber,
      date,
      accountCode: tvaCollectAccount.code,
      accountLabel: tvaCollectAccount.label,
      label,
      debit: 0,
      credit: tvaDeductible,
      lettrageCode: 'A',
      lettrageType: 'autoliquidation',
      isAutoliquidation: true,
    })
  }

  return entries
}

/**
 * Preview payment entries (without saving to database)
 *
 * Si devise étrangère: le montant fournisseur (401) = HT_EUR au taux facture,
 * le montant banque (512) = montant réel prélevé (EUR, = transaction.montant).
 * La différence va en 4716 (écart de conversion).
 *
 * @param bankTransactionAmountEUR Montant réel prélevé en EUR (abs(transaction.amount))
 */
export async function previewPaymentEntries(
  formData: InvoiceFormData,
  transactionLabel: string,
  bankAccountName: string = 'CIC',
  _thirdPartyId?: string,
  bankTransactionAmountEUR?: number,
  transactionDate?: string,
  chartOfAccounts?: ChartOfAccount[]
): Promise<PreviewEntry[]> {
  if (!chartOfAccounts || chartOfAccounts.length === 0) {
    console.error('previewPaymentEntries: chartOfAccounts is required')
    throw new Error('Le plan comptable est requis pour générer les écritures de paiement.')
  }

  const journalBanque = (await resolveJournal('bank')).code
  const pieceNumber = generateTempPieceNumber(journalBanque)

  // Resolve all accounts from chart_of_accounts
  const supplier = resolveSupplierAccount(formData.thirdPartyName || 'FOURNISSEUR', chartOfAccounts)
  const ecartAccount = resolveByPrefix(ROLE_PREFIX.ECART_CONVERSION, chartOfAccounts)
  const bankAccount = resolveBankAccount(bankAccountName, chartOfAccounts)

  // BQ: date du paiement (transaction bancaire), pas date facture
  const date = transactionDate || formData.invoiceDate
  const label = transactionLabel || `Règlement ${formData.thirdPartyName || 'FOURNISSEUR'}`

  const { isAutoliquidated } = parseVatRate(formData.vatRate)

  // Conversion EUR
  const needsConversion = formData.currency !== 'EUR' && formData.exchangeRate && formData.exchangeRate > 0
  const rate = needsConversion ? formData.exchangeRate! : 1

  // Montant dû au fournisseur en EUR (au taux de la facture)
  const invoiceAmountDevise = isAutoliquidated ? formData.totalHT : formData.totalTTC
  const supplierAmountEUR = needsConversion ? convertAmountWithRate(invoiceAmountDevise, rate) : invoiceAmountDevise

  // Montant réel prélevé par la banque (en EUR)
  const bankAmountEUR = bankTransactionAmountEUR ?? supplierAmountEUR

  // Écart de change
  const ecartChange = Math.round((bankAmountEUR - supplierAmountEUR) * 100) / 100

  const entries: PreviewEntry[] = [
    // Entry 1: Debit supplier account (401xxx)
    {
      id: `preview-payment-supplier-${Date.now()}`,
      journal: journalBanque,
      pieceNumber,
      date,
      accountCode: supplier.code,
      accountLabel: supplier.label,
      label,
      debit: supplierAmountEUR,
      credit: 0,
      lettrageCode: 'A',
      lettrageType: 'tiers',
    },
  ]

  // Entry 2 (optionnel): Écart de conversion si montants différents
  if (Math.abs(ecartChange) >= 0.01) {
    entries.push({
      id: `preview-payment-ecart-${Date.now()}`,
      journal: journalBanque,
      pieceNumber,
      date,
      accountCode: ecartAccount.code,
      accountLabel: ecartAccount.label,
      label,
      debit: ecartChange > 0 ? ecartChange : 0,
      credit: ecartChange < 0 ? Math.abs(ecartChange) : 0,
    })
  }

  // Entry 3: Credit bank account (512xxx)
  entries.push({
    id: `preview-payment-bank-${Date.now()}`,
    journal: journalBanque,
    pieceNumber,
    date,
    accountCode: bankAccount.code,
    accountLabel: bankAccount.label,
    label,
    debit: 0,
    credit: bankAmountEUR,
  })

  return entries
}

/**
 * Calculate totals from preview entries
 */
export function calculateEntryTotals(entries: PreviewEntry[]): { debit: number; credit: number; balanced: boolean } {
  const debit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const credit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)
  return {
    debit,
    credit,
    balanced: Math.abs(debit - credit) < 0.01,
  }
}

// ============ RT Entries (Récupération TVA sur encaissements) ============

/**
 * Preview RT entries (sans sauvegarder en BDD)
 * Générées quand une facture autoliquidée est réconciliée (paiement constaté)
 *
 * Journal RT - 4 écritures :
 *   Débit  44566 (TVA déductible autoliq 20%)     = TVA_EUR
 *   Débit  44574 (TVA collectée encaissements)     = TVA_EUR
 *   Crédit 44530 (TVA due autoliquidation)         = TVA_EUR
 *   Crédit 44564 (TVA déductible encaissements)    = TVA_EUR
 */
export async function previewRTEntries(
  formData: InvoiceFormData,
  chartOfAccounts?: ChartOfAccount[],
  transactionDate?: string,
  transactionLabel?: string
): Promise<PreviewEntry[]> {
  const { rate: vatRateDecimal, isAutoliquidated } = parseVatRate(formData.vatRate)

  // RT entries only for autoliquidated invoices
  if (!isAutoliquidated) return []

  if (!chartOfAccounts || chartOfAccounts.length === 0) {
    console.error('previewRTEntries: chartOfAccounts is required')
    throw new Error('Le plan comptable est requis pour les écritures RT.')
  }

  const journalRT = (await resolveJournal('recovery')).code
  const pieceNumber = generateTempPieceNumber(journalRT)
  // RT: date du paiement (transaction bancaire), pas date facture
  const date = transactionDate || formData.invoiceDate
  // RT: label = libellé de la transaction bancaire (comme Pennylane)
  const label = transactionLabel || formData.entryLabel || `${formData.thirdPartyName || 'FOURNISSEUR'} - ${formData.invoiceNumber || 'N/A'}`

  // Montant HT en EUR
  const needsConversion = formData.currency !== 'EUR' && formData.exchangeRate && formData.exchangeRate > 0
  const rate = needsConversion ? formData.exchangeRate! : 1
  const htEUR = needsConversion ? convertAmountWithRate(formData.totalHT, rate) : formData.totalHT
  const tvaEUR = Math.round(htEUR * vatRateDecimal * 100) / 100

  if (tvaEUR <= 0) return []

  // Resolve all RT accounts from chart_of_accounts
  const tvaDeductAutoliq = resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE_AUTOLIQ, chartOfAccounts)
  const tvaCollectEncaiss = resolveByPrefix(ROLE_PREFIX.TVA_COLLECTEE_ENCAISS, chartOfAccounts)
  const tvaDueAutoliq = resolveByPrefix(ROLE_PREFIX.TVA_DUE_AUTOLIQ, chartOfAccounts)
  const tvaDeductEncaiss = resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE_ENCAISS, chartOfAccounts)

  return [
    // Débit TVA déductible autoliquidée (445663xxx)
    {
      id: `preview-rt-tva-deduct-${Date.now()}`,
      journal: journalRT,
      pieceNumber,
      date,
      accountCode: tvaDeductAutoliq.code,
      accountLabel: tvaDeductAutoliq.label,
      label,
      debit: tvaEUR,
      credit: 0,
      lettrageType: 'tva_encaissement',
    },
    // Débit TVA collectée encaissements (44574xxx) - transfert
    {
      id: `preview-rt-tva-coll-encaiss-${Date.now()}`,
      journal: journalRT,
      pieceNumber,
      date,
      accountCode: tvaCollectEncaiss.code,
      accountLabel: tvaCollectEncaiss.label,
      label,
      debit: tvaEUR,
      credit: 0,
      lettrageType: 'tva_encaissement',
    },
    // Crédit TVA due autoliquidée (44530xxx)
    {
      id: `preview-rt-tva-due-${Date.now()}`,
      journal: journalRT,
      pieceNumber,
      date,
      accountCode: tvaDueAutoliq.code,
      accountLabel: tvaDueAutoliq.label,
      label,
      debit: 0,
      credit: tvaEUR,
      lettrageType: 'tva_encaissement',
    },
    // Crédit TVA déductible encaissements (44564xxx) - transfert
    {
      id: `preview-rt-tva-deduct-encaiss-${Date.now()}`,
      journal: journalRT,
      pieceNumber,
      date,
      accountCode: tvaDeductEncaiss.code,
      accountLabel: tvaDeductEncaiss.label,
      label,
      debit: 0,
      credit: tvaEUR,
      lettrageType: 'tva_encaissement',
    },
  ]
}

/**
 * Generate RT entries in database (called on reconciliation of autoliquidated invoice)
 */
export async function generateRTEntries(
  invoice: Invoice,
  formData: InvoiceFormData,
  transactionDate?: string,
  transactionLabel?: string,
  chartOfAccounts?: ChartOfAccount[]
): Promise<AccountingEntry[]> {
  const { rate: vatRateDecimal, isAutoliquidated } = parseVatRate(formData.vatRate)

  if (!isAutoliquidated) return []

  if (!chartOfAccounts || chartOfAccounts.length === 0) {
    const { data: accounts, error: fetchErr } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
    if (fetchErr || !accounts) {
      throw new Error(`Erreur chargement plan comptable: ${fetchErr?.message}`)
    }
    chartOfAccounts = accounts
  }

  // Montant HT en EUR
  const needsConversion = formData.currency !== 'EUR' && formData.exchangeRate && formData.exchangeRate > 0
  const rate = needsConversion ? formData.exchangeRate! : 1
  const htEUR = needsConversion ? convertAmountWithRate(formData.totalHT, rate) : formData.totalHT
  const tvaEUR = Math.round(htEUR * vatRateDecimal * 100) / 100

  if (tvaEUR <= 0) return []

  // Resolve all RT accounts from chart_of_accounts
  const tvaDeductAutoliq = resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE_AUTOLIQ, chartOfAccounts)
  const tvaCollectEncaiss = resolveByPrefix(ROLE_PREFIX.TVA_COLLECTEE_ENCAISS, chartOfAccounts)
  const tvaDueAutoliq = resolveByPrefix(ROLE_PREFIX.TVA_DUE_AUTOLIQ, chartOfAccounts)
  const tvaDeductEncaiss = resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE_ENCAISS, chartOfAccounts)

  const journalRT = (await resolveJournal('recovery')).code
  const pieceNumber = await generatePieceNumber(journalRT)
  const date = transactionDate || invoice.date
  const label = transactionLabel || `${invoice.third_party?.name || 'FOURNISSEUR'} - ${invoice.number}`

  const entries: Partial<AccountingEntry>[] = [
    {
      company_id: COMPANY_ID,
      journal: journalRT,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaDeductAutoliq.code,
      debit: tvaEUR,
      credit: 0,
      linked_invoice_id: invoice.id,
      is_validated: false,
      lettrage_type: 'tva_encaissement',
    },
    {
      company_id: COMPANY_ID,
      journal: journalRT,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaCollectEncaiss.code,
      debit: tvaEUR,
      credit: 0,
      linked_invoice_id: invoice.id,
      is_validated: false,
      lettrage_type: 'tva_encaissement',
    },
    {
      company_id: COMPANY_ID,
      journal: journalRT,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaDueAutoliq.code,
      debit: 0,
      credit: tvaEUR,
      linked_invoice_id: invoice.id,
      is_validated: false,
      lettrage_type: 'tva_encaissement',
    },
    {
      company_id: COMPANY_ID,
      journal: journalRT,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaDeductEncaiss.code,
      debit: 0,
      credit: tvaEUR,
      linked_invoice_id: invoice.id,
      is_validated: false,
      lettrage_type: 'tva_encaissement',
    },
  ]

  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating RT entries:', error)
    throw new Error(`Erreur création écritures RT: ${error.message}`)
  }

  console.log(`Created ${data.length} RT entries for invoice ${invoice.number}`)
  return data
}

// ============ Piece Number Generation ============

/**
 * Generate unique piece number for journal
 * Format: JJ2025000001
 */
export async function generatePieceNumber(journal: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${journal}${year}`

  // Get last piece number for this journal/year
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('piece_number')
    .eq('company_id', COMPANY_ID)
    .like('piece_number', `${prefix}%`)
    .order('piece_number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching last piece number:', error)
    throw new Error(`Erreur génération numéro pièce: ${error.message}`)
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

// ============ Invoice Entries Generation (Database Persistence) ============

/**
 * Generate accounting entries for a supplier invoice (facture fournisseur)
 *
 * Standard entries:
 *   Debit  6xxx (charge)        = HT
 *   Debit  44566 (TVA déduct.)  = TVA
 *   Credit 401xxx (fournisseur) = TTC
 *
 * If autoliquidated (TVA autoliquidée), add:
 *   Debit  44566 (TVA déduct.)  = TVA
 *   Credit 44571 (TVA collectée) = TVA
 */
export async function generateInvoiceEntries(
  invoice: Invoice,
  formData: InvoiceFormData,
  chartOfAccounts?: ChartOfAccount[]
): Promise<AccountingEntry[]> {
  if (!chartOfAccounts || chartOfAccounts.length === 0) {
    const { data: accounts, error: fetchErr } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
    if (fetchErr || !accounts) {
      throw new Error(`Erreur chargement plan comptable: ${fetchErr?.message}`)
    }
    chartOfAccounts = accounts
  }

  const journalAchats = (await resolveJournal('purchase')).code
  const pieceNumber = await generatePieceNumber(journalAchats)
  const { rate: vatRateDecimal, isAutoliquidated } = parseVatRate(formData.vatRate)

  // Resolve supplier account from chart_of_accounts by name
  const supplier = resolveSupplierAccount(
    invoice.third_party?.name || formData.thirdPartyName || 'FOURNISSEUR',
    chartOfAccounts
  )

  const entries: Partial<AccountingEntry>[] = []
  const date = invoice.date
  const label = formData.entryLabel || `Facture ${invoice.third_party?.name || 'FOURNISSEUR'} - ${invoice.number}`

  // Conversion EUR si devise étrangère
  const needsConversion = formData.currency !== 'EUR' && formData.exchangeRate && formData.exchangeRate > 0
  const rate = needsConversion ? formData.exchangeRate! : 1
  const htEUR = needsConversion ? convertAmountWithRate(formData.totalHT, rate) : formData.totalHT

  // TVA calculée sur montant EUR
  const tvaDeductible = isAutoliquidated
    ? Math.round(htEUR * vatRateDecimal * 100) / 100
    : (needsConversion ? convertAmountWithRate(formData.totalVAT, rate) : formData.totalVAT)

  // Resolve TVA accounts from chart_of_accounts
  const tvaDeductAccount = isAutoliquidated
    ? resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE_ENCAISS, chartOfAccounts)
    : resolveByPrefix(ROLE_PREFIX.TVA_DEDUCTIBLE, chartOfAccounts)
  const tvaCollectAccount = resolveByPrefix(ROLE_PREFIX.TVA_COLLECTEE_ENCAISS, chartOfAccounts)

  // Resolve charge account from chart_of_accounts (short code → full code)
  const chargeCodeInput = formData.accountingCode
  if (!chargeCodeInput) {
    throw new Error('Le code de compte de charge est requis pour générer les écritures.')
  }
  const chargeAccount = resolveByPrefix(chargeCodeInput, chartOfAccounts)
  const chargeCode = chargeAccount.code

  // Ordre Pennylane: TVA déductible, Charge, Fournisseur, TVA collectée

  // Entry 1: Debit TVA déductible
  if (tvaDeductible > 0) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalAchats,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaDeductAccount.code,
      debit: tvaDeductible,
      credit: 0,
      linked_invoice_id: invoice.id,
      is_validated: false,
    })
  }

  // Entry 2: Debit charge account (6xxx) = HT en EUR
  entries.push({
    company_id: COMPANY_ID,
    journal: journalAchats,
    date,
    piece_number: pieceNumber,
    label,
    account_code: chargeCode,
    debit: htEUR,
    credit: 0,
    linked_invoice_id: invoice.id,
    is_validated: false,
  })

  // Entry 3: Credit supplier account (401xxx) en EUR
  const supplierCredit = isAutoliquidated ? htEUR : (needsConversion ? convertAmountWithRate(formData.totalTTC, rate) : formData.totalTTC)
  entries.push({
    company_id: COMPANY_ID,
    journal: journalAchats,
    date,
    piece_number: pieceNumber,
    label,
    account_code: supplier.code,
    debit: 0,
    credit: supplierCredit,
    linked_invoice_id: invoice.id,
    is_validated: false,
  })

  // Entry 4: Autoliquidation - Credit TVA collectée
  if (isAutoliquidated && tvaDeductible > 0) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalAchats,
      date,
      piece_number: pieceNumber,
      label,
      account_code: tvaCollectAccount.code,
      debit: 0,
      credit: tvaDeductible,
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
    console.error('Error creating accounting entries:', error)
    throw new Error(`Erreur création écritures comptables: ${error.message}`)
  }

  console.log(`Created ${data.length} accounting entries for invoice ${invoice.number}`)
  return data
}

// ============ Payment Entries Generation ============

/**
 * Generate accounting entries for invoice payment
 *
 * Payment entries:
 *   Debit  401xxx (fournisseur) = TTC
 *   Credit 512xxx (banque)      = TTC
 */
/**
 * Generate payment entries with exchange rate difference handling.
 *
 * @param bankTransactionAmountEUR Montant réel prélevé en EUR (abs(transaction.amount))
 * @param formData Form data with exchangeRate for multi-currency support
 */
export async function generatePaymentEntries(
  invoice: Invoice,
  transactionId: string,
  bankAccountName: string = 'CIC',
  bankTransactionAmountEUR?: number,
  formData?: InvoiceFormData,
  transactionDate?: string,
  chartOfAccounts?: ChartOfAccount[]
): Promise<AccountingEntry[]> {
  if (!chartOfAccounts || chartOfAccounts.length === 0) {
    const { data: accounts, error: fetchErr } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
    if (fetchErr || !accounts) {
      throw new Error(`Erreur chargement plan comptable: ${fetchErr?.message}`)
    }
    chartOfAccounts = accounts
  }

  const journalBanque = (await resolveJournal('bank')).code
  const pieceNumber = await generatePieceNumber(journalBanque)

  // Resolve all accounts from chart_of_accounts
  const supplier = resolveSupplierAccount(
    invoice.third_party?.name || formData?.thirdPartyName || 'FOURNISSEUR',
    chartOfAccounts
  )
  const ecartAccount = resolveByPrefix(ROLE_PREFIX.ECART_CONVERSION, chartOfAccounts)
  const bankAccount = resolveBankAccount(bankAccountName, chartOfAccounts)

  // BQ: date du paiement (transaction bancaire), pas date facture
  const date = transactionDate || invoice.date
  const label = `Règlement facture ${invoice.third_party?.name || 'FOURNISSEUR'} - ${invoice.number}`

  // Montant fournisseur en EUR (au taux de la facture)
  const needsConversion = formData && formData.currency !== 'EUR' && formData.exchangeRate && formData.exchangeRate > 0
  const rate = needsConversion ? formData!.exchangeRate! : 1

  // Déterminer si autoliquidé
  const isAutoliquidated = formData ? parseVatRate(formData.vatRate).isAutoliquidated : false
  const invoiceAmountDevise = isAutoliquidated ? invoice.total_ht : invoice.total_ttc
  const supplierAmountEUR = needsConversion ? convertAmountWithRate(invoiceAmountDevise, rate) : invoiceAmountDevise

  // Montant réel banque
  const bankAmountEUR = bankTransactionAmountEUR ?? supplierAmountEUR
  const ecartChange = Math.round((bankAmountEUR - supplierAmountEUR) * 100) / 100

  const entries: Partial<AccountingEntry>[] = [
    // Entry 1: Debit supplier account (401xxx)
    {
      company_id: COMPANY_ID,
      journal: journalBanque,
      date,
      piece_number: pieceNumber,
      label,
      account_code: supplier.code,
      debit: supplierAmountEUR,
      credit: 0,
      linked_invoice_id: invoice.id,
      linked_transaction_id: transactionId,
      is_validated: false,
    },
  ]

  // Entry 2 (optional): Écart de conversion
  if (Math.abs(ecartChange) >= 0.01) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalBanque,
      date,
      piece_number: pieceNumber,
      label,
      account_code: ecartAccount.code,
      debit: ecartChange > 0 ? ecartChange : 0,
      credit: ecartChange < 0 ? Math.abs(ecartChange) : 0,
      linked_invoice_id: invoice.id,
      linked_transaction_id: transactionId,
      is_validated: false,
    })
  }

  // Entry 3: Credit bank account (512xxx)
  entries.push({
    company_id: COMPANY_ID,
    journal: journalBanque,
    date,
    piece_number: pieceNumber,
    label,
    account_code: bankAccount.code,
    debit: 0,
    credit: bankAmountEUR,
    linked_invoice_id: invoice.id,
    linked_transaction_id: transactionId,
    is_validated: false,
  })

  // Insert entries
  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating payment entries:', error)
    throw new Error(`Erreur création écritures règlement: ${error.message}`)
  }

  console.log(`Created ${data.length} payment entries for invoice ${invoice.number}`)
  return data
}

// ============ Validation ============

/**
 * Verify that entries are balanced (total debit = total credit)
 */
export function verifyEntriesBalance(entries: AccountingEntry[]): boolean {
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)

  // Allow small floating point differences (< 0.01)
  return Math.abs(totalDebit - totalCredit) < 0.01
}

/**
 * Get entries by piece number
 */
export async function getEntriesByPieceNumber(pieceNumber: string): Promise<AccountingEntry[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('piece_number', pieceNumber)
    .order('account_code')

  if (error) {
    console.error('Error fetching entries:', error)
    throw new Error(`Erreur chargement écritures: ${error.message}`)
  }

  if (!data) {
    console.error('getEntriesByPieceNumber: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour accounting entries')
  }

  return data
}

/**
 * Get entries by invoice ID
 */
export async function getEntriesByInvoice(invoiceId: string): Promise<AccountingEntry[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('linked_invoice_id', invoiceId)
    .order('piece_number')
    .order('account_code')

  if (error) {
    console.error('Error fetching entries:', error)
    throw new Error(`Erreur chargement écritures: ${error.message}`)
  }

  if (!data) {
    console.error('getEntriesByInvoice: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour invoice entries')
  }

  return data
}

// ============ Lettrage (Matching) Functions ============

/**
 * Get next lettrage code for an account
 */
export async function getNextLettrageCode(accountCode: string): Promise<string> {
  // Try to use the database function if available
  const { data, error } = await supabase
    .rpc('get_next_lettrage_code', {
      p_company_id: COMPANY_ID,
      p_account_code: accountCode,
    })

  if (error) {
    // Fallback: generate locally by finding max code
    console.warn('get_next_lettrage_code RPC not available, using fallback')
    return getNextLettrageCodeFallback(accountCode)
  }

  return data
}

/**
 * Fallback method to get next lettrage code
 */
async function getNextLettrageCodeFallback(accountCode: string): Promise<string> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('lettrage_code')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', accountCode)
    .not('lettrage_code', 'is', null)
    .order('lettrage_code', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching lettrage codes:', error)
    return 'A'
  }

  if (!data || data.length === 0 || !data[0].lettrage_code) {
    return 'A'
  }

  return incrementLettrageCode(data[0].lettrage_code)
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

/**
 * Letter multiple entries together
 */
export async function letterEntries(
  entryIds: string[],
  lettrageType?: LettrageType
): Promise<{ code: string; entries: AccountingEntry[] }> {
  if (entryIds.length < 2) {
    throw new Error('Au moins 2 écritures sont nécessaires pour le lettrage')
  }

  // Get the entries to verify they can be lettered
  const { data: entries, error: fetchError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .in('id', entryIds)

  if (fetchError || !entries) {
    throw new Error(`Erreur chargement écritures: ${fetchError?.message}`)
  }

  // Verify all entries are for the same account
  const accountCodes = new Set(entries.map(e => e.account_code))
  if (accountCodes.size !== 1) {
    throw new Error('Toutes les écritures doivent être sur le même compte')
  }

  const accountCode = entries[0].account_code

  // Determine lettrage type if not provided
  const type = lettrageType || determineLettrageType(
    accountCode,
    entries[0].journal,
    entries[0].label
  )

  // Check if lettrage is complete (balanced)
  const complete = isLettrageComplete(entries)

  // Get next lettrage code
  const code = await getNextLettrageCode(accountCode)

  // Update entries with lettrage info
  const { data: updated, error: updateError } = await supabase
    .from('accounting_entries')
    .update({
      lettrage_code: code,
      lettrage_date: new Date().toISOString(),
      lettrage_type: type,
    })
    .eq('company_id', COMPANY_ID)
    .in('id', entryIds)
    .select()

  if (updateError) {
    throw new Error(`Erreur mise à jour lettrage: ${updateError.message}`)
  }

  console.log(`Lettered ${updated.length} entries with code ${code} (${complete ? 'complete' : 'partial'})`)

  return { code, entries: updated }
}

/**
 * Unletter entries (remove lettrage)
 */
export async function unletterEntries(lettrageCode: string, accountCode: string): Promise<void> {
  const { error } = await supabase
    .from('accounting_entries')
    .update({
      lettrage_code: null,
      lettrage_date: null,
      lettrage_type: null,
    })
    .eq('company_id', COMPANY_ID)
    .eq('account_code', accountCode)
    .eq('lettrage_code', lettrageCode)

  if (error) {
    throw new Error(`Erreur suppression lettrage: ${error.message}`)
  }

  console.log(`Unlettered entries with code ${lettrageCode} on account ${accountCode}`)
}

/**
 * Get entries grouped by lettrage code for an account
 */
export async function getLettrageGroups(accountCode: string): Promise<Map<string, AccountingEntry[]>> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', accountCode)
    .not('lettrage_code', 'is', null)
    .order('lettrage_code')
    .order('date')

  if (error) {
    throw new Error(`Erreur chargement groupes de lettrage: ${error.message}`)
  }

  if (!data) {
    console.error('getLettrageGroups: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour lettrage groups')
  }

  const groups = new Map<string, AccountingEntry[]>()

  for (const entry of data) {
    if (entry.lettrage_code) {
      const existing = groups.get(entry.lettrage_code) || []
      existing.push(entry)
      groups.set(entry.lettrage_code, existing)
    }
  }

  return groups
}

/**
 * Auto-letter invoice entries with payment entries
 * Called after reconciliation to automatically letter supplier account
 */
export async function autoLetterInvoicePayment(
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

  // Letter supplier account (401xxx) if balanced
  for (const [accountCode, accountEntries] of byAccount) {
    if (accountCode.startsWith('401') && accountEntries.length >= 2) {
      if (isLettrageComplete(accountEntries)) {
        return letterEntries(
          accountEntries.map(e => e.id),
          'tiers'
        )
      }
    }
  }

  return null
}

// ============ CCA (Charges Constatées d'Avance) Functions ============

/**
 * Calculate prorata for CCA based on period dates
 * Returns the ratio of days remaining after closing date
 */
function calculateCCAProrata(startDate: string, endDate: string, closingDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const closing = new Date(closingDate)

  // Total days in the period
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Days remaining after closing date
  const daysRemaining = Math.ceil((end.getTime() - closing.getTime()) / (1000 * 60 * 60 * 24))

  if (daysRemaining <= 0) {
    return 0 // No CCA needed, period is fully consumed
  }

  if (daysRemaining >= totalDays) {
    return 1 // Entire period is after closing
  }

  return daysRemaining / totalDays
}

/**
 * Preview CCA entries (without saving to database)
 * Used to display entries in the form before user validates
 */
export async function previewCCAEntries(
  formData: InvoiceFormData,
  ccaConfig: CCAConfig,
  chartOfAccounts?: Array<{ code: string; label: string }>
): Promise<PreviewEntry[]> {
  const prorata = calculateCCAProrata(ccaConfig.startDate, ccaConfig.endDate, ccaConfig.closingDate)

  if (prorata <= 0) {
    return [] // No CCA needed
  }

  const journalOD = (await resolveJournal('misc')).code
  const ccaAmount = Math.round(ccaConfig.amount * prorata * 100) / 100
  const pieceNumber = generateTempPieceNumber(journalOD)

  // Helper to get account label from chart of accounts or fallback
  const getLabel = (code: string) => {
    if (!chartOfAccounts || chartOfAccounts.length === 0) {
      console.error(`getLabel: chartOfAccounts manquant pour code '${code}'`)
      throw new Error(`Plan comptable non chargé. Impossible de résoudre le compte '${code}'.`)
    }
    return resolveLabel(code, chartOfAccounts, formData.thirdPartyName)
  }

  if (!formData.accountingCode) {
    console.error('previewCCAEntries: accountingCode is required for charge account')
    throw new Error('Le code de compte de charge est requis pour générer les écritures CCA.')
  }
  const chargeAccountCode = formData.accountingCode
  const label = `CCA - ${formData.thirdPartyName || 'FOURNISSEUR'} - Période ${ccaConfig.startDate} au ${ccaConfig.endDate}`

  return [
    // Entry 1: Debit CCA account (486) = prorated amount
    {
      id: `preview-cca-debit-${Date.now()}`,
      journal: journalOD,
      pieceNumber,
      date: ccaConfig.closingDate,
      accountCode: ACCOUNT_CCA,
      accountLabel: getLabel(ACCOUNT_CCA),
      label,
      debit: ccaAmount,
      credit: 0,
    },
    // Entry 2: Credit charge account (6xxx) = prorated amount
    {
      id: `preview-cca-credit-${Date.now()}`,
      journal: journalOD,
      pieceNumber,
      date: ccaConfig.closingDate,
      accountCode: chargeAccountCode,
      accountLabel: getLabel(chargeAccountCode),
      label,
      debit: 0,
      credit: ccaAmount,
    },
  ]
}

/**
 * Generate CCA entries for a supplier invoice (at closing date)
 *
 * CCA entries (Charges Constatées d'Avance):
 *   Debit  486 (CCA)      = prorated amount
 *   Credit 6xxx (charge)  = prorated amount
 */
export async function generateCCAEntries(
  invoice: Invoice,
  formData: InvoiceFormData,
  ccaConfig: CCAConfig
): Promise<AccountingEntry[]> {
  const prorata = calculateCCAProrata(ccaConfig.startDate, ccaConfig.endDate, ccaConfig.closingDate)

  if (prorata <= 0) {
    console.log('No CCA needed - period is fully consumed before closing')
    return []
  }

  const journalOD = (await resolveJournal('misc')).code
  const ccaAmount = Math.round(ccaConfig.amount * prorata * 100) / 100
  const pieceNumber = await generatePieceNumber(journalOD)

  if (!formData.accountingCode) {
    console.error('generateCCAEntries: accountingCode is required for charge account')
    throw new Error('Le code de compte de charge est requis pour générer les écritures CCA.')
  }
  const chargeAccountCode = formData.accountingCode
  const label = `CCA - ${invoice.third_party?.name || 'FOURNISSEUR'} - ${invoice.number}`

  const entries: Partial<AccountingEntry>[] = [
    // Entry 1: Debit CCA account (486)
    {
      company_id: COMPANY_ID,
      journal: journalOD,
      date: ccaConfig.closingDate,
      piece_number: pieceNumber,
      label,
      account_code: ACCOUNT_CCA,
      debit: ccaAmount,
      credit: 0,
      linked_invoice_id: invoice.id,
      is_validated: false,
    },
    // Entry 2: Credit charge account (6xxx)
    {
      company_id: COMPANY_ID,
      journal: journalOD,
      date: ccaConfig.closingDate,
      piece_number: pieceNumber,
      label,
      account_code: chargeAccountCode,
      debit: 0,
      credit: ccaAmount,
      linked_invoice_id: invoice.id,
      is_validated: false,
    },
  ]

  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating CCA entries:', error)
    throw new Error(`Erreur création écritures CCA: ${error.message}`)
  }

  console.log(`Created ${data.length} CCA entries for invoice ${invoice.number} (prorata: ${(prorata * 100).toFixed(2)}%)`)
  return data
}

/**
 * Generate CCA reversal entries for the next period
 *
 * CCA reversal entries:
 *   Debit  6xxx (charge)  = CCA amount
 *   Credit 486 (CCA)      = CCA amount
 */
export async function generateCCAReversalEntries(
  invoiceId: string,
  reversalDate: string
): Promise<AccountingEntry[]> {
  // Get original CCA entries for this invoice
  const { data: ccaEntries, error: fetchError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('linked_invoice_id', invoiceId)
    .eq('account_code', ACCOUNT_CCA)
    .gt('debit', 0)  // Original CCA entry has debit on 486

  if (fetchError) {
    console.error('Error fetching CCA entries:', fetchError)
    throw new Error(`Erreur récupération écritures CCA: ${fetchError.message}`)
  }

  if (!ccaEntries || ccaEntries.length === 0) {
    console.log('No CCA entries found to reverse')
    return []
  }

  const journalOD = (await resolveJournal('misc')).code
  const pieceNumber = await generatePieceNumber(journalOD)
  const reversalEntries: Partial<AccountingEntry>[] = []

  for (const ccaEntry of ccaEntries) {
    const ccaAmount = ccaEntry.debit
    const label = `Contrepassation CCA - ${ccaEntry.label?.replace('CCA - ', '') || invoiceId}`

    // Find the corresponding charge account from the original CCA entry
    const { data: chargeEntry } = await supabase
      .from('accounting_entries')
      .select('account_code')
      .eq('piece_number', ccaEntry.piece_number)
      .neq('account_code', ACCOUNT_CCA)
      .single()

    if (!chargeEntry?.account_code) {
      console.error('generateCCAReversalEntries: charge account not found for reversal', { pieceNumber: ccaEntry.piece_number })
      throw new Error(`Impossible de retrouver le compte de charge pour la contrepassation de la CCA (pièce: ${ccaEntry.piece_number})`)
    }
    const chargeAccountCode = chargeEntry.account_code

    // Entry 1: Debit charge account (6xxx)
    reversalEntries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: reversalDate,
      piece_number: pieceNumber,
      label,
      account_code: chargeAccountCode,
      debit: ccaAmount,
      credit: 0,
      linked_invoice_id: invoiceId,
      is_validated: false,
    })

    // Entry 2: Credit CCA account (486)
    reversalEntries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: reversalDate,
      piece_number: pieceNumber,
      label,
      account_code: ACCOUNT_CCA,
      debit: 0,
      credit: ccaAmount,
      linked_invoice_id: invoiceId,
      is_validated: false,
    })
  }

  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(reversalEntries)
    .select()

  if (error) {
    console.error('Error creating CCA reversal entries:', error)
    throw new Error(`Erreur création écritures contrepassation CCA: ${error.message}`)
  }

  console.log(`Created ${data.length} CCA reversal entries for invoice ${invoiceId}`)
  return data
}

// ============ FNP (Factures Non Parvenues) Functions ============

/**
 * Preview FNP entries (without saving to database)
 * Used to display entries in the form before user validates
 */
export async function previewFNPEntries(
  formData: FNPFormData,
  chartOfAccounts?: Array<{ code: string; label: string }>
): Promise<PreviewEntry[]> {
  const journalOD = (await resolveJournal('misc')).code
  const pieceNumber = generateTempPieceNumber(journalOD)

  // Helper to get account label from chart of accounts or fallback
  const getLabel = (code: string) => {
    if (!chartOfAccounts || chartOfAccounts.length === 0) {
      console.error(`getLabel: chartOfAccounts manquant pour code '${code}'`)
      throw new Error(`Plan comptable non chargé. Impossible de résoudre le compte '${code}'.`)
    }
    return resolveLabel(code, chartOfAccounts, formData.thirdPartyName)
  }

  const label = `FNP - ${formData.thirdPartyName} - ${formData.description}`

  const entries: PreviewEntry[] = [
    // Entry 1: Debit charge account (6xxx) = estimated HT
    {
      id: `preview-fnp-charge-${Date.now()}`,
      journal: journalOD,
      pieceNumber,
      date: formData.closingDate,
      accountCode: formData.accountingCode,
      accountLabel: getLabel(formData.accountingCode),
      label,
      debit: formData.estimatedHT,
      credit: 0,
    },
  ]

  // Entry 2: Debit TVA on FNP (44586) = estimated TVA (if > 0)
  if (formData.estimatedTVA > 0) {
    entries.push({
      id: `preview-fnp-tva-${Date.now()}`,
      journal: journalOD,
      pieceNumber,
      date: formData.closingDate,
      accountCode: ACCOUNT_TVA_FNP,
      accountLabel: getLabel(ACCOUNT_TVA_FNP),
      label,
      debit: formData.estimatedTVA,
      credit: 0,
    })
  }

  // Entry 3: Credit FNP account (4081) = estimated TTC
  entries.push({
    id: `preview-fnp-credit-${Date.now()}`,
    journal: journalOD,
    pieceNumber,
    date: formData.closingDate,
    accountCode: ACCOUNT_FNP,
    accountLabel: getLabel(ACCOUNT_FNP),
    label,
    debit: 0,
    credit: formData.estimatedTTC,
  })

  return entries
}

/**
 * Generate FNP entries (Facture Non Parvenue) at closing
 *
 * FNP entries:
 *   Debit  6xxx (charge)     = estimated HT
 *   Debit  44586 (TVA FNP)   = estimated TVA
 *   Credit 4081 (FNP)        = estimated TTC
 */
export async function generateFNPEntries(
  formData: FNPFormData
): Promise<AccountingEntry[]> {
  const journalOD = (await resolveJournal('misc')).code
  const pieceNumber = await generatePieceNumber(journalOD)
  const label = `FNP - ${formData.thirdPartyName} - ${formData.description}`

  const entries: Partial<AccountingEntry>[] = [
    // Entry 1: Debit charge account (6xxx) = estimated HT
    {
      company_id: COMPANY_ID,
      journal: journalOD,
      date: formData.closingDate,
      piece_number: pieceNumber,
      label,
      account_code: formData.accountingCode,
      debit: formData.estimatedHT,
      credit: 0,
      is_validated: false,
    },
  ]

  // Entry 2: Debit TVA on FNP (44586) = estimated TVA (if > 0)
  if (formData.estimatedTVA > 0) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: formData.closingDate,
      piece_number: pieceNumber,
      label,
      account_code: ACCOUNT_TVA_FNP,
      debit: formData.estimatedTVA,
      credit: 0,
      is_validated: false,
    })
  }

  // Entry 3: Credit FNP account (4081) = estimated TTC
  entries.push({
    company_id: COMPANY_ID,
    journal: journalOD,
    date: formData.closingDate,
    piece_number: pieceNumber,
    label,
    account_code: ACCOUNT_FNP,
    debit: 0,
    credit: formData.estimatedTTC,
    is_validated: false,
  })

  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating FNP entries:', error)
    throw new Error(`Erreur création écritures FNP: ${error.message}`)
  }

  console.log(`Created ${data.length} FNP entries for ${formData.thirdPartyName}`)
  return data
}

/**
 * Generate FNP reversal entries when actual invoice is received
 *
 * FNP reversal entries:
 *   Debit  4081 (FNP)        = estimated TTC
 *   Credit 44586 (TVA FNP)   = estimated TVA
 *   Credit 6xxx (charge)     = estimated HT
 */
export async function generateFNPReversalEntries(
  fnpId: string,
  reversalDate: string
): Promise<AccountingEntry[]> {
  // Get original FNP entries by piece number
  // We need to find the FNP entry first (credit on 4081)
  const { data: fnpEntry, error: fetchError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('id', fnpId)
    .single()

  if (fetchError || !fnpEntry) {
    console.error('Error fetching FNP entry:', fetchError)
    throw new Error(`Erreur récupération écriture FNP: ${fetchError?.message || 'Non trouvée'}`)
  }

  // Get all entries from the same piece (same transaction)
  const { data: originalEntries, error: entriesError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('piece_number', fnpEntry.piece_number)

  if (entriesError || !originalEntries) {
    console.error('Error fetching FNP entries:', entriesError)
    throw new Error(`Erreur récupération écritures FNP: ${entriesError?.message}`)
  }

  const journalOD = (await resolveJournal('misc')).code
  const pieceNumber = await generatePieceNumber(journalOD)
  const reversalEntries: Partial<AccountingEntry>[] = []

  for (const entry of originalEntries) {
    const label = `Contrepassation ${entry.label || 'FNP'}`

    // Reverse the entry (swap debit/credit)
    reversalEntries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: reversalDate,
      piece_number: pieceNumber,
      label,
      account_code: entry.account_code,
      debit: entry.credit,   // Reverse: original credit becomes debit
      credit: entry.debit,   // Reverse: original debit becomes credit
      is_validated: false,
    })
  }

  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(reversalEntries)
    .select()

  if (error) {
    console.error('Error creating FNP reversal entries:', error)
    throw new Error(`Erreur création écritures contrepassation FNP: ${error.message}`)
  }

  console.log(`Created ${data.length} FNP reversal entries`)
  return data
}

// ============================================================================
// ÉCRITURES DE RÉGULARISATION - PREVIEW AVEC CONTRE-PASSATION AUTOMATIQUE
// ============================================================================

/**
 * Helper: Calculate the first day of next fiscal year
 */
function getNextFiscalYearStart(closingDate: string): string {
  const closing = new Date(closingDate)
  const nextYear = closing.getFullYear() + 1
  return `${nextYear}-01-01`
}

/**
 * Helper: Calculate prorata for period-based regularizations (CCA, PCA)
 * Returns the ratio of days remaining after closing date
 */
function calculateProrata(startDate: string, endDate: string, closingDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const closing = new Date(closingDate)

  // Total days in the period (inclusive)
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Days remaining after closing date
  const daysRemaining = Math.ceil((end.getTime() - closing.getTime()) / (1000 * 60 * 60 * 24))

  if (daysRemaining <= 0) {
    return 0 // No regularization needed, period is fully consumed
  }

  if (daysRemaining >= totalDays) {
    return 1 // Entire period is after closing
  }

  return daysRemaining / totalDays
}

/**
 * Generate unique preview ID
 */
function generatePreviewId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================================
// 1. CCA - CHARGES CONSTATÉES D'AVANCE (compte 486)
// ============================================================================

/**
 * Generate CCA entries with automatic reversal for preview
 *
 * Use case: Charge paid/recorded this year but covers period extending into next year
 * Example: Annual insurance from July to June, closing date December 31
 *
 * At closing (December 31):
 *   Débit 486 (CCA) = montant proratisé (Jan-June portion)
 *   Crédit 6xxx (charge) = montant proratisé
 *
 * Reversal on January 1:
 *   Débit 6xxx (charge) = montant proratisé
 *   Crédit 486 (CCA) = montant proratisé
 */
export async function generateCCAEntriesPreview(
  chargeAccountCode: string,
  totalAmount: number,
  startDate: string,
  endDate: string,
  closingDate: string,
  description?: string,
  chartOfAccounts?: Array<{ code: string; label: string }>
): Promise<RegularizationEntries> {
  const prorata = calculateProrata(startDate, endDate, closingDate)
  const reversalDate = getNextFiscalYearStart(closingDate)

  if (prorata <= 0) {
    // No CCA needed - period is fully consumed before closing
    return {
      closingEntries: [],
      reversalEntries: [],
      closingDate,
      reversalDate,
      totalAmount: 0
    }
  }

  const journalOD = (await resolveJournal('misc')).code
  const ccaAmount = Math.round(totalAmount * prorata * 100) / 100
  const pieceNumberClosing = generateTempPieceNumber(journalOD)
  const pieceNumberReversal = generateTempPieceNumber(journalOD)

  // Helper to get account label
  const getLabel = (code: string) => {
    const found = chartOfAccounts?.find(a => a.code === code)
    if (!chartOfAccounts || chartOfAccounts.length === 0) {
      console.error(`getLabel: chartOfAccounts manquant pour code '${code}'`)
      throw new Error(`Plan comptable non chargé. Impossible de résoudre le compte '${code}'.`)
    }
    return resolveLabel(code, chartOfAccounts)
  }

  const labelClosing = description
    ? `CCA - ${description} - Période ${startDate} au ${endDate}`
    : `CCA - Charge anticipée - Période ${startDate} au ${endDate}`
  const labelReversal = `Contrepassation CCA - ${description || 'Charge anticipée'}`

  // Closing entries (at closing date)
  const closingEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('cca-debit'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: ACCOUNT_CCA,
      accountLabel: getLabel(ACCOUNT_CCA),
      label: labelClosing,
      debit: ccaAmount,
      credit: 0,
    },
    {
      id: generatePreviewId('cca-credit'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: chargeAccountCode,
      accountLabel: getLabel(chargeAccountCode),
      label: labelClosing,
      debit: 0,
      credit: ccaAmount,
    },
  ]

  // Reversal entries (on first day of next fiscal year)
  const reversalEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('cca-rev-debit'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: chargeAccountCode,
      accountLabel: getLabel(chargeAccountCode),
      label: labelReversal,
      debit: ccaAmount,
      credit: 0,
    },
    {
      id: generatePreviewId('cca-rev-credit'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: ACCOUNT_CCA,
      accountLabel: getLabel(ACCOUNT_CCA),
      label: labelReversal,
      debit: 0,
      credit: ccaAmount,
    },
  ]

  return {
    closingEntries,
    reversalEntries,
    closingDate,
    reversalDate,
    totalAmount: ccaAmount
  }
}

// ============================================================================
// 2. FNP - FACTURES NON PARVENUES (compte 4081)
// ============================================================================

/**
 * Generate FNP entries with automatic reversal for preview
 *
 * Use case: Service/goods received before closing but invoice not yet received
 * Example: December delivery, invoice expected in January
 *
 * At closing (December 31):
 *   Débit 6xxx (charge) = montant HT estimé
 *   Débit 44586 (TVA sur FNP) = TVA estimée (si récupérable)
 *   Crédit 4081 (FNP) = montant TTC
 *
 * Reversal on January 1:
 *   Débit 4081 (FNP) = montant TTC
 *   Crédit 44586 (TVA sur FNP) = TVA estimée
 *   Crédit 6xxx (charge) = montant HT estimé
 */
export async function generateFNPEntriesPreview(
  supplierName: string,
  estimatedAmount: number,
  chargeAccountCode: string,
  vatRate: number,
  closingDate: string,
  description?: string,
  chartOfAccounts?: Array<{ code: string; label: string }>
): Promise<RegularizationEntries> {
  const journalOD = (await resolveJournal('misc')).code
  const reversalDate = getNextFiscalYearStart(closingDate)
  const pieceNumberClosing = generateTempPieceNumber(journalOD)
  const pieceNumberReversal = generateTempPieceNumber(journalOD)

  // Calculate VAT and TTC
  const vatDecimal = vatRate / 100
  const estimatedHT = estimatedAmount
  const estimatedTVA = Math.round(estimatedHT * vatDecimal * 100) / 100
  const estimatedTTC = Math.round((estimatedHT + estimatedTVA) * 100) / 100

  // Helper to get account label
  const getLabel = (code: string) => {
    const found = chartOfAccounts?.find(a => a.code === code)
    if (!chartOfAccounts || chartOfAccounts.length === 0) {
      console.error(`getLabel: chartOfAccounts manquant pour code '${code}'`)
      throw new Error(`Plan comptable non chargé. Impossible de résoudre le compte '${code}'.`)
    }
    return resolveLabel(code, chartOfAccounts, supplierName)
  }

  const labelClosing = description
    ? `FNP - ${supplierName} - ${description}`
    : `FNP - ${supplierName}`
  const labelReversal = `Contrepassation FNP - ${supplierName}`

  // Closing entries (at closing date)
  const closingEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('fnp-charge'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: chargeAccountCode,
      accountLabel: getLabel(chargeAccountCode),
      label: labelClosing,
      debit: estimatedHT,
      credit: 0,
    },
  ]

  // Add TVA entry if applicable
  if (estimatedTVA > 0) {
    closingEntries.push({
      id: generatePreviewId('fnp-tva'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: ACCOUNT_TVA_FNP,
      accountLabel: getLabel(ACCOUNT_TVA_FNP),
      label: labelClosing,
      debit: estimatedTVA,
      credit: 0,
    })
  }

  // Credit FNP account
  closingEntries.push({
    id: generatePreviewId('fnp-credit'),
    journal: journalOD,
    pieceNumber: pieceNumberClosing,
    date: closingDate,
    accountCode: ACCOUNT_FNP,
    accountLabel: getLabel(ACCOUNT_FNP),
    label: labelClosing,
    debit: 0,
    credit: estimatedTTC,
  })

  // Reversal entries (on first day of next fiscal year)
  const reversalEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('fnp-rev-debit'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: ACCOUNT_FNP,
      accountLabel: getLabel(ACCOUNT_FNP),
      label: labelReversal,
      debit: estimatedTTC,
      credit: 0,
    },
  ]

  // Add TVA reversal if applicable
  if (estimatedTVA > 0) {
    reversalEntries.push({
      id: generatePreviewId('fnp-rev-tva'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: ACCOUNT_TVA_FNP,
      accountLabel: getLabel(ACCOUNT_TVA_FNP),
      label: labelReversal,
      debit: 0,
      credit: estimatedTVA,
    })
  }

  // Credit charge account
  reversalEntries.push({
    id: generatePreviewId('fnp-rev-charge'),
    journal: journalOD,
    pieceNumber: pieceNumberReversal,
    date: reversalDate,
    accountCode: chargeAccountCode,
    accountLabel: getLabel(chargeAccountCode),
    label: labelReversal,
    debit: 0,
    credit: estimatedHT,
  })

  return {
    closingEntries,
    reversalEntries,
    closingDate,
    reversalDate,
    totalAmount: estimatedTTC
  }
}

// ============================================================================
// 3. PCA - PRODUITS CONSTATÉS D'AVANCE (compte 487)
// ============================================================================

/**
 * Generate PCA entries with automatic reversal for preview
 *
 * Use case: Revenue invoiced/received before closing but service to be rendered next year
 * Example: Annual subscription invoiced in November for Nov-Oct period
 *
 * At closing (December 31):
 *   Débit 7xxx (produit) = montant proratisé (Jan-Oct portion)
 *   Crédit 487 (PCA) = montant proratisé
 *
 * Reversal on January 1:
 *   Débit 487 (PCA) = montant proratisé
 *   Crédit 7xxx (produit) = montant proratisé
 */
export async function generatePCAEntriesPreview(
  productAccountCode: string,
  totalAmount: number,
  startDate: string,
  endDate: string,
  closingDate: string,
  description?: string,
  chartOfAccounts?: Array<{ code: string; label: string }>
): Promise<RegularizationEntries> {
  const prorata = calculateProrata(startDate, endDate, closingDate)
  const reversalDate = getNextFiscalYearStart(closingDate)

  if (prorata <= 0) {
    // No PCA needed - service period is fully rendered before closing
    return {
      closingEntries: [],
      reversalEntries: [],
      closingDate,
      reversalDate,
      totalAmount: 0
    }
  }

  const journalOD = (await resolveJournal('misc')).code
  const pcaAmount = Math.round(totalAmount * prorata * 100) / 100
  const pieceNumberClosing = generateTempPieceNumber(journalOD)
  const pieceNumberReversal = generateTempPieceNumber(journalOD)

  // Helper to get account label
  const getLabel = (code: string) => {
    const found = chartOfAccounts?.find(a => a.code === code)
    if (!chartOfAccounts || chartOfAccounts.length === 0) {
      console.error(`getLabel: chartOfAccounts manquant pour code '${code}'`)
      throw new Error(`Plan comptable non chargé. Impossible de résoudre le compte '${code}'.`)
    }
    return resolveLabel(code, chartOfAccounts)
  }

  const labelClosing = description
    ? `PCA - ${description} - Période ${startDate} au ${endDate}`
    : `PCA - Produit anticipé - Période ${startDate} au ${endDate}`
  const labelReversal = `Contrepassation PCA - ${description || 'Produit anticipé'}`

  // Closing entries (at closing date)
  const closingEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('pca-debit'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: productAccountCode,
      accountLabel: getLabel(productAccountCode),
      label: labelClosing,
      debit: pcaAmount,
      credit: 0,
    },
    {
      id: generatePreviewId('pca-credit'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: ACCOUNT_PCA,
      accountLabel: getLabel(ACCOUNT_PCA),
      label: labelClosing,
      debit: 0,
      credit: pcaAmount,
    },
  ]

  // Reversal entries (on first day of next fiscal year)
  const reversalEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('pca-rev-debit'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: ACCOUNT_PCA,
      accountLabel: getLabel(ACCOUNT_PCA),
      label: labelReversal,
      debit: pcaAmount,
      credit: 0,
    },
    {
      id: generatePreviewId('pca-rev-credit'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: productAccountCode,
      accountLabel: getLabel(productAccountCode),
      label: labelReversal,
      debit: 0,
      credit: pcaAmount,
    },
  ]

  return {
    closingEntries,
    reversalEntries,
    closingDate,
    reversalDate,
    totalAmount: pcaAmount
  }
}

// ============================================================================
// 4. AAR - AVOIRS À RECEVOIR (compte 4098)
// ============================================================================

/**
 * Generate AAR entries with automatic reversal for preview
 *
 * Use case: Credit note expected from supplier but not yet received
 * Example: Return of defective goods in December, credit note expected in January
 *
 * At closing (December 31):
 *   Débit 4098 (AAR) = montant TTC attendu
 *   Crédit 6xxx (charge) = montant HT
 *   Crédit 44586 (TVA sur FNP) = TVA
 *
 * Reversal on January 1:
 *   Débit 6xxx (charge) = montant HT
 *   Débit 44586 (TVA) = TVA
 *   Crédit 4098 (AAR) = montant TTC
 */
export async function generateAAREntriesPreview(
  supplierName: string,
  expectedAmount: number,
  purchaseAccountCode: string,
  vatRate: number,
  closingDate: string,
  description?: string,
  chartOfAccounts?: Array<{ code: string; label: string }>
): Promise<RegularizationEntries> {
  const journalOD = (await resolveJournal('misc')).code
  const reversalDate = getNextFiscalYearStart(closingDate)
  const pieceNumberClosing = generateTempPieceNumber(journalOD)
  const pieceNumberReversal = generateTempPieceNumber(journalOD)

  // Calculate VAT and TTC
  const vatDecimal = vatRate / 100
  const expectedHT = expectedAmount
  const expectedTVA = Math.round(expectedHT * vatDecimal * 100) / 100
  const expectedTTC = Math.round((expectedHT + expectedTVA) * 100) / 100

  // Helper to get account label
  const getLabel = (code: string) => {
    const found = chartOfAccounts?.find(a => a.code === code)
    if (!chartOfAccounts || chartOfAccounts.length === 0) {
      console.error(`getLabel: chartOfAccounts manquant pour code '${code}'`)
      throw new Error(`Plan comptable non chargé. Impossible de résoudre le compte '${code}'.`)
    }
    return resolveLabel(code, chartOfAccounts, supplierName)
  }

  const labelClosing = description
    ? `AAR - ${supplierName} - ${description}`
    : `AAR - ${supplierName} - Avoir attendu`
  const labelReversal = `Contrepassation AAR - ${supplierName}`

  // Closing entries (at closing date)
  const closingEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('aar-debit'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: ACCOUNT_AAR,
      accountLabel: getLabel(ACCOUNT_AAR),
      label: labelClosing,
      debit: expectedTTC,
      credit: 0,
    },
    {
      id: generatePreviewId('aar-charge'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: purchaseAccountCode,
      accountLabel: getLabel(purchaseAccountCode),
      label: labelClosing,
      debit: 0,
      credit: expectedHT,
    },
  ]

  // Add TVA entry if applicable
  if (expectedTVA > 0) {
    closingEntries.push({
      id: generatePreviewId('aar-tva'),
      journal: journalOD,
      pieceNumber: pieceNumberClosing,
      date: closingDate,
      accountCode: ACCOUNT_TVA_FNP,
      accountLabel: getLabel(ACCOUNT_TVA_FNP),
      label: labelClosing,
      debit: 0,
      credit: expectedTVA,
    })
  }

  // Reversal entries (on first day of next fiscal year)
  const reversalEntries: PreviewEntry[] = [
    {
      id: generatePreviewId('aar-rev-charge'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: purchaseAccountCode,
      accountLabel: getLabel(purchaseAccountCode),
      label: labelReversal,
      debit: expectedHT,
      credit: 0,
    },
  ]

  // Add TVA reversal if applicable
  if (expectedTVA > 0) {
    reversalEntries.push({
      id: generatePreviewId('aar-rev-tva'),
      journal: journalOD,
      pieceNumber: pieceNumberReversal,
      date: reversalDate,
      accountCode: ACCOUNT_TVA_FNP,
      accountLabel: getLabel(ACCOUNT_TVA_FNP),
      label: labelReversal,
      debit: expectedTVA,
      credit: 0,
    })
  }

  // Credit AAR account
  reversalEntries.push({
    id: generatePreviewId('aar-rev-credit'),
    journal: journalOD,
    pieceNumber: pieceNumberReversal,
    date: reversalDate,
    accountCode: ACCOUNT_AAR,
    accountLabel: getLabel(ACCOUNT_AAR),
    label: labelReversal,
    debit: 0,
    credit: expectedTTC,
  })

  return {
    closingEntries,
    reversalEntries,
    closingDate,
    reversalDate,
    totalAmount: expectedTTC
  }
}

// ============================================================================
// SAVE REGULARIZATION ENTRIES TO DATABASE
// ============================================================================

/**
 * Save regularization entries (closing + reversal) to database
 * Returns both sets of created entries
 */
export async function saveRegularizationEntries(
  regularization: RegularizationEntries,
  linkedInvoiceId?: string
): Promise<{ closingEntries: AccountingEntry[]; reversalEntries: AccountingEntry[] }> {
  if (regularization.closingEntries.length === 0) {
    console.log('No regularization entries to save')
    return { closingEntries: [], reversalEntries: [] }
  }

  // Generate real piece numbers
  const journalOD = (await resolveJournal('misc')).code
  const pieceNumberClosing = await generatePieceNumber(journalOD)
  const pieceNumberReversal = await generatePieceNumber(journalOD)

  // Prepare closing entries for database
  const closingEntriesDB: Partial<AccountingEntry>[] = regularization.closingEntries.map(entry => ({
    company_id: COMPANY_ID,
    journal: entry.journal,
    date: entry.date,
    piece_number: pieceNumberClosing,
    label: entry.label,
    account_code: entry.accountCode,
    debit: entry.debit,
    credit: entry.credit,
    linked_invoice_id: linkedInvoiceId,
    is_validated: false,
  }))

  // Prepare reversal entries for database
  const reversalEntriesDB: Partial<AccountingEntry>[] = regularization.reversalEntries.map(entry => ({
    company_id: COMPANY_ID,
    journal: entry.journal,
    date: entry.date,
    piece_number: pieceNumberReversal,
    label: entry.label,
    account_code: entry.accountCode,
    debit: entry.debit,
    credit: entry.credit,
    linked_invoice_id: linkedInvoiceId,
    is_validated: false,
  }))

  // Insert closing entries
  const { data: closingData, error: closingError } = await supabase
    .from('accounting_entries')
    .insert(closingEntriesDB)
    .select()

  if (closingError) {
    console.error('Error creating closing regularization entries:', closingError)
    throw new Error(`Erreur création écritures de régularisation: ${closingError.message}`)
  }

  // Insert reversal entries
  const { data: reversalData, error: reversalError } = await supabase
    .from('accounting_entries')
    .insert(reversalEntriesDB)
    .select()

  if (reversalError) {
    console.error('Error creating reversal entries:', reversalError)
    throw new Error(`Erreur création écritures de contre-passation: ${reversalError.message}`)
  }

  console.log(`Created ${closingData.length} closing entries and ${reversalData.length} reversal entries`)

  return {
    closingEntries: closingData,
    reversalEntries: reversalData
  }
}

// ============================================================================
// HELPER: COMBINE MULTIPLE REGULARIZATIONS
// ============================================================================

/**
 * Combine multiple regularization results into a single preview
 * Useful for displaying all closing entries together
 */
export function combineRegularizations(
  ...regularizations: RegularizationEntries[]
): RegularizationEntries {
  const combined: RegularizationEntries = {
    closingEntries: [],
    reversalEntries: [],
    closingDate: regularizations[0]?.closingDate || '',
    reversalDate: regularizations[0]?.reversalDate || '',
    totalAmount: 0
  }

  for (const reg of regularizations) {
    combined.closingEntries.push(...reg.closingEntries)
    combined.reversalEntries.push(...reg.reversalEntries)
    combined.totalAmount += reg.totalAmount
  }

  return combined
}
