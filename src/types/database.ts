// Types for Supabase database tables

export interface Company {
  id: string
  name: string
  slug: string
  siren?: string
  siret?: string
  vat_number?: string
  address?: string
  postal_code?: string
  city?: string
  country: string
  currency: string
  fiscal_year_start: number
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  company_id: string
  name: string
  bank_name?: string
  account_number?: string
  iban?: string
  bic?: string
  currency: string
  initial_balance: number
  current_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BankTransaction {
  id: string
  company_id: string
  bank_account_id: string
  date: string
  value_date?: string
  label: string
  amount: number
  type: string
  reference?: string
  category?: string
  category_id?: string
  third_party_id?: string
  comments?: string
  is_reconciled: boolean
  reconciled_at?: string
  reconciliation_id?: string  // Links to bank reconciliation session
  statement_id?: string       // Links to imported bank statement
  linked_invoice_id?: string
  raw_data?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ThirdParty {
  id: string
  company_id: string
  type: 'customer' | 'supplier' | 'both'
  name: string
  code?: string
  email?: string
  phone?: string
  address?: string
  postal_code?: string
  city?: string
  country: string
  siren?: string
  siret?: string
  vat_number?: string
  payment_terms: number
  pennylane_id?: number
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  company_id: string
  third_party_id?: string
  type: 'customer' | 'supplier'
  number: string
  date: string
  due_date?: string
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  total_ht: number
  total_vat: number
  total_ttc: number
  currency: string
  notes?: string
  pdf_url?: string
  created_at: string
  updated_at: string
  // Joined
  third_party?: ThirdParty
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  total_ht: number
  total_vat: number
  total_ttc: number
  accounting_code?: string
  created_at: string
}

export interface ChartOfAccount {
  id: string
  company_id: string
  code: string
  label: string
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  parent_code?: string
  is_active: boolean
  account_role?: string   // Semantic role (e.g., 'TVA_COLLECTEE', 'CCA', 'FNP')
  pcg_type?: string       // PCG class type (CAPIT, IMMO, STOCK, TIERS, FINAN, CHARGE, PRODUIT)
  created_at: string
}

// Accounting journal from DB (replaces hardcoded JOURNAL_* constants)
export interface AccountingJournal {
  id: string
  company_id: string
  code: string
  label: string
  journal_type: 'purchase' | 'bank' | 'sales' | 'credit_note' | 'misc' | 'recovery' | 'opening'
  is_active: boolean
  created_at: string
}

// Expense category account from DB (replaces hardcoded CATEGORY_ACCOUNT_MAP)
export interface ExpenseCategoryAccount {
  id: string
  company_id: string
  category_key: string
  category_label: string
  account_code: string
  is_active: boolean
  display_order: number
  created_at: string
}

// Account classification rule from DB (replaces hardcoded KEYWORD_RULES)
export interface AccountClassificationRule {
  id: string
  company_id: string
  keywords: string[]
  account_code: string
  account_label: string
  priority: number
  is_active: boolean
  created_at: string
}

export interface AccountingEntry {
  id: string
  company_id: string
  journal: string
  date: string
  piece_number?: string
  label: string
  account_code: string
  debit: number
  credit: number
  linked_invoice_id?: string
  linked_transaction_id?: string
  is_validated: boolean
  created_at: string
  // Lettrage fields
  lettrage_code?: string        // Letter code (A, B, C, etc.)
  lettrage_date?: string        // Date when lettered
  lettrage_type?: LettrageType  // Type of lettrage for color coding
}

// Lettrage types for color coding (Pennylane style)
export type LettrageType =
  | 'tiers'           // Green: Direct lettrage invoice ↔ payment (401xxx, 411xxx)
  | 'autoliquidation' // Yellow: Autoliquidation VAT (44566, 44571 autoliq)
  | 'tva_encaissement' // Pink: VAT recovery on receipts (RT journal, 44564, 44574)

export interface TransactionCategory {
  id: string
  company_id: string
  name: string
  type: 'income' | 'expense'
  color?: string
  icon?: string
  default_accounting_code?: string
  parent_id?: string
  created_at: string
}

export interface Journal {
  id: string
  company_id: string
  code: string
  name: string
  type: 'purchase' | 'sales' | 'bank' | 'misc' | 'opening'
  linked_bank_account_id?: string
  created_at: string
}

export interface FiscalYear {
  id: string
  company_id: string
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
  closed_at?: string
  created_at: string
}

export interface Payment {
  id: string
  company_id: string
  invoice_id: string
  bank_transaction_id?: string
  date: string
  amount: number
  payment_method?: string
  reference?: string
  notes?: string
  created_at: string
}

export interface VatDeclaration {
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
  submitted_at?: string
  paid_at?: string
  created_at: string
}

export interface ExpenseReport {
  id: string
  company_id: string
  user_id?: string
  number: string
  date: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
  total_amount: number
  total_vat: number
  notes?: string
  approved_by?: string
  approved_at?: string
  paid_at?: string
  created_at: string
}

export interface BankReconciliation {
  id: string
  company_id: string
  bank_account_id: string
  statement_date: string
  statement_reference?: string
  opening_balance: number
  closing_balance: number
  status: 'in_progress' | 'completed'
  completed_at?: string
  created_at: string
}

export interface BankStatement {
  id: string
  company_id: string
  bank_account_id: string
  statement_number: string
  statement_date: string
  opening_balance: number
  closing_balance: number
  transaction_count: number
  source: 'csv' | 'ofx' | 'qif' | 'cfonb' | 'pennylane' | 'manual'
  file_name?: string
  status: 'imported' | 'reconciled' | 'archived'
  reconciliation_id?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  company_id: string
  name: string
  type?: string
  file_path: string
  file_size?: number
  mime_type?: string
  linked_invoice_id?: string
  linked_expense_id?: string
  linked_transaction_id?: string
  uploaded_by?: string
  created_at: string
}

// Product (synced from Pennylane)
export interface Product {
  id: string
  company_id: string
  code: string
  name: string
  description?: string
  type: 'product' | 'service'
  sale_price_ht: number
  purchase_price_ht?: number
  vat_rate: string
  unit: string
  accounting_code_sale?: string
  accounting_code_purchase?: string
  is_active: boolean
  pennylane_id?: number
  created_at: string
  updated_at: string
}

// Devis / Quote (synced from Pennylane)
export interface Devis {
  id: string
  company_id: string
  customer_id?: string
  number: string
  date: string
  validity_date?: string
  status: 'draft' | 'sent' | 'accepted' | 'refused' | 'expired' | 'invoiced'
  total_ht: number
  total_vat: number
  total_ttc: number
  notes?: string
  terms?: string
  currency: string
  pdf_url?: string
  pennylane_id?: number
  created_at: string
  updated_at: string
  // Joined
  customer?: ThirdParty
  lines?: DevisLine[]
}

export interface DevisLine {
  id: string
  devis_id: string
  product_id?: string
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  vat_rate: string
  total_ht: number
  total_vat: number
  total_ttc: number
  sort_order: number
  created_at: string
}

// Pennylane analytical category
export interface PennylaneCategory {
  id: string
  company_id: string
  pennylane_id: number
  name: string
  group_name?: string
  group_pennylane_id?: number
  created_at: string
}

// Stats for dashboard
export interface DashboardStats {
  totalIncome: number
  totalExpense: number
  balance: number
  pendingInvoices: number
  overdueInvoices: number
  bankBalance: number
  unreconciledTransactions: number
}

// Invoice form data for controlled form
export interface InvoiceFormData {
  thirdPartyType: 'supplier' | 'customer'
  thirdPartyId: string | null
  thirdPartyName: string
  invoiceNumber: string
  invoiceDate: string  // Format: YYYY-MM-DD
  dueDate: string      // Format: YYYY-MM-DD
  accountingCode: string  // Contrepartie (6157, etc.)
  entryLabel: string
  totalTTC: number
  totalHT: number
  totalVAT: number
  vatRate: string  // '20', '10', '5.5', '0', 'autoliq-20', 'autoliq-10'
  currency: string  // 'EUR', 'USD'
  exchangeRate?: number  // Taux de change devise→EUR (ex: 0.8508 pour USD→EUR)
  hasCCA: boolean  // Charges Constatées d'Avance
  hasFNP: boolean  // Factures Non Parvenues
  paymentMethod?: string  // 'virement' | 'cheque' | 'cb' | 'prelevement'
  analyticalCodes?: {
    id: string
    categoryId: string
    categoryName: string
    percentage: number
    accountCode?: string
  }[]
}

// Invoice analytical assignment (DB table)
export interface InvoiceAnalyticalAssignment {
  id: string
  company_id: string
  invoice_id: string
  category_id: string | null
  category_name: string
  percentage: number
  amount: number
  account_code: string | null
  created_at: string
}

// Create invoice request
export interface CreateInvoiceRequest {
  formData: InvoiceFormData
  transactionId: string
  bankAccountId: string
  documentUrl?: string
}

// Accounting entry for creation
export interface CreateAccountingEntry {
  journal: string
  date: string
  pieceNumber: string
  label: string
  accountCode: string
  debit: number
  credit: number
  linkedInvoiceId?: string
  linkedTransactionId?: string
}

// Credit Note types (Avoirs clients)
export interface CreditNote {
  id: string
  company_id: string
  customer_id: string
  original_invoice_id?: string  // Facture d'origine si avoir sur facture
  number: string                // AV-2025-00001
  date: string
  status: 'draft' | 'validated' | 'applied' | 'refunded'
  reason: string                // Motif de l'avoir
  total_ht: number
  total_vat: number
  total_ttc: number
  currency: string
  notes?: string
  created_at: string
  updated_at: string
  // Joined
  customer?: ThirdParty
  original_invoice?: Invoice
  lines?: CreditNoteLine[]
  applications?: CreditNoteApplication[]
}

export interface CreditNoteLine {
  id: string
  credit_note_id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  total_ht: number
  total_vat: number
  total_ttc: number
  accounting_code?: string
  created_at: string
}

export interface CreditNoteApplication {
  id: string
  credit_note_id: string
  invoice_id: string
  amount: number
  applied_at: string
  // Joined
  invoice?: Invoice
}

// Import history types
export type ImportType = 'bank_statement' | 'supplier_invoices' | 'customer_invoices' | 'fec' | 'grand_livre' | 'other'
export type ImportStatus = 'success' | 'partial' | 'failed'

export interface ImportError {
  line: number
  field?: string
  value?: string
  reason: string
}

export interface ImportHistory {
  id: string
  company_id: string
  import_type: ImportType
  file_name: string
  file_size?: number
  records_total: number
  records_imported: number
  records_skipped: number
  records_failed: number
  status: ImportStatus
  error_log?: ImportError[]
  imported_by?: string
  started_at: string
  completed_at?: string
  can_rollback: boolean
  rollback_data?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// SEPA Batch types
export type SEPABatchStatus = 'pending' | 'generated' | 'sent' | 'executed'

export interface SEPABatchPayment {
  invoiceId: string
  invoiceNumber: string
  thirdPartyName: string
  iban: string
  bic: string
  amount: number
  reference: string
}

export interface SEPABatch {
  id: string
  company_id: string
  type: 'transfer' | 'direct_debit'
  execution_date: string
  total_amount: number
  payment_count: number
  status: SEPABatchStatus
  filename: string
  payments: SEPABatchPayment[]
  created_at: string
  updated_at: string
}

// GED (Gestion Electronique de Documents)
export interface GedFolder {
  id: string
  company_id: string
  parent_id: string | null
  name: string
  folder_type: 'system' | 'user'
  is_locked: boolean
  sort_order: number
  created_at: string
  // Computed
  children?: GedFolder[]
  document_count?: number
}

export interface GedDocument {
  id: string
  company_id: string
  folder_id: string | null
  name: string
  file_path: string
  file_size: number
  mime_type: string
  added_by_name: string
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// Purchase Request (Demande d'achat)
export type PurchaseRequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered' | 'received' | 'invoiced'

export interface PurchaseRequest {
  id: string
  company_id: string
  reference: string
  status: PurchaseRequestStatus
  supplier_id?: string
  supplier_name?: string
  motif?: string
  delivery_address?: string
  estimated_delivery_date?: string
  currency: string
  total_ht: number
  total_tva: number
  total_ttc: number
  created_by?: string
  approved_by?: string
  created_at: string
  updated_at: string
  // Joined
  lines?: PurchaseRequestLine[]
  analytics?: PurchaseRequestAnalytic[]
  documents?: PurchaseRequestDocument[]
}

export interface PurchaseRequestLine {
  id: string
  purchase_request_id: string
  product_name: string
  description?: string
  quantity: number
  unit: string
  unit_price_ht: number
  tva_rate: number
  total_ht: number
  sort_order: number
  created_at: string
}

export interface PurchaseRequestAnalytic {
  id: string
  purchase_request_id: string
  category_name: string
  percentage: number
  amount: number
  created_at: string
}

export interface PurchaseRequestDocument {
  id: string
  purchase_request_id: string
  file_name: string
  file_path: string
  file_size?: number
  file_type?: string
  uploaded_at: string
}

// Form data for creating a purchase request
export interface PurchaseRequestFormData {
  supplier: string
  supplierName?: string
  motif: string
  deliveryAddress: string
  estimatedDeliveryDate?: string
  currency: string
  products: {
    id: number
    product: string
    quantity: number
    unit: string
    priceHT: number
    tva: number
    description: string
  }[]
  analyticalCategories: {
    type: string
    percentage: number
  }[]
  files: File[]
}
