// Balance Service - Balances auxiliaires (fournisseurs & clients) et balance agee
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { AccountingEntry } from '../types/database'

// ============ Types ============

export interface BalanceEntry {
  accountCode: string
  thirdPartyId?: string
  thirdPartyName: string
  debit: number
  credit: number
  balance: number  // debit - credit
}

export interface AgingEntry {
  thirdPartyId?: string
  thirdPartyName: string
  notDue: number      // Non echu
  days0to30: number   // 0-30 jours de retard
  days30to60: number  // 30-60 jours de retard
  days60to90: number  // 60-90 jours de retard
  daysOver90: number  // > 90 jours de retard
  total: number
}

export interface BalanceFilters {
  startDate?: string
  endDate?: string
  supplierId?: string
  customerId?: string
}

// ============ Helper Functions ============

/**
 * Get third party name from account code by looking up third_parties
 * Account codes are formatted as 401XXXXXX (supplier) or 411XXXXXX (customer)
 * where XXXXXX is the last 6 chars of the third_party_id
 */
async function getThirdPartyNameByAccountCode(accountCode: string): Promise<{ id?: string; name: string }> {
  // Extract suffix from account code (everything after 401 or 411)
  const suffix = accountCode.slice(3).toUpperCase()

  if (!suffix || suffix === '000000') {
    return { name: 'Tiers inconnu' }
  }

  // Search for third party where ID ends with this suffix
  const { data, error } = await supabase
    .from('third_parties')
    .select('id, name')
    .eq('company_id', COMPANY_ID)
    .limit(100)

  if (error) {
    console.error('Error fetching third parties:', error)
    return { name: `Compte ${accountCode}` }
  }

  // Find matching third party by suffix
  const match = data?.find(tp => {
    const tpSuffix = tp.id.replace(/-/g, '').slice(-6).toUpperCase()
    return tpSuffix === suffix
  })

  if (match) {
    return { id: match.id, name: match.name }
  }

  return { name: `Compte ${accountCode}` }
}

/**
 * Calculate number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000 // milliseconds in a day
  return Math.floor((date2.getTime() - date1.getTime()) / oneDay)
}

// ============ Balance Functions ============

/**
 * Get supplier balance (auxiliary ledger for 401xxx accounts)
 * Balance fournisseurs - comptes auxiliaires
 */
export async function getSupplierBalance(filters?: BalanceFilters): Promise<BalanceEntry[]> {
  let query = supabase
    .from('accounting_entries')
    .select('account_code, debit, credit')
    .eq('company_id', COMPANY_ID)
    .like('account_code', '401%')

  // Apply date filters
  if (filters?.startDate) {
    query = query.gte('date', filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte('date', filters.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching supplier entries:', error)
    throw new Error(`Erreur chargement ecritures fournisseurs: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  // Group by account code and calculate totals
  const balanceMap = new Map<string, { debit: number; credit: number }>()

  for (const entry of data) {
    const existing = balanceMap.get(entry.account_code) || { debit: 0, credit: 0 }
    existing.debit += entry.debit || 0
    existing.credit += entry.credit || 0
    balanceMap.set(entry.account_code, existing)
  }

  // Build result with third party names
  const results: BalanceEntry[] = []

  for (const [accountCode, totals] of balanceMap) {
    const thirdParty = await getThirdPartyNameByAccountCode(accountCode)

    // Filter by supplier ID if specified
    if (filters?.supplierId && thirdParty.id !== filters.supplierId) {
      continue
    }

    const balance = totals.debit - totals.credit

    // Only include accounts with non-zero balance
    if (Math.abs(balance) >= 0.01) {
      results.push({
        accountCode,
        thirdPartyId: thirdParty.id,
        thirdPartyName: thirdParty.name,
        debit: Math.round(totals.debit * 100) / 100,
        credit: Math.round(totals.credit * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      })
    }
  }

  // Sort by third party name
  results.sort((a, b) => a.thirdPartyName.localeCompare(b.thirdPartyName))

  return results
}

/**
 * Get customer balance (auxiliary ledger for 411xxx accounts)
 * Balance clients - comptes auxiliaires
 */
export async function getCustomerBalance(filters?: BalanceFilters): Promise<BalanceEntry[]> {
  let query = supabase
    .from('accounting_entries')
    .select('account_code, debit, credit')
    .eq('company_id', COMPANY_ID)
    .like('account_code', '411%')

  // Apply date filters
  if (filters?.startDate) {
    query = query.gte('date', filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte('date', filters.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching customer entries:', error)
    throw new Error(`Erreur chargement ecritures clients: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  // Group by account code and calculate totals
  const balanceMap = new Map<string, { debit: number; credit: number }>()

  for (const entry of data) {
    const existing = balanceMap.get(entry.account_code) || { debit: 0, credit: 0 }
    existing.debit += entry.debit || 0
    existing.credit += entry.credit || 0
    balanceMap.set(entry.account_code, existing)
  }

  // Build result with third party names
  const results: BalanceEntry[] = []

  for (const [accountCode, totals] of balanceMap) {
    const thirdParty = await getThirdPartyNameByAccountCode(accountCode)

    // Filter by customer ID if specified
    if (filters?.customerId && thirdParty.id !== filters.customerId) {
      continue
    }

    const balance = totals.debit - totals.credit

    // Only include accounts with non-zero balance
    if (Math.abs(balance) >= 0.01) {
      results.push({
        accountCode,
        thirdPartyId: thirdParty.id,
        thirdPartyName: thirdParty.name,
        debit: Math.round(totals.debit * 100) / 100,
        credit: Math.round(totals.credit * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      })
    }
  }

  // Sort by third party name
  results.sort((a, b) => a.thirdPartyName.localeCompare(b.thirdPartyName))

  return results
}

// ============ Aging Report Functions ============

/**
 * Get aging report (balance agee) for suppliers or customers
 * Analyses unpaid invoices by age buckets
 *
 * @param type - 'supplier' for accounts payable aging, 'customer' for accounts receivable aging
 * @param asOfDate - Reference date for calculating age (defaults to today)
 */
export async function getAgingReport(
  type: 'supplier' | 'customer',
  asOfDate?: string
): Promise<AgingEntry[]> {
  const referenceDate = asOfDate ? new Date(asOfDate) : new Date()

  // Get unpaid invoices
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      id,
      third_party_id,
      total_ttc,
      due_date,
      third_party:third_parties(id, name)
    `)
    .eq('company_id', COMPANY_ID)
    .eq('type', type)
    .neq('status', 'paid')
    .neq('status', 'cancelled')

  if (error) {
    console.error('Error fetching invoices for aging report:', error)
    throw new Error(`Erreur chargement factures: ${error.message}`)
  }

  if (!invoices || invoices.length === 0) {
    return []
  }

  // Group by third party and calculate aging buckets
  const agingMap = new Map<string, AgingEntry>()

  for (const invoice of invoices) {
    const thirdPartyId = invoice.third_party_id || 'unknown'
    const thirdPartyData = invoice.third_party as unknown as { name: string } | { id: string; name: string }[] | null
    const thirdParty = Array.isArray(thirdPartyData) ? thirdPartyData[0] : thirdPartyData
    const thirdPartyName = thirdParty?.name || 'Tiers inconnu'
    const amount = invoice.total_ttc || 0

    // Get or create aging entry for this third party
    let entry = agingMap.get(thirdPartyId)
    if (!entry) {
      entry = {
        thirdPartyId: invoice.third_party_id || undefined,
        thirdPartyName,
        notDue: 0,
        days0to30: 0,
        days30to60: 0,
        days60to90: 0,
        daysOver90: 0,
        total: 0,
      }
      agingMap.set(thirdPartyId, entry)
    }

    // Calculate days overdue
    const dueDate = invoice.due_date ? new Date(invoice.due_date) : referenceDate
    const daysOverdue = daysBetween(dueDate, referenceDate)

    // Classify into aging buckets
    if (daysOverdue < 0) {
      // Not yet due
      entry.notDue += amount
    } else if (daysOverdue <= 30) {
      entry.days0to30 += amount
    } else if (daysOverdue <= 60) {
      entry.days30to60 += amount
    } else if (daysOverdue <= 90) {
      entry.days60to90 += amount
    } else {
      entry.daysOver90 += amount
    }

    entry.total += amount
  }

  // Convert to array and round values
  const results: AgingEntry[] = Array.from(agingMap.values()).map(entry => ({
    ...entry,
    notDue: Math.round(entry.notDue * 100) / 100,
    days0to30: Math.round(entry.days0to30 * 100) / 100,
    days30to60: Math.round(entry.days30to60 * 100) / 100,
    days60to90: Math.round(entry.days60to90 * 100) / 100,
    daysOver90: Math.round(entry.daysOver90 * 100) / 100,
    total: Math.round(entry.total * 100) / 100,
  }))

  // Sort by total amount descending
  results.sort((a, b) => b.total - a.total)

  return results
}

// ============ Open Items Functions ============

/**
 * Get unlettered entries (ecritures non lettrees) for an account
 * Open items are entries that haven't been matched/reconciled yet
 */
export async function getOpenItems(accountCode: string): Promise<AccountingEntry[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', accountCode)
    .is('lettrage_code', null)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching open items:', error)
    throw new Error(`Erreur chargement ecritures non lettrees: ${error.message}`)
  }

  if (!data) {
    console.error('getOpenItems: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour open items')
  }

  return data
}

/**
 * Get all open items for supplier accounts (401xxx)
 */
export async function getSupplierOpenItems(): Promise<AccountingEntry[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .like('account_code', '401%')
    .is('lettrage_code', null)
    .order('account_code')
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching supplier open items:', error)
    throw new Error(`Erreur chargement ecritures fournisseurs non lettrees: ${error.message}`)
  }

  if (!data) {
    console.error('getSupplierOpenItems: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour supplier open items')
  }

  return data
}

/**
 * Get all open items for customer accounts (411xxx)
 */
export async function getCustomerOpenItems(): Promise<AccountingEntry[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .like('account_code', '411%')
    .is('lettrage_code', null)
    .order('account_code')
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching customer open items:', error)
    throw new Error(`Erreur chargement ecritures clients non lettrees: ${error.message}`)
  }

  if (!data) {
    console.error('getCustomerOpenItems: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour customer open items')
  }

  return data
}

// ============ Account Balance Functions ============

/**
 * Get balance for a specific auxiliary account
 *
 * @param accountCode - The account code (e.g., 401XXXXXX for supplier)
 * @param asOfDate - Optional date to calculate balance up to (defaults to all entries)
 * @returns The account balance (debit - credit)
 */
export async function getAccountBalance(accountCode: string, asOfDate?: string): Promise<number> {
  let query = supabase
    .from('accounting_entries')
    .select('debit, credit')
    .eq('company_id', COMPANY_ID)
    .eq('account_code', accountCode)

  if (asOfDate) {
    query = query.lte('date', asOfDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching account balance:', error)
    throw new Error(`Erreur chargement solde compte ${accountCode}: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return 0
  }

  // Calculate total debit - total credit
  let totalDebit = 0
  let totalCredit = 0

  for (const entry of data) {
    totalDebit += entry.debit || 0
    totalCredit += entry.credit || 0
  }

  return Math.round((totalDebit - totalCredit) * 100) / 100
}

/**
 * Get total balance for all supplier accounts
 */
export async function getTotalSupplierBalance(asOfDate?: string): Promise<number> {
  let query = supabase
    .from('accounting_entries')
    .select('debit, credit')
    .eq('company_id', COMPANY_ID)
    .like('account_code', '401%')

  if (asOfDate) {
    query = query.lte('date', asOfDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching total supplier balance:', error)
    throw new Error(`Erreur chargement solde fournisseurs: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return 0
  }

  let totalDebit = 0
  let totalCredit = 0

  for (const entry of data) {
    totalDebit += entry.debit || 0
    totalCredit += entry.credit || 0
  }

  // For suppliers, balance is typically credit - debit (amount owed)
  // Negative value means we owe money, positive means overpayment
  return Math.round((totalDebit - totalCredit) * 100) / 100
}

/**
 * Get total balance for all customer accounts
 */
export async function getTotalCustomerBalance(asOfDate?: string): Promise<number> {
  let query = supabase
    .from('accounting_entries')
    .select('debit, credit')
    .eq('company_id', COMPANY_ID)
    .like('account_code', '411%')

  if (asOfDate) {
    query = query.lte('date', asOfDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching total customer balance:', error)
    throw new Error(`Erreur chargement solde clients: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return 0
  }

  let totalDebit = 0
  let totalCredit = 0

  for (const entry of data) {
    totalDebit += entry.debit || 0
    totalCredit += entry.credit || 0
  }

  // For customers, positive balance (debit > credit) means they owe us
  return Math.round((totalDebit - totalCredit) * 100) / 100
}

// ============ Summary Functions ============

/**
 * Get a summary of balances for dashboard display
 */
export async function getBalanceSummary(asOfDate?: string): Promise<{
  totalSupplierBalance: number
  totalCustomerBalance: number
  supplierCount: number
  customerCount: number
}> {
  const [supplierBalance, customerBalance] = await Promise.all([
    getSupplierBalance({ endDate: asOfDate }),
    getCustomerBalance({ endDate: asOfDate }),
  ])

  return {
    totalSupplierBalance: supplierBalance.reduce((sum, b) => sum + b.balance, 0),
    totalCustomerBalance: customerBalance.reduce((sum, b) => sum + b.balance, 0),
    supplierCount: supplierBalance.length,
    customerCount: customerBalance.length,
  }
}
