// Dolibarr API Service
// Clé API récupérée depuis secure_vault (CLAUDE.md règle 6.2)
import { getSecretFromVault } from '../lib/supabase'

const API_BASE = '/api/index.php'

// Cache pour la clé API (évite de requêter le vault à chaque appel)
let cachedApiKey: string | null = null
let cacheInitPromise: Promise<string> | null = null

/**
 * Récupère la clé API Dolibarr depuis le vault Supabase
 * Utilise un cache pour éviter les requêtes répétées
 */
async function getDolibarrApiKey(): Promise<string> {
  // Si on a déjà la clé en cache, la retourner
  if (cachedApiKey) {
    return cachedApiKey
  }

  // Si une initialisation est déjà en cours, attendre sa résolution
  if (cacheInitPromise) {
    return cacheInitPromise
  }

  // Démarrer l'initialisation
  cacheInitPromise = getSecretFromVault('DOLIBARR_API_KEY')
    .then(key => {
      cachedApiKey = key
      return key
    })
    .catch(error => {
      cacheInitPromise = null // Reset pour permettre un retry
      throw error
    })

  return cacheInitPromise
}

async function dolibarrFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Récupérer la clé API depuis le vault
  const apiKey = await getDolibarrApiKey()

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'DOLAPIKEY': apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Dolibarr API Error: ${response.status} - ${error}`)
  }

  return response.json()
}

// Types
export interface ThirdParty {
  id: string
  name: string
  email: string
  phone: string
  address: string
  zip: string
  town: string
  country: string
  client: string // '0' or '1'
  fournisseur: string // '0' or '1'
}

export interface Invoice {
  id: string
  ref: string
  socid: string
  date: string
  date_lim_reglement: string
  total_ht: string
  total_tva: string
  total_ttc: string
  paye: string // '0' or '1'
  fk_statut: string
  type: string
}

export interface BankAccount {
  id: string
  ref: string
  label: string
  bank: string
  number: string
  balance: number
  currency_code: string
}

export interface Product {
  id: string
  ref: string
  label: string
  price: string
  price_ttc: string
  type: string // '0' = product, '1' = service
  tosell: string
  tobuy: string
}

export interface BankTransaction {
  id: string
  rowid: string
  dateo: string // Date operation
  datev: string // Date value
  label: string
  amount: string
  fk_account: string
  num_releve: string
  fk_type: string
  rappro: string // '0' or '1' - reconciled
}

export interface ExpenseReport {
  id: string
  ref: string
  socid: string
  fk_user_author: string
  date_debut: string
  date_fin: string
  total_ht: string
  total_tva: string
  total_ttc: string
  fk_statut: string
}

export interface Proposal {
  id: string
  ref: string
  socid: string
  datec: string
  date_valid: string
  fin_validite: string
  total_ht: string
  total_tva: string
  total_ttc: string
  fk_statut: string
}

export interface DolibarrDocument {
  id: string
  name: string
  size: string
  date: string
  fullname: string
  level1name: string
  relativename: string
  type: string
}

export interface Loan {
  id: string
  ref: string
  label: string
  capital: string
  datestart: string
  dateend: string
  rate: string
  fk_bank: string
}

// API Methods

// Third Parties (Clients & Fournisseurs)
export async function getThirdParties(): Promise<ThirdParty[]> {
  return dolibarrFetch<ThirdParty[]>('/thirdparties')
}

export async function getClients(): Promise<ThirdParty[]> {
  return dolibarrFetch<ThirdParty[]>('/thirdparties?mode=1') // mode=1 = clients
}

export async function getSuppliers(): Promise<ThirdParty[]> {
  return dolibarrFetch<ThirdParty[]>('/thirdparties?mode=2') // mode=2 = fournisseurs
}

export async function getThirdParty(id: string): Promise<ThirdParty> {
  return dolibarrFetch<ThirdParty>(`/thirdparties/${id}`)
}

export async function createThirdParty(data: Partial<ThirdParty>): Promise<string> {
  return dolibarrFetch<string>('/thirdparties', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Invoices (Factures clients)
export async function getInvoices(): Promise<Invoice[]> {
  return dolibarrFetch<Invoice[]>('/invoices')
}

export async function getInvoice(id: string): Promise<Invoice> {
  return dolibarrFetch<Invoice>(`/invoices/${id}`)
}

export async function createInvoice(data: Partial<Invoice>): Promise<string> {
  return dolibarrFetch<string>('/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Supplier Invoices (Factures fournisseurs)
export async function getSupplierInvoices(): Promise<Invoice[]> {
  return dolibarrFetch<Invoice[]>('/supplierinvoices')
}

// Bank Accounts
export async function getBankAccounts(): Promise<BankAccount[]> {
  return dolibarrFetch<BankAccount[]>('/bankaccounts')
}

export async function getBankAccount(id: string): Promise<BankAccount> {
  return dolibarrFetch<BankAccount>(`/bankaccounts/${id}`)
}

export interface CreateBankAccountData {
  ref: string
  label: string
  type: number // 1=current, 2=savings
  currency_code: string
  country_id: number
  bank?: string
  number?: string
  iban_prefix?: string
  bic?: string
  min_allowed?: number
  min_desired?: number
}

export async function createBankAccount(data: CreateBankAccountData): Promise<string> {
  return dolibarrFetch<string>('/bankaccounts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Products & Services
export async function getProducts(): Promise<Product[]> {
  return dolibarrFetch<Product[]>('/products')
}

export async function getProduct(id: string): Promise<Product> {
  return dolibarrFetch<Product>(`/products/${id}`)
}

// Bank Transactions
export async function getBankTransactions(accountId: string): Promise<BankTransaction[]> {
  return dolibarrFetch<BankTransaction[]>(`/bankaccounts/${accountId}/lines`)
}

export interface CreateBankTransactionData {
  date: string // Unix timestamp
  type: string // 'VIR', 'PRE', 'CB', 'CHQ', etc.
  label: string
  amount: number
  num_chq?: string
  emetteur?: string
  banque?: string
}

export async function createBankTransaction(
  accountId: string,
  data: CreateBankTransactionData
): Promise<string> {
  return dolibarrFetch<string>(`/bankaccounts/${accountId}/lines`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createBankTransactions(
  accountId: string,
  transactions: CreateBankTransactionData[]
): Promise<{ success: number; errors: string[] }> {
  const results = { success: 0, errors: [] as string[] }

  for (const tx of transactions) {
    try {
      await createBankTransaction(accountId, tx)
      results.success++
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      results.errors.push(`${tx.label}: ${error}`)
    }
  }

  return results
}

// Expense Reports
export async function getExpenseReports(): Promise<ExpenseReport[]> {
  return dolibarrFetch<ExpenseReport[]>('/expensereports')
}

// Proposals (Devis)
export async function getProposals(): Promise<Proposal[]> {
  return dolibarrFetch<Proposal[]>('/proposals')
}

// Documents (GED)
export async function getDocuments(modulepart?: string): Promise<DolibarrDocument[]> {
  const query = modulepart ? `?modulepart=${modulepart}` : ''
  return dolibarrFetch<DolibarrDocument[]>(`/documents${query}`)
}

// Loans (Emprunts)
export async function getLoans(): Promise<Loan[]> {
  return dolibarrFetch<Loan[]>('/loans')
}

// Dashboard Stats
export async function getDashboardStats() {
  // No fallback - errors must propagate explicitly (CLAUDE.md Rule #2)
  const [invoices, supplierInvoices, bankAccounts] = await Promise.all([
    getInvoices(),
    getSupplierInvoices(),
    getBankAccounts(),
  ])

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_ttc || '0'), 0)
  const totalPurchases = supplierInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_ttc || '0'), 0)
  const bankBalance = bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)

  const unpaidInvoices = invoices.filter(inv => inv.paye === '0')
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_ttc || '0'), 0)

  return {
    bankBalance,
    totalInvoiced,
    totalPurchases,
    unpaidInvoicesCount: unpaidInvoices.length,
    totalUnpaid,
    invoicesCount: invoices.length,
    supplierInvoicesCount: supplierInvoices.length,
  }
}

// Test connection
export async function testConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await dolibarrFetch('/status')
    return { connected: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown connection error'
    console.error('Dolibarr connection test failed:', error)
    return { connected: false, error }
  }
}
