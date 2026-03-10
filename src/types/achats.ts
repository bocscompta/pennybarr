// Types for Supplier Orders and Goods Receipt
// Pennybarr - Gestion Achats

import type { ThirdParty } from './database'
import type { Product } from './commercial'

// ============ COMMANDES FOURNISSEURS ============

export type SupplierOrderStatus =
  | 'draft'       // Brouillon - en cours de création
  | 'validated'   // Validée - prête à être envoyée
  | 'sent'        // Envoyée au fournisseur
  | 'received'    // Marchandises reçues (total ou partiel)
  | 'invoiced'    // Facturée
  | 'cancelled'   // Annulée

export interface SupplierOrder {
  id: string
  company_id: string
  supplier_id: string
  number: string              // CMD-2025-00001
  date: string
  expected_delivery_date?: string
  status: SupplierOrderStatus
  total_ht: number
  total_vat: number
  total_ttc: number
  notes?: string
  payment_terms?: string
  delivery_address?: string
  created_at: string
  updated_at: string

  // Workflow tracking
  validated_at?: string
  sent_at?: string
  received_at?: string
  invoiced_at?: string
  cancelled_at?: string
  cancellation_reason?: string

  // Linked entities
  linked_invoice_id?: string

  // Joined
  supplier?: ThirdParty
  lines?: SupplierOrderLine[]
  receipts?: GoodsReceipt[]
}

export interface SupplierOrderLine {
  id: string
  order_id: string
  product_id?: string
  description: string
  quantity: number
  unit: string                // 'unité', 'kg', 'litre', etc.
  unit_price: number
  vat_rate: number            // 20, 10, 5.5, 0
  total_ht: number
  total_vat: number
  total_ttc: number
  received_quantity: number   // Pour réception partielle
  invoiced_quantity: number   // Quantité facturée
  sort_order: number
  created_at: string
  updated_at: string

  // Joined
  product?: Product
}

// ============ RÉCEPTION MARCHANDISES ============

export interface GoodsReceipt {
  id: string
  order_id: string
  date: string
  reference?: string          // Bon de livraison fournisseur
  notes?: string
  created_at: string

  // Joined
  lines?: GoodsReceiptLine[]
}

export interface GoodsReceiptLine {
  id: string
  receipt_id: string
  order_line_id: string
  quantity_received: number
  notes?: string
  created_at: string
}

// ============ 3-WAY MATCH ============

export interface ThreeWayMatchLine {
  orderLineId: string
  description: string
  orderedQuantity: number
  receivedQuantity: number
  invoicedQuantity: number
  unitPrice: number
  hasDiscrepancy: boolean
  discrepancyType?: 'under_received' | 'over_received' | 'under_invoiced' | 'over_invoiced'
}

export interface ThreeWayMatchSummary {
  orderId: string
  orderNumber: string
  supplierName: string
  totalOrdered: number
  totalReceived: number
  totalInvoiced: number
  hasDiscrepancy: boolean
  lines: ThreeWayMatchLine[]
}

// ============ FORM DATA ============

export interface SupplierOrderFormData {
  supplierId: string | null
  supplierName: string
  date: string
  expectedDeliveryDate?: string
  notes?: string
  paymentTerms?: string
  deliveryAddress?: string
  lines: SupplierOrderLineFormData[]
}

export interface SupplierOrderLineFormData {
  productId?: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
}

export interface GoodsReceiptFormData {
  orderId: string
  date: string
  reference?: string
  notes?: string
  lines: GoodsReceiptLineFormData[]
}

export interface GoodsReceiptLineFormData {
  orderLineId: string
  quantityReceived: number
  notes?: string
}

// ============ FILTERS ============

export interface SupplierOrderFilters {
  status?: SupplierOrderStatus
  supplierId?: string
  startDate?: string
  endDate?: string
  searchTerm?: string
}

// Re-export for convenience
export type { ThirdParty, Product }
