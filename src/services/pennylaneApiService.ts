// Pennylane API Service
// Calls Pennylane via Supabase Edge Function proxy (avoids CORS)

import { supabase } from '../lib/supabase'

// ============ Types ============

export interface PennylaneSupplierInvoice {
  id: number
  label: string | null
  invoice_number: string | null
  piece_number?: string | null
  date: string | null
  deadline: string | null
  due_date?: string | null
  amount: string | null
  currency_amount: string | null
  currency_amount_before_tax: string | null
  currency_tax: string | null
  currency: string | null
  payment_status: string | null
  status?: string | null
  paid?: boolean
  reconciled: boolean
  filename: string | null
  public_file_url: string | null
  supplier: {
    id: number
    name?: string
    url?: string
    emails?: string[]
  } | null
  categories: {
    url: string
  } | null
  attachment?: {
    filename: string
    url: string
  } | null
  matched_transactions: {
    url: string
  } | null
  created_at: string
  updated_at: string
  exchange_rate: string | null
  external_reference: string | null
}

export interface PennylaneCustomerInvoice {
  id: number
  label: string | null
  invoice_number: string | null
  quote_group_uuid?: string | null
  date: string | null
  due_date: string | null
  currency_amount: string | null
  currency_amount_before_tax: string | null
  currency_tax: string | null
  currency: string | null
  status: string | null
  paid: boolean
  filename: string | null
  public_file_url: string | null
  customer: {
    id: number
    name: string
  } | null
  line_items?: PennylaneLineItem[]
  created_at: string
  updated_at: string
}

export interface PennylaneSupplier {
  id: number
  name: string
  emails: string[]
  address: string | null
  city: string | null
  postal_code: string | null
  country_alpha2: string | null
  iban: string | null
  created_at: string
  updated_at: string
}

export interface PennylaneCustomer {
  id: number
  name: string
  emails: string[]
  phone: string | null
  vat_number: string | null
  reg_no: string | null // SIREN (9 digits) - actual field name from Pennylane API
  billing_address: {
    address: string | null
    postal_code: string | null
    city: string | null
    country_alpha2: string | null
  } | null
  billing_iban: string | null
  customer_type: string | null
  payment_conditions: string | null
  created_at: string
  updated_at: string
}

export interface PennylaneProduct {
  id: number
  label: string
  description: string | null
  unit: string | null
  price: string | null
  vat_rate: string | null
  currency: string | null
  substance: string | null // 'product' or 'service'
  created_at: string
  updated_at: string
}

export interface PennylaneQuote {
  id: number
  quote_number: string
  label: string | null
  date: string | null
  deadline: string | null
  currency_amount: string | null
  currency_amount_before_tax: string | null
  currency_tax: string | null
  currency: string | null
  status: string | null
  customer: {
    id: number
    name: string
  } | null
  line_items?: PennylaneLineItem[]
  public_file_url: string | null
  filename: string | null
  created_at: string
  updated_at: string
}

export interface PennylaneLineItem {
  id: number
  label: string
  quantity: string | null
  unit: string | null
  currency_price_before_tax: string | null
  currency_tax: string | null
  currency_amount: string | null
  vat_rate: string | null
  product?: { id: number; label: string } | null
}

export interface PennylaneCategory {
  id: number
  label: string
  group_id?: number
  group_label?: string
  created_at: string
  updated_at: string
}

export interface PennylaneCategoryGroup {
  id: number
  label: string
  created_at: string
  updated_at: string
}

// ============ Proxy call ============

async function callProxy<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('pennylane-proxy', {
    body: { action, params },
  })

  if (error) {
    console.error(`[Pennylane Proxy] Error for ${action}:`, error)
    throw new Error(`Pennylane proxy error: ${error.message}`)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data as T
}

// ============ API Methods ============

export async function listAllSupplierInvoices(
  onProgress?: (fetched: number) => void,
  dateFrom?: string
): Promise<PennylaneSupplierInvoice[]> {
  const result = await callProxy<{ invoices: PennylaneSupplierInvoice[]; count: number }>(
    'list_supplier_invoices',
    dateFrom ? { dateFrom } : undefined
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} supplier invoices`)
  return result.invoices
}

export async function listAllSuppliers(
  onProgress?: (fetched: number) => void
): Promise<PennylaneSupplier[]> {
  const result = await callProxy<{ suppliers: PennylaneSupplier[]; count: number }>(
    'list_suppliers'
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} suppliers`)
  return result.suppliers
}

export async function listAllCustomers(
  onProgress?: (fetched: number) => void
): Promise<PennylaneCustomer[]> {
  const result = await callProxy<{ customers: PennylaneCustomer[]; count: number }>(
    'list_customers'
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} customers`)
  return result.customers
}

export async function getCustomerById(customerId: number): Promise<PennylaneCustomer | null> {
  try {
    const result = await callProxy<{ customer: PennylaneCustomer }>('get_customer', { customerId })
    console.log(`[Pennylane] Fetched customer #${customerId}`)
    return result.customer
  } catch (err) {
    console.error(`[Pennylane] Error fetching customer #${customerId}:`, err)
    return null
  }
}

export async function listAllCustomerInvoices(
  onProgress?: (fetched: number) => void,
  dateFrom?: string
): Promise<PennylaneCustomerInvoice[]> {
  const result = await callProxy<{ invoices: PennylaneCustomerInvoice[]; count: number }>(
    'list_customer_invoices',
    dateFrom ? { dateFrom } : undefined
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} customer invoices`)
  return result.invoices
}

export async function listAllQuotes(
  onProgress?: (fetched: number) => void
): Promise<PennylaneQuote[]> {
  const result = await callProxy<{ quotes: PennylaneQuote[]; count: number }>(
    'list_quotes'
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} quotes`)
  return result.quotes
}

export async function listAllProducts(
  onProgress?: (fetched: number) => void
): Promise<PennylaneProduct[]> {
  const result = await callProxy<{ products: PennylaneProduct[]; count: number }>(
    'list_products'
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} products`)
  return result.products
}

export async function listAllCategories(
  onProgress?: (fetched: number) => void
): Promise<PennylaneCategory[]> {
  const result = await callProxy<{ categories: PennylaneCategory[]; count: number }>(
    'list_categories'
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} categories`)
  return result.categories
}

export async function listAllCategoryGroups(
  onProgress?: (fetched: number) => void
): Promise<PennylaneCategoryGroup[]> {
  const result = await callProxy<{ groups: PennylaneCategoryGroup[]; count: number }>(
    'list_category_groups'
  )
  onProgress?.(result.count)
  console.log(`[Pennylane] Fetched ${result.count} category groups`)
  return result.groups
}

export async function testConnection(): Promise<{ ok: boolean; company?: string; error?: string }> {
  try {
    const data = await callProxy<{ ok: boolean; company?: string }>('test_connection')
    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
}

export interface PennylaneMatchedTransaction {
  id: number
  amount: string | null
  currency_amount: string | null
  date: string | null
  label: string | null
  bank_account_id: number | null
}

export async function getInvoiceMatchedTransactions(
  invoiceId: number,
  invoiceType: 'supplier' | 'customer'
): Promise<PennylaneMatchedTransaction[]> {
  const result = await callProxy<{ transactions: PennylaneMatchedTransaction[] }>(
    'get_invoice_matched_transactions',
    { invoiceId, invoiceType }
  )
  return result.transactions
}

export async function downloadAndStoreDocument(
  pennylaneUrl: string,
  storagePath: string
): Promise<string> {
  const result = await callProxy<{ publicUrl: string }>('download_document', {
    url: pennylaneUrl,
    storagePath,
  })
  return result.publicUrl
}

export function clearApiKeyCache(): void {
  // Key is now fetched server-side in the Edge Function
}
