// Types for commercial management (Devis, Products)
// Pennybarr - Gestion Commerciale

import type { ThirdParty } from './database'

// ============ PRODUITS ET SERVICES ============

export interface ProductCategory {
  id: string
  company_id: string
  name: string
  parent_id?: string        // Pour catégories hiérarchiques
  description?: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string

  // Joined
  parent?: ProductCategory
  children?: ProductCategory[]
}

export interface Product {
  id: string
  company_id: string
  code: string              // Code article (ex: PROD001)
  name: string
  description?: string
  type: 'product' | 'service'
  category_id?: string      // Catégorie produit

  // Prix
  sale_price_ht: number     // Prix de vente HT
  purchase_price_ht?: number // Prix d'achat HT (pour produits)
  vat_rate: string          // '20', '10', '5.5', '0'

  // Comptabilité
  accounting_code_sale: string    // Compte produit (7xxx)
  accounting_code_purchase?: string // Compte charge (6xxx)

  // Stock (pour produits uniquement)
  track_stock?: boolean
  stock_quantity?: number
  stock_alert_threshold?: number

  is_active: boolean
  created_at: string
  updated_at: string

  // Joined
  category?: ProductCategory
}

// ============ DEVIS ============

export type DevisStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'expired' | 'invoiced'

export interface Devis {
  id: string
  company_id: string
  customer_id: string

  // Identification
  number: string            // Numéro devis (DEV2025-0001)
  reference?: string        // Référence client

  // Dates
  date: string              // Date création
  validity_date: string     // Date validité

  // Statut
  status: DevisStatus
  accepted_at?: string
  refused_at?: string

  // Montants
  total_ht: number
  total_vat: number
  total_ttc: number
  discount_percent?: number
  discount_amount?: number

  // Contenu
  notes?: string
  terms?: string            // Conditions générales
  payment_terms?: string    // Conditions de paiement

  // Conversion
  converted_to_invoice_id?: string
  converted_at?: string

  // Métadonnées
  created_at: string
  updated_at: string

  // Joined
  customer?: ThirdParty
  lines?: DevisLine[]
}

export interface DevisLine {
  id: string
  devis_id: string

  // Produit (optionnel)
  product_id?: string
  product?: Product

  // Description
  description: string

  // Quantité et prix
  quantity: number
  unit: string              // 'unité', 'heure', 'jour', 'kg', etc.
  unit_price_ht: number

  // Remise ligne
  discount_percent?: number
  discount_amount?: number

  // TVA
  vat_rate: string

  // Totaux calculés
  total_ht: number
  total_vat: number
  total_ttc: number

  // Ordre d'affichage
  sort_order: number

  created_at: string
}

// ============ FORM DATA ============

export interface DevisFormData {
  customerId: string | null
  customerName: string
  date: string
  validityDate: string
  reference?: string
  notes?: string
  terms?: string
  paymentTerms?: string
  discountPercent?: number
  lines: DevisLineFormData[]
}

export interface DevisLineFormData {
  productId?: string
  description: string
  quantity: number
  unit: string
  unitPriceHT: number
  vatRate: string
  discountPercent?: number
}

export interface ProductFormData {
  code: string
  name: string
  description?: string
  type: 'product' | 'service'
  categoryId?: string
  salePriceHT: number
  purchasePriceHT?: number
  vatRate: string
  accountingCodeSale: string
  accountingCodePurchase?: string
  trackStock?: boolean
  stockAlertThreshold?: number
}

// ============ FILTERS ============

export interface DevisFilters {
  status?: DevisStatus
  customerId?: string
  startDate?: string
  endDate?: string
  searchTerm?: string
}

export interface ProductFilters {
  type?: 'product' | 'service'
  isActive?: boolean
  searchTerm?: string
}

// Re-export ThirdParty for convenience
export type { ThirdParty }
