// TVA Service - VAT calculation, declaration and liquidation entries
// Implements French CA3 declaration format
import { supabase, COMPANY_ID } from '../lib/supabase'
import { generatePieceNumber } from './accountingService'
import type { ChartOfAccount } from '../types/database'
import { resolveByRole, resolveJournal } from './accountResolverService'

// ============ Constants ============

// Structural PCG prefixes - used for DB queries (`.like('account_code', '70%')`), NOT for entries
const SALES_PREFIX = '70'  // Ventes de produits/services (query prefix only)

// Standard French VAT rates
export const VAT_RATES = ['20', '10', '5.5', '2.1'] as const
export type VATRate = typeof VAT_RATES[number]

// ============ Types ============

export interface VATByRate {
  '20': number
  '10': number
  '5.5': number
  '2.1': number
}

// CA3 Section A - Taxable Operations
export interface CA3SectionA {
  ligne01_ventesFrance: number          // Ventes/prestations France (compte 70xxx)
  ligne02_autresOperations: number      // Autres opérations imposables
  ligne03_acquisitionsIntra: number     // Acquisitions intracommunautaires (autoliq)
  ligne04_totalA: number                // Total A
}

// CA3 Section B - Gross VAT
export interface CA3SectionB {
  ligne08_tva20: number                 // TVA à 20%
  ligne08_base20: number                // Base HT 20%
  ligne09_tva10: number                 // TVA à 10%
  ligne09_base10: number                // Base HT 10%
  ligne9B_tva55: number                 // TVA à 5.5%
  ligne9B_base55: number                // Base HT 5.5%
  ligne10_tva21: number                 // TVA à 2.1%
  ligne10_base21: number                // Base HT 2.1%
  ligne11_tvaIntra: number              // TVA intracommunautaire (autoliquidation)
  ligne11_baseIntra: number             // Base acquisitions intra
  ligne14_totalB: number                // Total TVA brute
}

// CA3 Section C - Deductible VAT
export interface CA3SectionC {
  ligne19_tvaImmo: number               // TVA sur immobilisations (compte 44562)
  ligne20_tvaABS: number                // TVA sur ABS (compte 44566)
  ligne21_autreTVA: number              // Autre TVA déductible
  ligne22_totalC: number                // Total TVA déductible
}

// CA3 Section D - VAT Credit
export interface CA3SectionD {
  ligne23_creditReporte: number         // Crédit reporté mois précédent
  ligne24_totalD: number                // Total crédits
}

// CA3 Section E - Net VAT
export interface CA3SectionE {
  ligne25_tvaAPayer: number             // TVA nette à payer (B - C - D) si > 0
  ligne26_creditTVA: number             // Crédit de TVA (C + D - B) si > 0
}

// Complete CA3 Calculation
export interface CA3Calculation {
  periodStart: string
  periodEnd: string
  sectionA: CA3SectionA
  sectionB: CA3SectionB
  sectionC: CA3SectionC
  sectionD: CA3SectionD
  sectionE: CA3SectionE
  // Detailed breakdown for compatibility
  collected: {
    total: number
    byRate: VATByRate
  }
  deductible: {
    total: number
    byRate: VATByRate
    immobilisations: number
    abs: number
    other: number
  }
  // Editable values (for manual adjustments)
  manualAdjustments: {
    [key: string]: number
  }
}

// Legacy interface for compatibility
export interface VATCalculation {
  periodStart: string
  periodEnd: string
  collected: {
    total: number
    byRate: VATByRate
  }
  deductible: {
    total: number
    byRate: VATByRate
  }
  net: number  // positive = à payer, negative = crédit
  previousCredit: number  // Report crédit TVA période précédente
  netAfterCredit: number  // Net après report
}

export interface VATEntry {
  date: string
  accountCode: string
  debit: number
  credit: number
  label: string
}

export interface VATDeclarationData {
  periodStart: string
  periodEnd: string
  type: 'monthly' | 'quarterly' | 'yearly'
  totalCollected: number
  totalDeductible: number
  totalDue: number
  creditCarryForward: number
  status?: 'draft' | 'submitted' | 'paid'
  // CA3 specific data
  ca3Data?: CA3Calculation
}

export interface VATDeclaration {
  id: string
  company_id: string
  period_start: string
  period_end: string
  type: 'monthly' | 'quarterly' | 'yearly'
  status: 'draft' | 'submitted' | 'paid'
  total_collected: number
  total_deductible: number
  total_due: number
  credit_carry_forward: number
  submitted_at: string | null
  paid_at: string | null
  created_at: string
  ca3_data?: CA3Calculation
}

// ============ Chart of Accounts Loader ============

async function loadChartOfAccounts(): Promise<ChartOfAccount[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)

  if (error) {
    console.error('loadChartOfAccounts: failed', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }
  if (!data) {
    console.error('loadChartOfAccounts: data is null')
    throw new Error('Erreur inattendue: plan comptable manquant')
  }
  return data
}

// ============ VAT Calculation ============

/**
 * Extract VAT rate from accounting entry label or associated data
 * Returns the rate as a string ('20', '10', '5.5', '2.1') or null if not determinable
 */
function extractVATRate(label: string, _debit: number, _credit: number): VATRate | null {
  // Try to find rate in label (e.g., "TVA 20%", "TVA à 10%")
  const rateMatch = label.match(/(?:TVA|tva)\s*(?:à\s*)?(\d+(?:[.,]\d+)?)\s*%?/i)
  if (rateMatch) {
    const rate = rateMatch[1].replace(',', '.')
    if (VAT_RATES.includes(rate as VATRate)) {
      return rate as VATRate
    }
  }

  // Check for specific keywords
  if (label.toLowerCase().includes('5,5') || label.toLowerCase().includes('5.5')) {
    return '5.5'
  }
  if (label.toLowerCase().includes('2,1') || label.toLowerCase().includes('2.1')) {
    return '2.1'
  }

  // Default to 20% if no rate found (most common in France)
  return '20'
}

/**
 * Check if entry is for intracommunautaire operations (autoliquidation)
 * @param tvaIntraCode - resolved code for TVA_INTRACOMMUNAUTAIRE role
 */
function isIntracommunautaire(label: string, accountCode: string, tvaIntraCode: string): boolean {
  const lowerLabel = label.toLowerCase()
  return lowerLabel.includes('intracom') ||
         lowerLabel.includes('autoliq') ||
         lowerLabel.includes('ue ') ||
         lowerLabel.includes('acquisition') ||
         accountCode === tvaIntraCode
}

/**
 * Calculate CA3 VAT declaration for a given period
 * Full implementation of French CA3 format
 */
export async function calculateCA3Declaration(
  periodStart: string,
  periodEnd: string
): Promise<CA3Calculation> {
  // ============ Resolve all account codes from chart_of_accounts ============
  const chartOfAccounts = await loadChartOfAccounts()
  const tvaCollecteeCode = resolveByRole('TVA_COLLECTEE', chartOfAccounts).code
  const tvaDeductibleAbsCode = resolveByRole('TVA_DEDUCTIBLE_ABS', chartOfAccounts).code
  const tvaDeductibleImmoCode = resolveByRole('TVA_DEDUCTIBLE_IMMO', chartOfAccounts).code
  const tvaIntraCode = resolveByRole('TVA_INTRACOMMUNAUTAIRE', chartOfAccounts).code

  // ============ SECTION A: Taxable Operations ============

  // Fetch sales entries (account 70xxx) for base calculation
  const { data: salesEntries, error: salesError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .like('account_code', `${SALES_PREFIX}%`)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  if (salesError) {
    console.error('Error fetching sales entries:', salesError)
    throw new Error(`Erreur récupération ventes: ${salesError.message}`)
  }

  // Calculate sales France (ligne 01)
  let ligne01_ventesFrance = 0
  for (const entry of salesEntries || []) {
    // Sales are normally credit entries
    const amount = (entry.credit || 0) - (entry.debit || 0)
    if (!isIntracommunautaire(entry.label, entry.account_code, tvaIntraCode)) {
      ligne01_ventesFrance += amount
    }
  }

  // ============ Fetch all TVA entries ============

  // TVA collectée (44571)
  const { data: collectedEntries, error: collectedError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', tvaCollecteeCode)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  if (collectedError) {
    console.error('Error fetching TVA collectée entries:', collectedError)
    throw new Error(`Erreur récupération TVA collectée: ${collectedError.message}`)
  }

  // TVA déductible sur ABS (44566)
  const { data: deductibleABSEntries, error: deductibleABSError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', tvaDeductibleAbsCode)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  if (deductibleABSError) {
    console.error('Error fetching TVA déductible ABS entries:', deductibleABSError)
    throw new Error(`Erreur récupération TVA déductible ABS: ${deductibleABSError.message}`)
  }

  // TVA déductible sur immobilisations (44562)
  const { data: deductibleImmoEntries, error: deductibleImmoError } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', tvaDeductibleImmoCode)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  if (deductibleImmoError) {
    console.error('Error fetching TVA déductible immo entries:', deductibleImmoError)
    throw new Error(`Erreur récupération TVA déductible immo: ${deductibleImmoError.message}`)
  }

  // ============ SECTION B: Calculate collected VAT by rate ============

  const collectedByRate: VATByRate = { '20': 0, '10': 0, '5.5': 0, '2.1': 0 }
  let totalCollected = 0
  let tvaIntra = 0
  let baseIntra = 0

  for (const entry of collectedEntries || []) {
    const amount = (entry.credit || 0) - (entry.debit || 0)

    if (isIntracommunautaire(entry.label, entry.account_code, tvaIntraCode)) {
      tvaIntra += amount
      // Base intra is the amount / rate
      const rate = extractVATRate(entry.label, entry.debit || 0, entry.credit || 0)
      if (rate) {
        baseIntra += amount / (parseFloat(rate) / 100)
      }
    } else {
      totalCollected += amount
      const rate = extractVATRate(entry.label, entry.debit || 0, entry.credit || 0)
      if (rate) {
        collectedByRate[rate] += amount
      } else {
        collectedByRate['20'] += amount
      }
    }
  }

  // Calculate bases from VAT amounts
  const ligne08_base20 = collectedByRate['20'] > 0 ? collectedByRate['20'] / 0.20 : 0
  const ligne09_base10 = collectedByRate['10'] > 0 ? collectedByRate['10'] / 0.10 : 0
  const ligne9B_base55 = collectedByRate['5.5'] > 0 ? collectedByRate['5.5'] / 0.055 : 0
  const ligne10_base21 = collectedByRate['2.1'] > 0 ? collectedByRate['2.1'] / 0.021 : 0

  // ============ SECTION C: Calculate deductible VAT ============

  const deductibleByRate: VATByRate = { '20': 0, '10': 0, '5.5': 0, '2.1': 0 }
  let totalDeductibleABS = 0
  let totalDeductibleImmo = 0

  // TVA déductible sur ABS
  for (const entry of deductibleABSEntries || []) {
    const amount = (entry.debit || 0) - (entry.credit || 0)
    totalDeductibleABS += amount

    const rate = extractVATRate(entry.label, entry.debit || 0, entry.credit || 0)
    if (rate) {
      deductibleByRate[rate] += amount
    } else {
      deductibleByRate['20'] += amount
    }
  }

  // TVA déductible sur immobilisations
  for (const entry of deductibleImmoEntries || []) {
    const amount = (entry.debit || 0) - (entry.credit || 0)
    totalDeductibleImmo += amount
  }

  const totalDeductible = totalDeductibleABS + totalDeductibleImmo

  // ============ SECTION D: Previous credit ============

  const previousCredit = await getPreviousCreditCarryForward(periodStart)

  // ============ SECTION E: Calculate net ============

  const totalBrute = totalCollected + tvaIntra // ligne 14
  const totalDeductibleWithCredit = totalDeductible + previousCredit
  const netResult = totalBrute - totalDeductibleWithCredit

  // Build CA3 structure
  const sectionA: CA3SectionA = {
    ligne01_ventesFrance: round2(ligne01_ventesFrance),
    ligne02_autresOperations: 0, // TODO: Calculate from other accounts if needed
    ligne03_acquisitionsIntra: round2(baseIntra),
    ligne04_totalA: round2(ligne01_ventesFrance + baseIntra),
  }

  const sectionB: CA3SectionB = {
    ligne08_tva20: round2(collectedByRate['20']),
    ligne08_base20: round2(ligne08_base20),
    ligne09_tva10: round2(collectedByRate['10']),
    ligne09_base10: round2(ligne09_base10),
    ligne9B_tva55: round2(collectedByRate['5.5']),
    ligne9B_base55: round2(ligne9B_base55),
    ligne10_tva21: round2(collectedByRate['2.1']),
    ligne10_base21: round2(ligne10_base21),
    ligne11_tvaIntra: round2(tvaIntra),
    ligne11_baseIntra: round2(baseIntra),
    ligne14_totalB: round2(totalBrute),
  }

  const sectionC: CA3SectionC = {
    ligne19_tvaImmo: round2(totalDeductibleImmo),
    ligne20_tvaABS: round2(totalDeductibleABS),
    ligne21_autreTVA: 0, // Other deductible VAT
    ligne22_totalC: round2(totalDeductible),
  }

  const sectionD: CA3SectionD = {
    ligne23_creditReporte: round2(previousCredit),
    ligne24_totalD: round2(previousCredit),
  }

  const sectionE: CA3SectionE = {
    ligne25_tvaAPayer: netResult > 0 ? round2(netResult) : 0,
    ligne26_creditTVA: netResult < 0 ? round2(Math.abs(netResult)) : 0,
  }

  return {
    periodStart,
    periodEnd,
    sectionA,
    sectionB,
    sectionC,
    sectionD,
    sectionE,
    collected: {
      total: round2(totalCollected + tvaIntra),
      byRate: {
        '20': round2(collectedByRate['20']),
        '10': round2(collectedByRate['10']),
        '5.5': round2(collectedByRate['5.5']),
        '2.1': round2(collectedByRate['2.1']),
      }
    },
    deductible: {
      total: round2(totalDeductible),
      byRate: {
        '20': round2(deductibleByRate['20']),
        '10': round2(deductibleByRate['10']),
        '5.5': round2(deductibleByRate['5.5']),
        '2.1': round2(deductibleByRate['2.1']),
      },
      immobilisations: round2(totalDeductibleImmo),
      abs: round2(totalDeductibleABS),
      other: 0,
    },
    manualAdjustments: {},
  }
}

/**
 * Legacy calculation function for backward compatibility
 */
export async function calculateVATDeclaration(
  periodStart: string,
  periodEnd: string
): Promise<VATCalculation> {
  const ca3 = await calculateCA3Declaration(periodStart, periodEnd)

  return {
    periodStart,
    periodEnd,
    collected: ca3.collected,
    deductible: {
      total: ca3.deductible.total,
      byRate: ca3.deductible.byRate,
    },
    net: ca3.sectionB.ligne14_totalB - ca3.sectionC.ligne22_totalC,
    previousCredit: ca3.sectionD.ligne23_creditReporte,
    netAfterCredit: ca3.sectionE.ligne25_tvaAPayer > 0
      ? ca3.sectionE.ligne25_tvaAPayer
      : -ca3.sectionE.ligne26_creditTVA,
  }
}

/**
 * Helper: Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Get the credit carry forward from the previous declaration
 */
async function getPreviousCreditCarryForward(currentPeriodStart: string): Promise<number> {
  const { data, error } = await supabase
    .from('vat_declarations')
    .select('credit_carry_forward, total_due')
    .eq('company_id', COMPANY_ID)
    .lt('period_end', currentPeriodStart)
    .order('period_end', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching previous VAT declaration:', error)
    throw new Error(`Erreur récupération déclaration précédente: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return 0
  }

  // If previous declaration had credit (negative total_due), it carries forward
  const previousDeclaration = data[0]
  if (previousDeclaration.total_due < 0) {
    return Math.abs(previousDeclaration.total_due)
  }

  return previousDeclaration.credit_carry_forward || 0
}

// ============ VAT Entries Generation ============

/**
 * Generate VAT liquidation entries for a CA3 declaration
 *
 * Standard liquidation:
 *   Debit  44571 (TVA collectée)     = Total collected
 *   Credit 44566 (TVA déductible)    = Total deductible ABS
 *   Credit 44562 (TVA déductible)    = Total deductible immo
 *   Debit/Credit 44551 or 44567      = Net amount
 */
export async function generateVATEntries(calculation: VATCalculation | CA3Calculation): Promise<VATEntry[]> {
  // Resolve all account codes from chart_of_accounts
  const chartOfAccounts = await loadChartOfAccounts()
  const tvaCollecteeCode = resolveByRole('TVA_COLLECTEE', chartOfAccounts).code
  const tvaDeductibleImmoCode = resolveByRole('TVA_DEDUCTIBLE_IMMO', chartOfAccounts).code
  const tvaDeductibleAbsCode = resolveByRole('TVA_DEDUCTIBLE_ABS', chartOfAccounts).code
  const creditTvaCode = resolveByRole('CREDIT_TVA', chartOfAccounts).code
  const tvaADecaisserCode = resolveByRole('TVA_A_DECAISSER', chartOfAccounts).code

  const entries: VATEntry[] = []
  const date = calculation.periodEnd
  const periodLabel = formatPeriodLabel(calculation.periodStart, calculation.periodEnd)
  const baseLabel = `Liquidation TVA ${periodLabel}`

  // Determine if we have CA3 data
  const isCA3 = 'sectionB' in calculation
  const totalCollected = isCA3
    ? (calculation as CA3Calculation).sectionB.ligne14_totalB
    : calculation.collected.total
  const totalDeductible = isCA3
    ? (calculation as CA3Calculation).sectionC.ligne22_totalC
    : calculation.deductible.total
  const tvaImmo = isCA3
    ? (calculation as CA3Calculation).sectionC.ligne19_tvaImmo
    : 0
  const tvaABS = isCA3
    ? (calculation as CA3Calculation).sectionC.ligne20_tvaABS
    : calculation.deductible.total
  const previousCredit = isCA3
    ? (calculation as CA3Calculation).sectionD.ligne23_creditReporte
    : (calculation as VATCalculation).previousCredit
  const netAfterCredit = isCA3
    ? (calculation as CA3Calculation).sectionE.ligne25_tvaAPayer - (calculation as CA3Calculation).sectionE.ligne26_creditTVA
    : (calculation as VATCalculation).netAfterCredit

  // Entry 1: Debit TVA collectée (solder le compte)
  if (totalCollected > 0) {
    entries.push({
      date,
      accountCode: tvaCollecteeCode,
      debit: totalCollected,
      credit: 0,
      label: `${baseLabel} - Solde TVA collectée`,
    })
  }

  // Entry 2: Credit TVA déductible immobilisations
  if (tvaImmo > 0) {
    entries.push({
      date,
      accountCode: tvaDeductibleImmoCode,
      debit: 0,
      credit: tvaImmo,
      label: `${baseLabel} - Solde TVA déductible immo`,
    })
  }

  // Entry 3: Credit TVA déductible ABS
  if (tvaABS > 0) {
    entries.push({
      date,
      accountCode: tvaDeductibleAbsCode,
      debit: 0,
      credit: tvaABS,
      label: `${baseLabel} - Solde TVA déductible ABS`,
    })
  }

  // Entry 4: If using previous credit, credit it
  if (previousCredit > 0 && totalCollected > totalDeductible) {
    const creditUsed = Math.min(previousCredit, totalCollected - totalDeductible)
    entries.push({
      date,
      accountCode: creditTvaCode,
      debit: 0,
      credit: creditUsed,
      label: `${baseLabel} - Utilisation crédit TVA antérieur`,
    })
  }

  // Entry 5: Net - either TVA à décaisser or Crédit de TVA
  if (netAfterCredit > 0) {
    // TVA à payer
    entries.push({
      date,
      accountCode: tvaADecaisserCode,
      debit: 0,
      credit: netAfterCredit,
      label: `${baseLabel} - TVA à décaisser`,
    })
  } else if (netAfterCredit < 0) {
    // Crédit de TVA
    entries.push({
      date,
      accountCode: creditTvaCode,
      debit: Math.abs(netAfterCredit),
      credit: 0,
      label: `${baseLabel} - Crédit de TVA`,
    })
  }

  return entries
}

/**
 * Format period label for entries (e.g., "Janvier 2025", "T1 2025")
 */
function formatPeriodLabel(periodStart: string, periodEnd: string): string {
  const startDate = new Date(periodStart)
  const endDate = new Date(periodEnd)

  const startMonth = startDate.getMonth()
  const endMonth = endDate.getMonth()
  const year = endDate.getFullYear()

  // Monthly
  if (startMonth === endMonth) {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ]
    return `${months[endMonth]} ${year}`
  }

  // Quarterly
  const monthsDiff = endMonth - startMonth + 1
  if (monthsDiff === 3) {
    const quarter = Math.floor(endMonth / 3) + 1
    return `T${quarter} ${year}`
  }

  // Yearly or other
  if (monthsDiff === 12) {
    return `${year}`
  }

  // Custom period
  return `${periodStart} au ${periodEnd}`
}

/**
 * Save VAT liquidation entries to database
 */
export async function saveVATLiquidationEntries(
  entries: VATEntry[],
  _declarationId?: string
): Promise<void> {
  if (entries.length === 0) {
    return
  }

  const journalOD = await resolveJournal('misc')
  const pieceNumber = await generatePieceNumber(journalOD.code)

  const dbEntries = entries.map(entry => ({
    company_id: COMPANY_ID,
    journal: journalOD.code,
    date: entry.date,
    piece_number: pieceNumber,
    label: entry.label,
    account_code: entry.accountCode,
    debit: entry.debit,
    credit: entry.credit,
    is_validated: false,
  }))

  const { error } = await supabase
    .from('accounting_entries')
    .insert(dbEntries)

  if (error) {
    console.error('Error saving VAT liquidation entries:', error)
    throw new Error(`Erreur création écritures liquidation TVA: ${error.message}`)
  }

  console.log(`Created ${entries.length} VAT liquidation entries with piece number ${pieceNumber}`)
}

// ============ VAT Declaration Management ============

/**
 * Get VAT declaration history
 */
export async function getVATDeclarationHistory(): Promise<VATDeclaration[]> {
  const { data, error } = await supabase
    .from('vat_declarations')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('period_end', { ascending: false })

  if (error) {
    console.error('Error fetching VAT declaration history:', error)
    throw new Error(`Erreur chargement historique déclarations TVA: ${error.message}`)
  }

  if (!data) {
    console.error('getVATDeclarationHistory: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour VAT declarations')
  }

  return data
}

/**
 * Get a specific VAT declaration by ID
 */
export async function getVATDeclaration(declarationId: string): Promise<VATDeclaration | null> {
  const { data, error } = await supabase
    .from('vat_declarations')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('id', declarationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching VAT declaration:', error)
    throw new Error(`Erreur chargement déclaration TVA: ${error.message}`)
  }

  return data
}

/**
 * Save a new VAT declaration
 */
export async function saveVATDeclaration(declaration: VATDeclarationData): Promise<VATDeclaration> {
  const { data, error } = await supabase
    .from('vat_declarations')
    .insert({
      company_id: COMPANY_ID,
      period_start: declaration.periodStart,
      period_end: declaration.periodEnd,
      type: declaration.type,
      status: declaration.status || 'draft',
      total_collected: declaration.totalCollected,
      total_deductible: declaration.totalDeductible,
      total_due: declaration.totalDue,
      credit_carry_forward: declaration.creditCarryForward,
      // Store CA3 data as JSON if available
      // ca3_data: declaration.ca3Data, // Uncomment when DB column exists
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving VAT declaration:', error)
    throw new Error(`Erreur sauvegarde déclaration TVA: ${error.message}`)
  }

  console.log(`Created VAT declaration for period ${declaration.periodStart} to ${declaration.periodEnd}`)
  return data
}

/**
 * Update VAT declaration status
 */
export async function updateVATDeclarationStatus(
  declarationId: string,
  status: 'draft' | 'submitted' | 'paid',
  additionalData?: { submitted_at?: string; paid_at?: string }
): Promise<VATDeclaration> {
  const updateData: Record<string, unknown> = { status }

  if (status === 'submitted' && !additionalData?.submitted_at) {
    updateData.submitted_at = new Date().toISOString()
  }
  if (status === 'paid' && !additionalData?.paid_at) {
    updateData.paid_at = new Date().toISOString()
  }
  if (additionalData) {
    Object.assign(updateData, additionalData)
  }

  const { data, error } = await supabase
    .from('vat_declarations')
    .update(updateData)
    .eq('company_id', COMPANY_ID)
    .eq('id', declarationId)
    .select()
    .single()

  if (error) {
    console.error('Error updating VAT declaration status:', error)
    throw new Error(`Erreur mise à jour statut déclaration TVA: ${error.message}`)
  }

  return data
}

/**
 * Delete a VAT declaration (only if draft)
 */
export async function deleteVATDeclaration(declarationId: string): Promise<void> {
  // First verify it's a draft
  const declaration = await getVATDeclaration(declarationId)
  if (!declaration) {
    throw new Error('Déclaration TVA introuvable')
  }
  if (declaration.status !== 'draft') {
    throw new Error('Seules les déclarations en brouillon peuvent être supprimées')
  }

  const { error } = await supabase
    .from('vat_declarations')
    .delete()
    .eq('company_id', COMPANY_ID)
    .eq('id', declarationId)

  if (error) {
    console.error('Error deleting VAT declaration:', error)
    throw new Error(`Erreur suppression déclaration TVA: ${error.message}`)
  }

  console.log(`Deleted VAT declaration ${declarationId}`)
}

// ============ Helper Functions ============

/**
 * Get period bounds for monthly declaration
 */
export function getMonthlyPeriod(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // Last day of month

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}

/**
 * Get period bounds for quarterly declaration
 */
export function getQuarterlyPeriod(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3
  const startDate = new Date(year, startMonth, 1)
  const endDate = new Date(year, startMonth + 3, 0) // Last day of quarter

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}

/**
 * Get period bounds for yearly declaration
 */
export function getYearlyPeriod(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  }
}

/**
 * Determine declaration type from period
 */
export function determineDeclarationType(
  periodStart: string,
  periodEnd: string
): 'monthly' | 'quarterly' | 'yearly' {
  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1

  if (monthsDiff === 1) return 'monthly'
  if (monthsDiff === 3) return 'quarterly'
  if (monthsDiff === 12) return 'yearly'

  // Default to monthly for custom periods
  return 'monthly'
}

/**
 * Check if a declaration already exists for a period
 */
export async function declarationExistsForPeriod(
  periodStart: string,
  periodEnd: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('vat_declarations')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .limit(1)

  if (error) {
    console.error('Error checking existing declaration:', error)
    throw new Error(`Erreur vérification déclaration existante: ${error.message}`)
  }

  return (data?.length || 0) > 0
}

// ============ PDF Export ============

/**
 * Generate PDF data for CA3 export
 */
export function generateCA3PDFData(calculation: CA3Calculation): {
  title: string
  period: string
  sections: Array<{
    name: string
    lines: Array<{ code: string; label: string; base?: number; taux?: string; montant: number }>
  }>
} {
  const periodLabel = formatPeriodLabel(calculation.periodStart, calculation.periodEnd)

  return {
    title: 'Déclaration de TVA - Formulaire CA3',
    period: periodLabel,
    sections: [
      {
        name: 'A - OPÉRATIONS IMPOSABLES',
        lines: [
          { code: '01', label: 'Ventes, prestations de services France', montant: calculation.sectionA.ligne01_ventesFrance },
          { code: '02', label: 'Autres opérations imposables', montant: calculation.sectionA.ligne02_autresOperations },
          { code: '03', label: 'Acquisitions intracommunautaires', montant: calculation.sectionA.ligne03_acquisitionsIntra },
          { code: '04', label: 'TOTAL A', montant: calculation.sectionA.ligne04_totalA },
        ],
      },
      {
        name: 'B - TVA BRUTE',
        lines: [
          { code: '08', label: 'Opérations imposables à 20%', base: calculation.sectionB.ligne08_base20, taux: '20%', montant: calculation.sectionB.ligne08_tva20 },
          { code: '09', label: 'Opérations imposables à 10%', base: calculation.sectionB.ligne09_base10, taux: '10%', montant: calculation.sectionB.ligne09_tva10 },
          { code: '9B', label: 'Opérations imposables à 5,5%', base: calculation.sectionB.ligne9B_base55, taux: '5,5%', montant: calculation.sectionB.ligne9B_tva55 },
          { code: '10', label: 'Opérations imposables à 2,1%', base: calculation.sectionB.ligne10_base21, taux: '2,1%', montant: calculation.sectionB.ligne10_tva21 },
          { code: '11', label: 'TVA sur acquisitions intracommunautaires', base: calculation.sectionB.ligne11_baseIntra, montant: calculation.sectionB.ligne11_tvaIntra },
          { code: '14', label: 'TOTAL TVA BRUTE', montant: calculation.sectionB.ligne14_totalB },
        ],
      },
      {
        name: 'C - TVA DÉDUCTIBLE',
        lines: [
          { code: '19', label: 'TVA sur immobilisations (44562)', montant: calculation.sectionC.ligne19_tvaImmo },
          { code: '20', label: 'TVA sur autres biens et services (44566)', montant: calculation.sectionC.ligne20_tvaABS },
          { code: '21', label: 'Autre TVA à déduire', montant: calculation.sectionC.ligne21_autreTVA },
          { code: '22', label: 'TOTAL TVA DÉDUCTIBLE', montant: calculation.sectionC.ligne22_totalC },
        ],
      },
      {
        name: 'D - CRÉDIT DE TVA',
        lines: [
          { code: '23', label: 'Crédit de TVA reporté de la période précédente', montant: calculation.sectionD.ligne23_creditReporte },
          { code: '24', label: 'TOTAL CRÉDITS', montant: calculation.sectionD.ligne24_totalD },
        ],
      },
      {
        name: 'E - TVA NETTE',
        lines: [
          { code: '25', label: 'TVA nette à payer (B - C - D)', montant: calculation.sectionE.ligne25_tvaAPayer },
          { code: '26', label: 'Crédit de TVA (C + D - B)', montant: calculation.sectionE.ligne26_creditTVA },
        ],
      },
    ],
  }
}
