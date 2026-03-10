// Supabase Service - Replace Dolibarr API
import { supabase, COMPANY_ID } from '../lib/supabase'
import type {
  BankAccount,
  BankTransaction,
  BankStatement,
  ThirdParty,
  Invoice,
  ChartOfAccount,
  TransactionCategory,
  DashboardStats,
  PurchaseRequest,
  PurchaseRequestFormData,
} from '../types/database'

// ============ Bank Accounts ============

export async function getBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching bank accounts:', error)
    throw new Error(`Erreur chargement comptes bancaires: ${error.message}`)
  }

  if (!data) {
    console.error('getBankAccounts: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour bank_accounts')
  }

  return data
}

export async function getBankAccount(id: string): Promise<BankAccount | null> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching bank account:', error)
    throw new Error(`Erreur chargement compte: ${error.message}`)
  }

  return data
}

export async function createBankAccount(account: Partial<BankAccount>): Promise<BankAccount> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({
      company_id: COMPANY_ID,
      ...account,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating bank account:', error)
    throw new Error(`Erreur création compte: ${error.message}`)
  }

  return data
}

// ============ Bank Transactions ============

export async function getBankTransactions(bankAccountId?: string): Promise<BankTransaction[]> {
  let query = supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })
    .limit(500)

  if (bankAccountId) {
    query = query.eq('bank_account_id', bankAccountId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching transactions:', error)
    throw new Error(`Erreur chargement transactions: ${error.message}`)
  }

  if (!data) {
    console.error('getBankTransactions: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour bank_transactions')
  }

  return data
}

// Get all transactions from all accounts
export async function getAllBankTransactions(): Promise<BankTransaction[]> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('Error fetching all transactions:', error)
    throw new Error(`Erreur chargement transactions: ${error.message}`)
  }

  if (!data) {
    console.error('getAllBankTransactions: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour bank_transactions')
  }

  return data
}

// Get unreconciled transactions (to justify)
export async function getUnreconciledTransactions(limit: number = 10): Promise<BankTransaction[]> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_reconciled', false)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching unreconciled transactions:', error)
    throw new Error(`Erreur chargement transactions: ${error.message}`)
  }

  if (!data) {
    console.error('getUnreconciledTransactions: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour unreconciled transactions')
  }

  return data
}

export async function createBankTransaction(
  transaction: Omit<BankTransaction, 'id' | 'created_at' | 'updated_at' | 'company_id'>
): Promise<BankTransaction> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .insert({
      ...transaction,
      company_id: COMPANY_ID,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating transaction:', error)
    throw new Error(`Erreur création transaction: ${error.message}`)
  }

  return data
}

export async function createBankTransactions(
  transactions: Omit<BankTransaction, 'id' | 'created_at' | 'updated_at' | 'company_id'>[]
): Promise<{ success: number; duplicates: number; errors: string[] }> {
  const results = { success: 0, duplicates: 0, errors: [] as string[] }

  // Insert in batches of 100, ignoring duplicates
  const batchSize = 100
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize).map(tx => ({
      ...tx,
      company_id: COMPANY_ID,
    }))

    // Use upsert with ignoreDuplicates to skip existing transactions
    const { data, error } = await supabase
      .from('bank_transactions')
      .upsert(batch, {
        onConflict: 'bank_account_id,date,amount,reference',
        ignoreDuplicates: true
      })
      .select()

    if (error) {
      results.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`)
    } else {
      const inserted = data?.length || 0
      const skipped = batch.length - inserted
      results.success += inserted
      results.duplicates += skipped
    }
  }

  return results
}

export async function updateBankTransaction(
  id: string,
  updates: Partial<BankTransaction>
): Promise<BankTransaction> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating transaction:', error)
    throw new Error(`Erreur mise à jour transaction: ${error.message}`)
  }

  return data
}

// ============ Bank Statements ============

export async function createBankStatement(
  data: Omit<BankStatement, 'id' | 'created_at' | 'updated_at'>
): Promise<BankStatement> {
  const { data: statement, error } = await supabase
    .from('bank_statements')
    .insert(data)
    .select()
    .single()

  if (error) {
    console.error('Error creating bank statement:', error)
    throw new Error(`Erreur creation releve bancaire: ${error.message}`)
  }

  return statement
}

export async function getBankStatements(bankAccountId: string): Promise<BankStatement[]> {
  const { data, error } = await supabase
    .from('bank_statements')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .order('statement_date', { ascending: false })

  if (error) {
    console.error('Error fetching bank statements:', error)
    throw new Error(`Erreur chargement releves: ${error.message}`)
  }

  if (!data) {
    console.error('getBankStatements: data is null after successful query')
    throw new Error('Erreur inattendue: donnees manquantes pour bank_statements')
  }

  return data
}

export async function getBankStatement(id: string): Promise<BankStatement> {
  const { data, error } = await supabase
    .from('bank_statements')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching bank statement:', error)
    throw new Error(`Erreur chargement releve: ${error.message}`)
  }

  return data
}

export async function updateBankStatementStatus(
  id: string,
  status: BankStatement['status'],
  reconciliationId?: string
): Promise<BankStatement> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (reconciliationId !== undefined) {
    updates.reconciliation_id = reconciliationId
  }

  const { data, error } = await supabase
    .from('bank_statements')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating bank statement status:', error)
    throw new Error(`Erreur mise a jour releve: ${error.message}`)
  }

  return data
}

// ============ Third Parties ============

export async function getThirdParties(type?: 'customer' | 'supplier'): Promise<ThirdParty[]> {
  let query = supabase
    .from('third_parties')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('name')

  if (type) {
    query = query.or(`type.eq.${type},type.eq.both`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching third parties:', error)
    throw new Error(`Erreur chargement tiers: ${error.message}`)
  }

  if (!data) {
    console.error('getThirdParties: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour third_parties')
  }

  return data
}

export async function getSuppliers(): Promise<ThirdParty[]> {
  return getThirdParties('supplier')
}

// Get suppliers with their balance (unpaid invoices total)
export async function getSuppliersWithBalance(): Promise<(ThirdParty & { balance: number })[]> {
  // First get all suppliers
  const suppliers = await getThirdParties('supplier')

  // Get all unpaid supplier invoices
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('third_party_id, total_ttc, status')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'supplier')
    .neq('status', 'paid')

  if (error) {
    console.error('Error fetching supplier invoices for balance:', error)
    // Return suppliers without balance on error
    return suppliers.map(s => ({ ...s, balance: 0 }))
  }

  // Calculate balance per supplier (sum of unpaid invoices as negative)
  const balanceBySupplier: Record<string, number> = {}
  if (invoices) {
    invoices.forEach(inv => {
      if (inv.third_party_id) {
        balanceBySupplier[inv.third_party_id] = (balanceBySupplier[inv.third_party_id] || 0) - (inv.total_ttc || 0)
      }
    })
  }

  // Merge balance with suppliers
  return suppliers.map(supplier => ({
    ...supplier,
    balance: balanceBySupplier[supplier.id] || 0
  }))
}

export async function getCustomers(): Promise<ThirdParty[]> {
  return getThirdParties('customer')
}

// ============ Invoices ============

export async function getInvoices(type?: 'customer' | 'supplier'): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    throw new Error(`Erreur chargement factures: ${error.message}`)
  }

  if (!data) {
    console.error('getInvoices: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour invoices')
  }

  return data
}

export async function getSupplierInvoices(): Promise<Invoice[]> {
  return getInvoices('supplier')
}

export async function getCustomerInvoices(): Promise<Invoice[]> {
  return getInvoices('customer')
}

export async function updateInvoice(
  id: string,
  updates: Partial<Omit<Invoice, 'id' | 'created_at' | 'company_id'>>
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, third_party:third_parties(*)')
    .single()

  if (error) {
    console.error('Error updating invoice:', error)
    throw new Error(`Erreur mise à jour facture: ${error.message}`)
  }

  return data
}

// ============ Chart of Accounts ============

export async function getChartOfAccounts(): Promise<ChartOfAccount[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('code')

  if (error) {
    console.error('Error fetching chart of accounts:', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }

  if (!data) {
    console.error('getChartOfAccounts: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour chart_of_accounts')
  }

  return data
}

// Create a new account in chart_of_accounts
export async function createChartOfAccount(code: string, label: string): Promise<ChartOfAccount> {
  // Determine account type based on code prefix
  const getAccountType = (code: string): 'asset' | 'liability' | 'equity' | 'income' | 'expense' => {
    const firstDigit = code.charAt(0)
    switch (firstDigit) {
      case '1': return 'equity'      // Capitaux
      case '2': return 'asset'       // Immobilisations
      case '3': return 'asset'       // Stocks
      case '4': return 'asset'       // Tiers (simplified)
      case '5': return 'asset'       // Financiers
      case '6': return 'expense'     // Charges
      case '7': return 'income'      // Produits
      default: return 'asset'
    }
  }

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      company_id: COMPANY_ID,
      code,
      label,
      type: getAccountType(code),
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating account:', error)
    throw new Error(`Erreur création compte: ${error.message}`)
  }

  return data
}

// ============ Categories ============

export async function getTransactionCategories(): Promise<TransactionCategory[]> {
  const { data, error } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('name')

  if (error) {
    console.error('Error fetching categories:', error)
    throw new Error(`Erreur chargement catégories: ${error.message}`)
  }

  if (!data) {
    console.error('getTransactionCategories: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour transaction_categories')
  }

  return data
}

// ============ Dashboard Stats ============

export async function getDashboardStats(): Promise<DashboardStats> {
  // Get bank balances
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('current_balance')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)

  const bankBalance = accounts?.reduce((sum, a) => sum + Number(a.current_balance), 0) || 0

  // Get transaction totals for current year
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('amount')
    .eq('company_id', COMPANY_ID)
    .gte('date', startOfYear)

  let totalIncome = 0
  let totalExpense = 0
  transactions?.forEach(t => {
    if (t.amount > 0) totalIncome += Number(t.amount)
    else totalExpense += Math.abs(Number(t.amount))
  })

  // Get unreconciled transactions count
  const { count: unreconciledTransactions } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('is_reconciled', false)

  // Get pending invoices
  const { count: pendingInvoices } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .in('status', ['draft', 'sent'])

  // Get overdue invoices
  const today = new Date().toISOString().split('T')[0]
  const { count: overdueInvoices } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('status', 'sent')
    .lt('due_date', today)

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    bankBalance,
    unreconciledTransactions: unreconciledTransactions || 0,
    pendingInvoices: pendingInvoices || 0,
    overdueInvoices: overdueInvoices || 0,
  }
}

// ============ Suggested Reconciliations ============

export async function getSuggestedReconciliationStats(): Promise<{ count: number; amount: number }> {
  const { data, error } = await supabase.rpc('get_suggested_reconciliation_stats', {
    p_company_id: COMPANY_ID,
  })

  if (error) {
    throw new Error(`Erreur stats rapprochements: ${error.message}`)
  }

  const row = data?.[0]
  if (!row) {
    throw new Error('Pas de résultat pour get_suggested_reconciliation_stats')
  }

  return {
    count: Number(row.suggested_count),
    amount: Number(row.suggested_amount),
  }
}

export async function getSuggestedReconciliationTransactionIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_suggested_reconciliation_transaction_ids', {
    p_company_id: COMPANY_ID,
  })

  if (error) {
    throw new Error(`Erreur IDs rapprochements: ${error.message}`)
  }

  return (data || []).map((row: { transaction_id: string }) => row.transaction_id)
}

// ============ Connection Test ============

export async function testConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('companies')
      .select('id')
      .eq('id', COMPANY_ID)
      .single()

    if (error) {
      return { connected: false, error: error.message }
    }
    return { connected: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    return { connected: false, error }
  }
}

// ============ Purchase Requests ============

export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select(`
      *,
      lines:purchase_request_lines(*),
      analytics:purchase_request_analytics(*),
      documents:purchase_request_documents(*)
    `)
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching purchase requests:', error)
    throw new Error(`Erreur chargement demandes d'achat: ${error.message}`)
  }

  return data || []
}

export async function getPurchaseRequest(id: string): Promise<PurchaseRequest | null> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select(`
      *,
      lines:purchase_request_lines(*),
      analytics:purchase_request_analytics(*),
      documents:purchase_request_documents(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching purchase request:', error)
    throw new Error(`Erreur chargement demande d'achat: ${error.message}`)
  }

  return data
}

export async function createPurchaseRequest(formData: PurchaseRequestFormData): Promise<PurchaseRequest> {
  // Calculate totals
  const totalHT = formData.products.reduce((sum, p) => sum + (p.quantity * p.priceHT), 0)
  const totalTVA = formData.products.reduce((sum, p) => sum + (p.quantity * p.priceHT * p.tva / 100), 0)
  const totalTTC = totalHT + totalTVA

  // Generate reference
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('purchase_requests')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .gte('created_at', `${year}-01-01`)

  const reference = `DA-${year}-${String((count || 0) + 1).padStart(4, '0')}`

  // Create the purchase request
  const { data: request, error: requestError } = await supabase
    .from('purchase_requests')
    .insert({
      company_id: COMPANY_ID,
      reference,
      status: 'pending',
      supplier_id: formData.supplier || null,
      supplier_name: formData.supplierName || null,
      motif: formData.motif || null,
      delivery_address: formData.deliveryAddress || null,
      estimated_delivery_date: formData.estimatedDeliveryDate || null,
      currency: formData.currency,
      total_ht: totalHT,
      total_tva: totalTVA,
      total_ttc: totalTTC,
    })
    .select()
    .single()

  if (requestError) {
    console.error('Error creating purchase request:', requestError)
    throw new Error(`Erreur création demande d'achat: ${requestError.message}`)
  }

  // Insert product lines
  if (formData.products.length > 0) {
    const lines = formData.products.map((p, index) => ({
      purchase_request_id: request.id,
      product_name: p.product || 'Produit sans nom',
      description: p.description || null,
      quantity: p.quantity,
      unit: p.unit,
      unit_price_ht: p.priceHT,
      tva_rate: p.tva,
      total_ht: p.quantity * p.priceHT,
      sort_order: index,
    }))

    const { error: linesError } = await supabase
      .from('purchase_request_lines')
      .insert(lines)

    if (linesError) {
      console.error('Error creating purchase request lines:', linesError)
    }
  }

  // Insert analytical categories
  if (formData.analyticalCategories.length > 0) {
    const analytics = formData.analyticalCategories.map(cat => ({
      purchase_request_id: request.id,
      category_name: cat.type,
      percentage: cat.percentage,
      amount: totalHT * cat.percentage / 100,
    }))

    const { error: analyticsError } = await supabase
      .from('purchase_request_analytics')
      .insert(analytics)

    if (analyticsError) {
      console.error('Error creating purchase request analytics:', analyticsError)
    }
  }

  // Upload and insert documents
  if (formData.files.length > 0) {
    for (const file of formData.files) {
      const filePath = `purchase-requests/${request.id}/${Date.now()}-${file.name}`

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        continue
      }

      // Insert document record
      const { error: docError } = await supabase
        .from('purchase_request_documents')
        .insert({
          purchase_request_id: request.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
        })

      if (docError) {
        console.error('Error creating document record:', docError)
      }
    }
  }

  return request
}

export async function updatePurchaseRequestStatus(
  id: string,
  status: PurchaseRequest['status']
): Promise<PurchaseRequest> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating purchase request status:', error)
    throw new Error(`Erreur mise à jour statut: ${error.message}`)
  }

  return data
}

export async function deletePurchaseRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_requests')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting purchase request:', error)
    throw new Error(`Erreur suppression demande d'achat: ${error.message}`)
  }
}
