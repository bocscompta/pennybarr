// Cloture Service - Fiscal year closing operations (PCG French standard)
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { FiscalYear, AccountingEntry, ChartOfAccount } from '../types/database'
import { resolveByRole, resolveJournal } from './accountResolverService'

// ============ Types ============

export interface FiscalYearValidation {
  balanced: boolean
  totalDebit: number
  totalCredit: number
  difference: number
  accountsCount: number
}

// Pre-closure validation result (comprehensive checks before closing)
export interface PreClosureValidation {
  isBalanced: boolean              // Total Debit = Total Credit
  hasUnlettered: number            // Nb ecritures non lettrees (401/411)
  hasUnreconciledBank: number      // Nb transactions bancaires non rapprochees
  hasPendingInvoices: number       // Factures en brouillon
  hasPendingExpenses: number       // Notes de frais non validees
  warnings: string[]
  errors: string[]
  canClose: boolean                // true if no blocking errors
}

// Regularization summary for display
export interface RegularizationSummary {
  ccaCount: number       // Charges Constatees d'Avance
  ccaAmount: number
  fnpCount: number       // Factures Non Parvenues
  fnpAmount: number
  pcaCount: number       // Produits Constates d'Avance
  pcaAmount: number
  hasRegularizations: boolean
}

export interface ClosingEntry {
  accountCode: string
  accountLabel: string
  debit: number
  credit: number
}

export interface CreateFiscalYearData {
  name: string
  startDate: string
  endDate: string
}

interface AccountBalance {
  account_code: string
  account_label: string
  total_debit: number
  total_credit: number
  balance: number
}

// ============ Chart of Accounts Loader ============

/**
 * Load chart of accounts from database
 */
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
    console.error('loadChartOfAccounts: no accounts found for company', COMPANY_ID)
    throw new Error('Plan comptable vide ou introuvable. Vérifiez la configuration.')
  }

  return data
}

// ============ Fiscal Year CRUD ============

/**
 * Get all fiscal years for the company
 */
export async function getFiscalYears(): Promise<FiscalYear[]> {
  const { data, error } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching fiscal years:', error)
    throw new Error(`Erreur chargement exercices fiscaux: ${error.message}`)
  }

  if (!data) {
    console.error('listFiscalYears: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour fiscal years')
  }

  return data
}

/**
 * Get a single fiscal year by ID
 */
export async function getFiscalYear(fiscalYearId: string): Promise<FiscalYear> {
  const { data, error } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('id', fiscalYearId)
    .single()

  if (error) {
    console.error('Error fetching fiscal year:', error)
    throw new Error(`Erreur chargement exercice fiscal: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Exercice fiscal non trouvé: ${fiscalYearId}`)
  }

  return data
}

/**
 * Create a new fiscal year
 */
export async function createFiscalYear(data: CreateFiscalYearData): Promise<FiscalYear> {
  // Validate dates
  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)

  if (endDate <= startDate) {
    throw new Error('La date de fin doit être postérieure à la date de début')
  }

  // Check for overlapping fiscal years
  const { data: existingYears, error: checkError } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .or(`start_date.lte.${data.endDate},end_date.gte.${data.startDate}`)

  if (checkError) {
    console.error('Error checking existing fiscal years:', checkError)
    throw new Error(`Erreur vérification exercices existants: ${checkError.message}`)
  }

  // Filter for actual overlaps
  const overlapping = (existingYears || []).filter(fy => {
    const fyStart = new Date(fy.start_date)
    const fyEnd = new Date(fy.end_date)
    return startDate <= fyEnd && endDate >= fyStart
  })

  if (overlapping.length > 0) {
    throw new Error(`Un exercice fiscal existe déjà sur cette période: ${overlapping[0].name}`)
  }

  const { data: created, error } = await supabase
    .from('fiscal_years')
    .insert({
      company_id: COMPANY_ID,
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      is_closed: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating fiscal year:', error)
    throw new Error(`Erreur création exercice fiscal: ${error.message}`)
  }

  console.log(`Created fiscal year: ${created.name}`)
  return created
}

// ============ Validation ============

/**
 * Validate that total debit equals total credit for a fiscal year
 */
export async function validateFiscalYearBalance(fiscalYearId: string): Promise<FiscalYearValidation> {
  // Get fiscal year dates
  const fiscalYear = await getFiscalYear(fiscalYearId)

  // Get all entries for the fiscal year period
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select('id, account_code, debit, credit')
    .eq('company_id', COMPANY_ID)
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)

  if (error) {
    console.error('Error fetching entries for validation:', error)
    throw new Error(`Erreur chargement écritures pour validation: ${error.message}`)
  }

  const entriesList = entries || []

  // Calculate totals
  const totalDebit = entriesList.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entriesList.reduce((sum, e) => sum + (e.credit || 0), 0)
  const difference = Math.abs(totalDebit - totalCredit)

  // Count unique accounts
  const uniqueAccounts = new Set(entriesList.map(e => e.account_code))

  return {
    balanced: difference < 0.01,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    difference: Math.round(difference * 100) / 100,
    accountsCount: uniqueAccounts.size,
  }
}

// ============ Pre-Closure Validation ============

/**
 * Comprehensive pre-closure validation
 * Checks balance, unlettered entries, unreconciled bank transactions, pending invoices/expenses
 */
export async function validatePreClosure(fiscalYearId: string): Promise<PreClosureValidation> {
  const fiscalYear = await getFiscalYear(fiscalYearId)
  const warnings: string[] = []
  const errors: string[] = []

  // 1. Check balance
  const balanceValidation = await validateFiscalYearBalance(fiscalYearId)
  if (!balanceValidation.balanced) {
    errors.push(`L'exercice n'est pas equilibre. Difference: ${balanceValidation.difference} EUR`)
  }

  // 2. Count unlettered entries on supplier (401xxx) and customer (411xxx) accounts
  const { data: unletteredEntries, error: unletteredError } = await supabase
    .from('accounting_entries')
    .select('id, account_code, debit, credit')
    .eq('company_id', COMPANY_ID)
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)
    .is('lettrage_code', null)
    .or('account_code.like.401%,account_code.like.411%')

  if (unletteredError) {
    console.error('Error fetching unlettered entries:', unletteredError)
    throw new Error(`Erreur verification ecritures non lettrees: ${unletteredError.message}`)
  }

  const unletteredCount = unletteredEntries?.length || 0
  if (unletteredCount > 0) {
    warnings.push(`${unletteredCount} ecriture(s) non lettree(s) sur comptes tiers (401/411)`)
  }

  // 3. Count unreconciled bank transactions
  const { count: unreconciledCount, error: unreconciledError } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)
    .eq('is_reconciled', false)

  if (unreconciledError) {
    console.error('Error fetching unreconciled transactions:', unreconciledError)
    throw new Error(`Erreur verification transactions non rapprochees: ${unreconciledError.message}`)
  }

  const unreconciledBankCount = unreconciledCount || 0
  if (unreconciledBankCount > 0) {
    warnings.push(`${unreconciledBankCount} transaction(s) bancaire(s) non rapprochee(s)`)
  }

  // 4. Count pending invoices (draft status)
  const { count: pendingInvoicesCount, error: invoicesError } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)
    .eq('status', 'draft')

  if (invoicesError) {
    console.error('Error fetching pending invoices:', invoicesError)
    throw new Error(`Erreur verification factures en brouillon: ${invoicesError.message}`)
  }

  const pendingInvoices = pendingInvoicesCount || 0
  if (pendingInvoices > 0) {
    warnings.push(`${pendingInvoices} facture(s) en brouillon`)
  }

  // 5. Count pending expense reports (not approved/paid)
  const { count: pendingExpensesCount, error: expensesError } = await supabase
    .from('expense_reports')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)
    .in('status', ['draft', 'submitted'])

  if (expensesError) {
    console.error('Error fetching pending expenses:', expensesError)
    throw new Error(`Erreur verification notes de frais: ${expensesError.message}`)
  }

  const pendingExpenses = pendingExpensesCount || 0
  if (pendingExpenses > 0) {
    warnings.push(`${pendingExpenses} note(s) de frais non validee(s)`)
  }

  // Determine if closure is possible (only balance errors are blocking)
  const canClose = errors.length === 0

  return {
    isBalanced: balanceValidation.balanced,
    hasUnlettered: unletteredCount,
    hasUnreconciledBank: unreconciledBankCount,
    hasPendingInvoices: pendingInvoices,
    hasPendingExpenses: pendingExpenses,
    warnings,
    errors,
    canClose,
  }
}

/**
 * Get summary of regularization entries (CCA, FNP, PCA) for the fiscal year
 */
export async function getRegularizationSummary(fiscalYearId: string): Promise<RegularizationSummary> {
  const fiscalYear = await getFiscalYear(fiscalYearId)

  // Get CCA entries (account 486)
  const { data: ccaEntries, error: ccaError } = await supabase
    .from('accounting_entries')
    .select('id, debit')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', '486')
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)
    .gt('debit', 0)

  if (ccaError) {
    console.error('Error fetching CCA entries:', ccaError)
    throw new Error(`Erreur chargement ecritures CCA: ${ccaError.message}`)
  }

  const ccaCount = ccaEntries?.length || 0
  const ccaAmount = ccaEntries?.reduce((sum, e) => sum + (e.debit || 0), 0) || 0

  // Get FNP entries (account 4081)
  const { data: fnpEntries, error: fnpError } = await supabase
    .from('accounting_entries')
    .select('id, credit')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', '4081')
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)
    .gt('credit', 0)

  if (fnpError) {
    console.error('Error fetching FNP entries:', fnpError)
    throw new Error(`Erreur chargement ecritures FNP: ${fnpError.message}`)
  }

  const fnpCount = fnpEntries?.length || 0
  const fnpAmount = fnpEntries?.reduce((sum, e) => sum + (e.credit || 0), 0) || 0

  // Get PCA entries (account 487)
  const { data: pcaEntries, error: pcaError } = await supabase
    .from('accounting_entries')
    .select('id, credit')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', '487')
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)
    .gt('credit', 0)

  if (pcaError) {
    console.error('Error fetching PCA entries:', pcaError)
    throw new Error(`Erreur chargement ecritures PCA: ${pcaError.message}`)
  }

  const pcaCount = pcaEntries?.length || 0
  const pcaAmount = pcaEntries?.reduce((sum, e) => sum + (e.credit || 0), 0) || 0

  return {
    ccaCount,
    ccaAmount: Math.round(ccaAmount * 100) / 100,
    fnpCount,
    fnpAmount: Math.round(fnpAmount * 100) / 100,
    pcaCount,
    pcaAmount: Math.round(pcaAmount * 100) / 100,
    hasRegularizations: ccaCount > 0 || fnpCount > 0 || pcaCount > 0,
  }
}

// ============ Account Balances ============

/**
 * Get account balances for a fiscal year
 * Groups entries by account and calculates net balance
 */
async function getAccountBalances(
  fiscalYearId: string,
  accountPrefix?: string
): Promise<AccountBalance[]> {
  const fiscalYear = await getFiscalYear(fiscalYearId)

  // Build query
  let query = supabase
    .from('accounting_entries')
    .select('account_code, debit, credit')
    .eq('company_id', COMPANY_ID)
    .gte('date', fiscalYear.start_date)
    .lte('date', fiscalYear.end_date)

  if (accountPrefix) {
    query = query.like('account_code', `${accountPrefix}%`)
  }

  const { data: entries, error } = await query

  if (error) {
    console.error('Error fetching account balances:', error)
    throw new Error(`Erreur chargement soldes comptes: ${error.message}`)
  }

  if (!entries) {
    console.error('getAccountBalancesForFiscalYear: entries is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour account balances')
  }

  // Group by account and calculate balances
  const balanceMap = new Map<string, { debit: number; credit: number }>()

  for (const entry of entries) {
    const existing = balanceMap.get(entry.account_code) || { debit: 0, credit: 0 }
    existing.debit += entry.debit || 0
    existing.credit += entry.credit || 0
    balanceMap.set(entry.account_code, existing)
  }

  // Get account labels
  const accountCodes = Array.from(balanceMap.keys())
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('code, label')
    .eq('company_id', COMPANY_ID)
    .in('code', accountCodes)

  const accountLabels = new Map((accounts || []).map(a => [a.code, a.label]))

  // Convert to array with balances
  const result: AccountBalance[] = []

  for (const [accountCode, totals] of balanceMap) {
    const balance = totals.debit - totals.credit
    if (Math.abs(balance) > 0.01) {  // Skip zero balances
      result.push({
        account_code: accountCode,
        account_label: accountLabels.get(accountCode) || accountCode,
        total_debit: Math.round(totals.debit * 100) / 100,
        total_credit: Math.round(totals.credit * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      })
    }
  }

  return result.sort((a, b) => a.account_code.localeCompare(b.account_code))
}

// ============ Piece Number Generation ============

/**
 * Generate unique piece number for a journal
 */
async function generatePieceNumber(journal: string, date: string): Promise<string> {
  const year = new Date(date).getFullYear()
  const prefix = `${journal}${year}`

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

// ============ Closing Entries ============

/**
 * Generate closing entries for a fiscal year
 * - Transfer class 6 (charges) accounts to result account (12)
 * - Transfer class 7 (produits) accounts to result account (12)
 *
 * For class 6 (normally debit balance):
 *   Credit 6xxx = balance, Debit 12 = balance
 *
 * For class 7 (normally credit balance):
 *   Debit 7xxx = balance, Credit 12 = balance
 */
export async function generateClosingEntries(fiscalYearId: string): Promise<AccountingEntry[]> {
  const fiscalYear = await getFiscalYear(fiscalYearId)

  if (fiscalYear.is_closed) {
    throw new Error('Cet exercice est déjà clôturé')
  }

  // Validate balance first
  const validation = await validateFiscalYearBalance(fiscalYearId)
  if (!validation.balanced) {
    throw new Error(`L'exercice n'est pas équilibré. Différence: ${validation.difference}€`)
  }

  // Resolve journal and accounts from database
  const chartOfAccounts = await loadChartOfAccounts()
  const journalOD = await resolveJournal('misc')
  const accountResultat = resolveByRole('RESULTAT_EXERCICE', chartOfAccounts).code

  // Get class 6 balances (charges)
  const chargeBalances = await getAccountBalances(fiscalYearId, '6')

  // Get class 7 balances (produits)
  const produitBalances = await getAccountBalances(fiscalYearId, '7')

  if (chargeBalances.length === 0 && produitBalances.length === 0) {
    throw new Error('Aucune écriture de gestion (comptes 6 et 7) à clôturer')
  }

  const closingDate = fiscalYear.end_date
  const pieceNumber = await generatePieceNumber(journalOD.code, closingDate)

  const entriesToCreate: Partial<AccountingEntry>[] = []

  // Calculate total result
  let totalCharges = 0
  let totalProduits = 0

  // Close class 6 accounts (charges) - normally debit balance
  for (const account of chargeBalances) {
    if (account.balance !== 0) {
      totalCharges += account.balance

      // Credit the charge account to zero it out
      entriesToCreate.push({
        company_id: COMPANY_ID,
        journal: journalOD.code,
        date: closingDate,
        piece_number: pieceNumber,
        label: `Clôture ${account.account_code} - ${account.account_label}`,
        account_code: account.account_code,
        debit: account.balance < 0 ? Math.abs(account.balance) : 0,
        credit: account.balance > 0 ? account.balance : 0,
        is_validated: true,
      })
    }
  }

  // Close class 7 accounts (produits) - normally credit balance
  for (const account of produitBalances) {
    if (account.balance !== 0) {
      totalProduits += Math.abs(account.balance)

      // Debit the produit account to zero it out
      entriesToCreate.push({
        company_id: COMPANY_ID,
        journal: journalOD.code,
        date: closingDate,
        piece_number: pieceNumber,
        label: `Clôture ${account.account_code} - ${account.account_label}`,
        account_code: account.account_code,
        debit: account.balance < 0 ? 0 : Math.abs(account.balance),
        credit: account.balance < 0 ? Math.abs(account.balance) : 0,
        is_validated: true,
      })
    }
  }

  // Calculate result (Produits - Charges)
  // Note: charges have positive balance (debit), produits have negative balance (credit)
  const result = totalProduits - totalCharges

  // Transfer to result account
  if (result !== 0) {
    entriesToCreate.push({
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date: closingDate,
      piece_number: pieceNumber,
      label: result > 0 ? 'Bénéfice de l\'exercice' : 'Perte de l\'exercice',
      account_code: accountResultat,
      debit: result < 0 ? Math.abs(result) : 0,
      credit: result > 0 ? result : 0,
      is_validated: true,
    })
  }

  // Insert closing entries
  const { data: created, error } = await supabase
    .from('accounting_entries')
    .insert(entriesToCreate)
    .select()

  if (error) {
    console.error('Error creating closing entries:', error)
    throw new Error(`Erreur création écritures de clôture: ${error.message}`)
  }

  console.log(`Created ${created.length} closing entries for fiscal year ${fiscalYear.name}`)
  return created
}

/**
 * Preview closing entries without saving
 */
export async function previewClosingEntries(fiscalYearId: string): Promise<ClosingEntry[]> {
  // Validate fiscal year exists (we don't use the result directly, just checking it exists)
  await getFiscalYear(fiscalYearId)

  // Resolve result account from database
  const chartOfAccounts = await loadChartOfAccounts()
  const accountResultat = resolveByRole('RESULTAT_EXERCICE', chartOfAccounts).code

  // Get class 6 balances (charges)
  const chargeBalances = await getAccountBalances(fiscalYearId, '6')

  // Get class 7 balances (produits)
  const produitBalances = await getAccountBalances(fiscalYearId, '7')

  const preview: ClosingEntry[] = []

  let totalCharges = 0
  let totalProduits = 0

  // Preview class 6 closings
  for (const account of chargeBalances) {
    if (account.balance !== 0) {
      totalCharges += account.balance
      preview.push({
        accountCode: account.account_code,
        accountLabel: account.account_label,
        debit: account.balance < 0 ? Math.abs(account.balance) : 0,
        credit: account.balance > 0 ? account.balance : 0,
      })
    }
  }

  // Preview class 7 closings
  for (const account of produitBalances) {
    if (account.balance !== 0) {
      totalProduits += Math.abs(account.balance)
      preview.push({
        accountCode: account.account_code,
        accountLabel: account.account_label,
        debit: account.balance < 0 ? 0 : Math.abs(account.balance),
        credit: account.balance < 0 ? Math.abs(account.balance) : 0,
      })
    }
  }

  // Result entry
  const result = totalProduits - totalCharges
  if (result !== 0) {
    preview.push({
      accountCode: accountResultat,
      accountLabel: result > 0 ? 'Bénéfice de l\'exercice' : 'Perte de l\'exercice',
      debit: result < 0 ? Math.abs(result) : 0,
      credit: result > 0 ? result : 0,
    })
  }

  return preview
}

// ============ Opening Entries (A-Nouveaux) ============

/**
 * Generate opening entries for a new fiscal year
 * Carries forward balances from class 1-5 accounts (bilan)
 *
 * For each account with balance:
 *   - Debit balance accounts: Debit account, Credit 890 (Bilan d'ouverture)
 *   - Credit balance accounts: Credit account, Debit 890 (Bilan d'ouverture)
 *
 * The 890 account is the counterpart for all opening entries
 */
export async function generateOpeningEntries(
  newFiscalYearId: string,
  previousFiscalYearId: string
): Promise<AccountingEntry[]> {
  const newFiscalYear = await getFiscalYear(newFiscalYearId)
  const previousFiscalYear = await getFiscalYear(previousFiscalYearId)

  if (!previousFiscalYear.is_closed) {
    throw new Error('L\'exercice precedent doit etre cloture avant de generer les a-nouveaux')
  }

  // Resolve journal and accounts from database
  const chartOfAccounts = await loadChartOfAccounts()
  const journalAN = await resolveJournal('opening')
  const accountBilanOuverture = resolveByRole('BILAN_OUVERTURE', chartOfAccounts).code

  // Get balances for classes 1-5 (bilan accounts)
  const bilanBalances: AccountBalance[] = []

  for (let classNum = 1; classNum <= 5; classNum++) {
    const classBalances = await getAccountBalances(previousFiscalYearId, classNum.toString())
    bilanBalances.push(...classBalances)
  }

  if (bilanBalances.length === 0) {
    throw new Error('Aucun compte de bilan a reprendre')
  }

  const openingDate = newFiscalYear.start_date
  const pieceNumber = await generatePieceNumber(journalAN.code, openingDate)

  const entriesToCreate: Partial<AccountingEntry>[] = []

  // Track totals for counterpart entry
  let totalDebit = 0
  let totalCredit = 0

  // Create opening entries for each balance account
  for (const account of bilanBalances) {
    if (account.balance !== 0) {
      const debitAmount = account.balance > 0 ? account.balance : 0
      const creditAmount = account.balance < 0 ? Math.abs(account.balance) : 0

      entriesToCreate.push({
        company_id: COMPANY_ID,
        journal: journalAN.code,
        date: openingDate,
        piece_number: pieceNumber,
        label: `A-nouveau ${account.account_code} - ${account.account_label}`,
        account_code: account.account_code,
        debit: debitAmount,
        credit: creditAmount,
        is_validated: true,
      })

      totalDebit += debitAmount
      totalCredit += creditAmount
    }
  }

  // Add counterpart entry to Bilan d'ouverture
  // The bilan d'ouverture account balances out all opening entries
  const counterpartDebit = totalCredit  // Reverse to balance
  const counterpartCredit = totalDebit  // Reverse to balance

  if (counterpartDebit > 0 || counterpartCredit > 0) {
    entriesToCreate.push({
      company_id: COMPANY_ID,
      journal: journalAN.code,
      date: openingDate,
      piece_number: pieceNumber,
      label: 'Bilan d\'ouverture - Contrepartie a-nouveaux',
      account_code: accountBilanOuverture,
      debit: counterpartDebit,
      credit: counterpartCredit,
      is_validated: true,
    })
  }

  // Insert opening entries
  const { data: created, error } = await supabase
    .from('accounting_entries')
    .insert(entriesToCreate)
    .select()

  if (error) {
    console.error('Error creating opening entries:', error)
    throw new Error(`Erreur création écritures d'à-nouveaux: ${error.message}`)
  }

  console.log(`Created ${created.length} opening entries for fiscal year ${newFiscalYear.name}`)
  return created
}

/**
 * Preview opening entries without saving
 * Includes counterpart entry to 890 (Bilan d'ouverture)
 */
export async function previewOpeningEntries(
  previousFiscalYearId: string
): Promise<ClosingEntry[]> {
  // Resolve bilan d'ouverture account from database
  const chartOfAccounts = await loadChartOfAccounts()
  const accountBilanOuverture = resolveByRole('BILAN_OUVERTURE', chartOfAccounts).code

  const preview: ClosingEntry[] = []
  let totalDebit = 0
  let totalCredit = 0

  // Get balances for classes 1-5 (bilan accounts)
  for (let classNum = 1; classNum <= 5; classNum++) {
    const classBalances = await getAccountBalances(previousFiscalYearId, classNum.toString())

    for (const account of classBalances) {
      if (account.balance !== 0) {
        const debitAmount = account.balance > 0 ? account.balance : 0
        const creditAmount = account.balance < 0 ? Math.abs(account.balance) : 0

        preview.push({
          accountCode: account.account_code,
          accountLabel: account.account_label,
          debit: debitAmount,
          credit: creditAmount,
        })

        totalDebit += debitAmount
        totalCredit += creditAmount
      }
    }
  }

  // Add counterpart entry to Bilan d'ouverture
  const counterpartDebit = totalCredit
  const counterpartCredit = totalDebit

  if (counterpartDebit > 0 || counterpartCredit > 0) {
    preview.push({
      accountCode: accountBilanOuverture,
      accountLabel: 'Bilan d\'ouverture',
      debit: counterpartDebit,
      credit: counterpartCredit,
    })
  }

  return preview
}

// ============ Lock Fiscal Year ============

/**
 * Lock a fiscal year (mark as closed)
 * Should be called after generating closing entries
 */
export async function lockFiscalYear(fiscalYearId: string): Promise<FiscalYear> {
  const fiscalYear = await getFiscalYear(fiscalYearId)

  if (fiscalYear.is_closed) {
    throw new Error('Cet exercice est déjà clôturé')
  }

  // Validate balance before locking
  const validation = await validateFiscalYearBalance(fiscalYearId)
  if (!validation.balanced) {
    throw new Error(`Impossible de clôturer: l'exercice n'est pas équilibré. Différence: ${validation.difference}€`)
  }

  const { data: updated, error } = await supabase
    .from('fiscal_years')
    .update({
      is_closed: true,
      closed_at: new Date().toISOString(),
    })
    .eq('company_id', COMPANY_ID)
    .eq('id', fiscalYearId)
    .select()
    .single()

  if (error) {
    console.error('Error locking fiscal year:', error)
    throw new Error(`Erreur clôture exercice fiscal: ${error.message}`)
  }

  console.log(`Locked fiscal year: ${updated.name}`)
  return updated
}

/**
 * Unlock a fiscal year (reopen for modifications)
 * Should only be used in exceptional cases
 */
export async function unlockFiscalYear(fiscalYearId: string): Promise<FiscalYear> {
  const fiscalYear = await getFiscalYear(fiscalYearId)

  if (!fiscalYear.is_closed) {
    throw new Error('Cet exercice n\'est pas clôturé')
  }

  // Check if there's a subsequent closed fiscal year
  const { data: subsequentYears, error: checkError } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .gt('start_date', fiscalYear.end_date)
    .eq('is_closed', true)

  if (checkError) {
    console.error('Error checking subsequent fiscal years:', checkError)
    throw new Error(`Erreur vérification exercices suivants: ${checkError.message}`)
  }

  if (subsequentYears && subsequentYears.length > 0) {
    throw new Error('Impossible de rouvrir: un exercice ultérieur est clôturé')
  }

  const { data: updated, error } = await supabase
    .from('fiscal_years')
    .update({
      is_closed: false,
      closed_at: null,
    })
    .eq('company_id', COMPANY_ID)
    .eq('id', fiscalYearId)
    .select()
    .single()

  if (error) {
    console.error('Error unlocking fiscal year:', error)
    throw new Error(`Erreur réouverture exercice fiscal: ${error.message}`)
  }

  console.log(`Unlocked fiscal year: ${updated.name}`)
  return updated
}

/**
 * Reopen a fiscal year (cancel closure)
 * - Deletes closing entries (journal OD at closing date)
 * - Deletes opening entries in subsequent fiscal year (journal AN)
 * - Unlocks the fiscal year
 *
 * WARNING: This is a destructive operation that should only be used in exceptional cases
 */
export async function reopenFiscalYear(fiscalYearId: string): Promise<{
  fiscalYear: FiscalYear
  deletedClosingEntries: number
  deletedOpeningEntries: number
}> {
  const fiscalYear = await getFiscalYear(fiscalYearId)

  if (!fiscalYear.is_closed) {
    throw new Error('Cet exercice n\'est pas cloture')
  }

  // Check if there's a subsequent closed fiscal year
  const { data: subsequentYears, error: checkError } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .gt('start_date', fiscalYear.end_date)
    .eq('is_closed', true)

  if (checkError) {
    console.error('Error checking subsequent fiscal years:', checkError)
    throw new Error(`Erreur verification exercices suivants: ${checkError.message}`)
  }

  if (subsequentYears && subsequentYears.length > 0) {
    throw new Error('Impossible de rouvrir: un exercice ulterieur est cloture')
  }

  // Resolve journals and accounts from database
  const chartOfAccounts = await loadChartOfAccounts()
  const journalOD = await resolveJournal('misc')
  const journalAN = await resolveJournal('opening')
  const accountResultat = resolveByRole('RESULTAT_EXERCICE', chartOfAccounts).code

  // Find and delete closing entries (OD journal at closing date)
  // These are entries that zero out class 6 and 7 accounts
  const { data: closingEntries, error: closingFetchError } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('journal', journalOD.code)
    .eq('date', fiscalYear.end_date)
    .or(`account_code.like.6%,account_code.like.7%,account_code.eq.${accountResultat}`)

  if (closingFetchError) {
    console.error('Error fetching closing entries:', closingFetchError)
    throw new Error(`Erreur recherche ecritures de cloture: ${closingFetchError.message}`)
  }

  let deletedClosingEntries = 0
  if (closingEntries && closingEntries.length > 0) {
    const closingIds = closingEntries.map(e => e.id)
    const { error: deleteClosingError } = await supabase
      .from('accounting_entries')
      .delete()
      .in('id', closingIds)

    if (deleteClosingError) {
      console.error('Error deleting closing entries:', deleteClosingError)
      throw new Error(`Erreur suppression ecritures de cloture: ${deleteClosingError.message}`)
    }
    deletedClosingEntries = closingEntries.length
  }

  // Find subsequent fiscal year and delete its opening entries
  const { data: nextYear, error: nextYearError } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .gt('start_date', fiscalYear.end_date)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextYearError) {
    console.error('Error fetching next fiscal year:', nextYearError)
    throw new Error(`Erreur recherche exercice suivant: ${nextYearError.message}`)
  }

  let deletedOpeningEntries = 0
  if (nextYear) {
    // Delete opening entries (AN journal at first day of next year)
    const { data: openingEntries, error: openingFetchError } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('company_id', COMPANY_ID)
      .eq('journal', journalAN.code)
      .eq('date', nextYear.start_date)

    if (openingFetchError) {
      console.error('Error fetching opening entries:', openingFetchError)
      throw new Error(`Erreur recherche ecritures d'a-nouveaux: ${openingFetchError.message}`)
    }

    if (openingEntries && openingEntries.length > 0) {
      const openingIds = openingEntries.map(e => e.id)
      const { error: deleteOpeningError } = await supabase
        .from('accounting_entries')
        .delete()
        .in('id', openingIds)

      if (deleteOpeningError) {
        console.error('Error deleting opening entries:', deleteOpeningError)
        throw new Error(`Erreur suppression ecritures d'a-nouveaux: ${deleteOpeningError.message}`)
      }
      deletedOpeningEntries = openingEntries.length
    }
  }

  // Unlock the fiscal year
  const updatedFiscalYear = await unlockFiscalYear(fiscalYearId)

  console.log(`Reopened fiscal year: ${updatedFiscalYear.name}, deleted ${deletedClosingEntries} closing entries and ${deletedOpeningEntries} opening entries`)

  return {
    fiscalYear: updatedFiscalYear,
    deletedClosingEntries,
    deletedOpeningEntries,
  }
}

// ============ Full Closing Process ============

/**
 * Complete fiscal year closing process
 * 1. Validate balance
 * 2. Generate closing entries
 * 3. Lock the fiscal year
 */
export async function closeFiscalYear(fiscalYearId: string): Promise<{
  fiscalYear: FiscalYear
  closingEntries: AccountingEntry[]
}> {
  // Step 1: Validate
  const validation = await validateFiscalYearBalance(fiscalYearId)
  if (!validation.balanced) {
    throw new Error(`L'exercice n'est pas équilibré. Différence: ${validation.difference}€`)
  }

  // Step 2: Generate closing entries
  const closingEntries = await generateClosingEntries(fiscalYearId)

  // Step 3: Lock the fiscal year
  const fiscalYear = await lockFiscalYear(fiscalYearId)

  return { fiscalYear, closingEntries }
}

/**
 * Complete new fiscal year opening process
 * 1. Create new fiscal year
 * 2. Generate opening entries from previous year
 */
export async function openNewFiscalYear(
  previousFiscalYearId: string,
  newYearData: CreateFiscalYearData
): Promise<{
  fiscalYear: FiscalYear
  openingEntries: AccountingEntry[]
}> {
  const previousYear = await getFiscalYear(previousFiscalYearId)

  if (!previousYear.is_closed) {
    throw new Error('L\'exercice précédent doit être clôturé')
  }

  // Step 1: Create new fiscal year
  const fiscalYear = await createFiscalYear(newYearData)

  // Step 2: Generate opening entries
  const openingEntries = await generateOpeningEntries(fiscalYear.id, previousFiscalYearId)

  return { fiscalYear, openingEntries }
}
