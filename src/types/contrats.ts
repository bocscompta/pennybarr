// Types for Contracts/Subscriptions management
// Pennybarr - Gestion des Contrats et Abonnements

import type { ThirdParty, Invoice } from './database'

// ============ CONTRACT TYPES ============

export type ContractType = 'subscription' | 'service' | 'rental'

export type ContractStatus = 'draft' | 'active' | 'suspended' | 'terminated' | 'expired'

export type BillingFrequency = 'monthly' | 'quarterly' | 'yearly'

// ============ CONTRACT INTERFACES ============

export interface Contract {
  id: string
  company_id: string
  customer_id: string
  number: string              // CTR-2025-00001
  name: string                // "Abonnement maintenance"
  type: ContractType
  status: ContractStatus
  start_date: string
  end_date?: string           // null = durée indéterminée
  billing_frequency: BillingFrequency
  billing_day: number         // Jour de facturation (1-28)
  auto_renew: boolean
  renewal_notice_days: number // Préavis résiliation (jours)
  total_ht: number            // Montant périodique HT
  total_vat: number           // TVA périodique
  total_ttc: number           // Montant périodique TTC
  next_billing_date: string
  last_billing_date?: string
  notes?: string
  termination_reason?: string
  terminated_at?: string
  suspended_at?: string
  created_at: string
  updated_at: string

  // Joined data
  customer?: ThirdParty
  lines?: ContractLine[]
  invoices?: Invoice[]        // Factures générées
}

export interface ContractLine {
  id: string
  contract_id: string
  product_id?: string
  description: string
  quantity: number
  unit_price: number          // Prix unitaire HT
  vat_rate: number            // Taux TVA (20, 10, 5.5, 0)
  total_ht: number
  total_vat: number
  total_ttc: number
  sort_order: number
  created_at: string
}

// ============ FORM DATA ============

export interface ContractFormData {
  customerId: string | null
  customerName: string
  name: string
  type: ContractType
  startDate: string
  endDate?: string            // Optionnel pour durée indéterminée
  billingFrequency: BillingFrequency
  billingDay: number
  autoRenew: boolean
  renewalNoticeDays: number
  notes?: string
  lines: ContractLineFormData[]
}

export interface ContractLineFormData {
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: string             // '20', '10', '5.5', '0'
}

// ============ FILTERS ============

export interface ContractFilters {
  status?: ContractStatus | 'all'
  type?: ContractType | 'all'
  customerId?: string
  startDate?: string
  endDate?: string
  expiringInDays?: number     // Contrats expirant dans X jours
  searchTerm?: string
}

// ============ BILLING OPERATIONS ============

export interface BillingResult {
  contractId: string
  contractNumber: string
  invoiceId?: string
  invoiceNumber?: string
  success: boolean
  error?: string
}

export interface AutoBillingResult {
  generated: BillingResult[]
  errors: BillingResult[]
  totalProcessed: number
  totalSuccess: number
  totalFailed: number
}

// ============ RENEWAL OPERATIONS ============

export interface ExpiringContract {
  contract: Contract
  daysUntilExpiry: number
}

// ============ STATISTICS ============

export interface ContractStats {
  totalContracts: number
  activeContracts: number
  totalMRR: number            // Monthly Recurring Revenue
  totalARR: number            // Annual Recurring Revenue
  contractsDueSoon: number    // Facturations à venir (30 jours)
  contractsExpiringSoon: number // Expirant bientôt (60 jours)
}

// Re-export for convenience
export type { ThirdParty, Invoice }
