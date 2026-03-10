// Types for multi-line invoice creation form

export interface InvoiceSection {
  id: string
  title: string
  description?: string
}

export interface CustomField {
  id: string
  label: string
  value: string
}

export interface InvoiceLineFormData {
  id: string // Client-side UUID for React key
  productId?: string
  description: string
  detailedDescription?: string // Description détaillée sous la ligne
  quantity: number
  unit: string // 'unite' | 'heure' | 'jour' | 'mois' | 'kg' | 'm2'
  unitPriceHT: number
  vatRate: string // '20' | '10' | '5.5' | '0'
  discountPercent?: number
  accountingCode: string // 7xxx, auto-filled from product
  sectionId?: string // Référence à la section parente
}

export interface CreateInvoiceFormData {
  customerId: string | null
  customerName: string
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  dueDate: string // YYYY-MM-DD
  saleType: 'goods' | 'services' | 'both'
  documentTitle?: string
  documentDescription?: string
  description?: string
  customFields: CustomField[]
  sections: InvoiceSection[]
  lines: InvoiceLineFormData[]
  // Sidebar
  paymentTermsDays: number // 0, 30, 45, 60
  paymentMethods: {
    virement: boolean
    carte: boolean
    prelevement: boolean
    cheque: boolean
    especes: boolean
  }
  bankAccountId?: string
  currency: string
}

export interface InvoiceLineTotals {
  totalHT: number
  totalVAT: number
  totalTTC: number
}

export interface InvoiceTotals {
  totalHT: number
  totalVAT: number
  totalTTC: number
  vatBreakdown: VatBreakdownLine[]
}

export interface VatBreakdownLine {
  rate: string
  base: number
  amount: number
}

// Units for line items
export const UNIT_OPTIONS = [
  { value: 'unite', label: 'Unité' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'mois', label: 'Mois' },
  { value: 'kg', label: 'kg' },
  { value: 'm2', label: 'm²' },
] as const

export const VAT_RATE_OPTIONS = [
  { value: '20', label: '20%' },
  { value: '10', label: '10%' },
  { value: '5.5', label: '5,5%' },
  { value: '0', label: '0%' },
] as const

export const PAYMENT_TERMS_OPTIONS = [
  { value: 0, label: 'Comptant' },
  { value: 30, label: '30 jours' },
  { value: 45, label: '45 jours' },
  { value: 60, label: '60 jours' },
] as const
