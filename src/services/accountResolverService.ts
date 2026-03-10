/**
 * Account Resolver Service
 * Resolves account codes from chart_of_accounts (database).
 * All account codes used in entries MUST come from this resolver, never hardcoded.
 */

import type { ChartOfAccount, AccountingJournal, ExpenseCategoryAccount } from '../types/database'
import { supabase, COMPANY_ID } from '../lib/supabase'

export interface ResolvedAccount {
  code: string
  label: string
}

// PCG class prefixes - used ONLY for lookup, never as actual account codes
// These identify the "role" of an account in the French PCG standard
export const ROLE_PREFIX = {
  TVA_DEDUCTIBLE: '445660',          // TVA déductible sur autres biens et services
  TVA_DEDUCTIBLE_ENCAISS: '44564',   // TVA déductible sur encaissements
  TVA_DEDUCTIBLE_AUTOLIQ: '445663',  // TVA déductible autoliquidée
  TVA_COLLECTEE: '445710',           // TVA collectée
  TVA_COLLECTEE_ENCAISS: '44574',    // TVA collectée sur encaissements
  TVA_DUE_AUTOLIQ: '44530',          // TVA due autoliquidée
  ECART_CONVERSION: '4716',          // Écart de conversion actif
  PERTE_CHANGE: '656',               // Pertes de change sur créances/dettes commerciales
  GAIN_CHANGE: '756',                // Gains de change sur créances/dettes commerciales
  GAIN_CHANGE_FINANCIER: '766',      // Gains de change financiers
  CCA: '486',                        // Charges constatées d'avance
  FNP: '4081',                       // Factures non parvenues
  TVA_FNP: '44586',                  // TVA sur factures non parvenues
  PCA: '487',                        // Produits constatés d'avance
  AAR: '4098',                       // Avoirs à recevoir
} as const

/**
 * Resolve an account from chart_of_accounts by PCG prefix.
 * Returns the most specific (longest code) matching account.
 *
 * @throws Error if no matching account found in chart_of_accounts
 */
export function resolveByPrefix(
  prefix: string,
  chartOfAccounts: ChartOfAccount[]
): ResolvedAccount {
  const matches = chartOfAccounts.filter(a => a.code.startsWith(prefix))

  if (matches.length === 0) {
    console.error(`resolveByPrefix: no account found for prefix '${prefix}' in ${chartOfAccounts.length} accounts`)
    throw new Error(`Aucun compte trouvé pour le préfixe '${prefix}' dans le plan comptable. Vérifiez les paramètres.`)
  }

  // Exact match first
  const exact = matches.find(a => a.code === prefix)
  if (exact) {
    return { code: exact.code, label: exact.label }
  }

  // Most specific (longest code) = leaf account
  matches.sort((a, b) => b.code.length - a.code.length || a.code.localeCompare(b.code))
  return { code: matches[0].code, label: matches[0].label }
}

/**
 * Resolve supplier account (401xxx) by third party name.
 * Searches chart_of_accounts for 401xxx entries matching the name.
 *
 * @throws Error if no matching supplier account found
 */
export function resolveSupplierAccount(
  thirdPartyName: string,
  chartOfAccounts: ChartOfAccount[]
): ResolvedAccount {
  const normalized = thirdPartyName.trim().toUpperCase()

  // All 401xxx leaf accounts (not the root "401" entry)
  const supplierAccounts = chartOfAccounts.filter(a =>
    a.code.startsWith('401') && a.code.length > 3
  )

  // Exact match on label
  const exactMatch = supplierAccounts.find(a =>
    a.label.toUpperCase().trim() === normalized
  )
  if (exactMatch) {
    return { code: exactMatch.code, label: exactMatch.label }
  }

  // Partial match: label contains name or name contains label
  const partialMatch = supplierAccounts.find(a => {
    const labelUp = a.label.toUpperCase().trim()
    return labelUp.includes(normalized) || normalized.includes(labelUp)
  })
  if (partialMatch) {
    return { code: partialMatch.code, label: partialMatch.label }
  }

  console.error(`resolveSupplierAccount: no 401xxx account found for '${thirdPartyName}' in ${supplierAccounts.length} supplier accounts`)
  throw new Error(`Aucun compte fournisseur (401xxx) trouvé pour '${thirdPartyName}'. Ajoutez ce fournisseur dans le plan comptable (Paramètres).`)
}

/**
 * Resolve customer account (411xxx) by third party name.
 *
 * @throws Error if no matching customer account found
 */
export function resolveCustomerAccount(
  thirdPartyName: string,
  chartOfAccounts: ChartOfAccount[]
): ResolvedAccount {
  const normalized = thirdPartyName.trim().toUpperCase()

  const customerAccounts = chartOfAccounts.filter(a =>
    a.code.startsWith('411') && a.code.length > 3
  )

  const exactMatch = customerAccounts.find(a =>
    a.label.toUpperCase().trim() === normalized
  )
  if (exactMatch) {
    return { code: exactMatch.code, label: exactMatch.label }
  }

  const partialMatch = customerAccounts.find(a => {
    const labelUp = a.label.toUpperCase().trim()
    return labelUp.includes(normalized) || normalized.includes(labelUp)
  })
  if (partialMatch) {
    return { code: partialMatch.code, label: partialMatch.label }
  }

  console.error(`resolveCustomerAccount: no 411xxx account found for '${thirdPartyName}'`)
  throw new Error(`Aucun compte client (411xxx) trouvé pour '${thirdPartyName}'. Ajoutez ce client dans le plan comptable (Paramètres).`)
}

/**
 * Resolve bank account (512xxx) by bank account name from bank_accounts table.
 * Matches against chart_of_accounts 512xxx entries.
 *
 * @param bankAccountName Name of the bank account (e.g., "CIC Contrat Pro Global")
 */
export function resolveBankAccount(
  bankAccountName: string,
  chartOfAccounts: ChartOfAccount[]
): ResolvedAccount {
  // All 512xxx leaf accounts
  const bankAccounts = chartOfAccounts.filter(a =>
    a.code.startsWith('512') && a.code.length > 4
  )

  if (bankAccounts.length === 0) {
    console.error('resolveBankAccount: no 512xxx account found in chart of accounts')
    throw new Error('Aucun compte banque (512xxx) trouvé dans le plan comptable. Vérifiez les paramètres.')
  }

  // Try to match by name
  const normalized = bankAccountName.trim().toUpperCase()
  const match = bankAccounts.find(a =>
    a.label.toUpperCase().includes(normalized) || normalized.includes(a.label.toUpperCase())
  )
  if (match) {
    return { code: match.code, label: match.label }
  }

  // Try matching by partial keywords (e.g., "CIC" in both names)
  const keywords = normalized.split(/[\s\-]+/).filter(w => w.length > 2)
  for (const keyword of keywords) {
    const keywordMatch = bankAccounts.find(a =>
      a.label.toUpperCase().includes(keyword)
    )
    if (keywordMatch) {
      return { code: keywordMatch.code, label: keywordMatch.label }
    }
  }

  console.error(`resolveBankAccount: no matching 512xxx account for '${bankAccountName}'`)
  throw new Error(`Aucun compte banque (512xxx) correspondant à '${bankAccountName}'. Vérifiez le plan comptable.`)
}

/**
 * Resolve account label from chart_of_accounts.
 * Uses exact match first, then prefix matching.
 */
export function resolveLabel(
  code: string,
  chartOfAccounts: ChartOfAccount[],
  thirdPartyName?: string
): string {
  // Exact match
  const exact = chartOfAccounts.find(a => a.code === code)
  if (exact) {
    return exact.label
  }

  // Code is prefix of a DB entry
  const prefixMatch = chartOfAccounts.find(a => a.code.startsWith(code))
  if (prefixMatch) {
    return prefixMatch.label
  }

  // DB entry is prefix of our code
  const reverseMatch = chartOfAccounts
    .filter(a => code.startsWith(a.code))
    .sort((a, b) => b.code.length - a.code.length)
  if (reverseMatch.length > 0) {
    return reverseMatch[0].label
  }

  // For supplier/customer accounts, use third party name
  if ((code.startsWith('401') || code.startsWith('411')) && thirdPartyName) {
    return thirdPartyName
  }

  console.error(`resolveLabel: account '${code}' not found in ${chartOfAccounts.length} chart of accounts entries`)
  throw new Error(`Compte '${code}' non trouvé dans le plan comptable. Vérifiez les paramètres.`)
}

/**
 * Resolve an account by its semantic role (account_role column).
 * Uses the account_role field set in chart_of_accounts.
 *
 * @throws Error if no account with this role exists
 */
export function resolveByRole(
  role: string,
  chartOfAccounts: ChartOfAccount[]
): ResolvedAccount {
  const match = chartOfAccounts.find(a => a.account_role === role)

  if (!match) {
    console.error(`resolveByRole: no account found with role '${role}' in ${chartOfAccounts.length} accounts`)
    throw new Error(`Aucun compte avec le rôle '${role}' trouvé dans le plan comptable. Vérifiez la configuration.`)
  }

  return { code: match.code, label: match.label }
}

/**
 * Resolve a journal by its type from the accounting_journals table.
 *
 * @throws Error if no journal with this type exists
 */
export async function resolveJournal(
  journalType: string
): Promise<{ code: string; label: string }> {
  const { data, error } = await supabase
    .from('accounting_journals')
    .select('code, label')
    .eq('company_id', COMPANY_ID)
    .eq('journal_type', journalType)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.error(`resolveJournal: no journal found for type '${journalType}'`, error)
    throw new Error(`Aucun journal trouvé pour le type '${journalType}'. Vérifiez la configuration des journaux.`)
  }

  return { code: data.code, label: data.label }
}

/**
 * Resolve an expense category account from the expense_category_accounts table.
 *
 * @throws Error if no category with this key exists
 */
export async function resolveExpenseCategory(
  categoryKey: string
): Promise<{ accountCode: string; label: string }> {
  const { data, error } = await supabase
    .from('expense_category_accounts')
    .select('account_code, category_label')
    .eq('company_id', COMPANY_ID)
    .eq('category_key', categoryKey)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.error(`resolveExpenseCategory: no category found for key '${categoryKey}'`, error)
    throw new Error(`Aucune catégorie de frais trouvée pour '${categoryKey}'. Vérifiez la configuration.`)
  }

  return { accountCode: data.account_code, label: data.category_label }
}
