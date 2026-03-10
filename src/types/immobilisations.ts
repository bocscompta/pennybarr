// ============ IMMOBILISATIONS ============

export type AssetCategory =
  | 'incorporel'      // Brevets, logiciels, fonds de commerce (classe 20-21)
  | 'corporel'        // Terrains, constructions, matériel (classe 21-23)
  | 'financier'       // Participations, prêts (classe 26-27)

export type DepreciationMethod = 'linear' | 'degressive'

export type AssetStatus = 'active' | 'disposed' | 'scrapped'

export interface Asset {
  id: string
  company_id: string

  // Identification
  code: string              // Code immo (IMM001)
  name: string
  description?: string
  category: AssetCategory

  // Acquisition
  acquisition_date: string
  acquisition_value: number // Valeur d'acquisition
  residual_value: number    // Valeur résiduelle (souvent 0)

  // Amortissement
  depreciation_method: DepreciationMethod
  depreciation_rate?: number        // Taux dégressif (si applicable)
  depreciation_duration_months: number // Durée en mois
  depreciation_start_date: string   // Date début amortissement

  // Cession/Mise au rebut
  status: AssetStatus
  disposal_date?: string
  disposal_value?: number   // Prix de cession
  disposal_reason?: string  // 'vente', 'rebut', 'vol', etc.

  // Comptabilité
  account_code_asset: string        // Compte immo (2xxx)
  account_code_depreciation: string // Compte amortissement (28xxx)
  account_code_expense: string      // Compte dotation (681x)

  // Localisation
  location?: string
  assigned_to?: string

  // Métadonnées
  created_at: string
  updated_at: string
}

export interface AssetDepreciation {
  id: string
  asset_id: string
  fiscal_year_id: string

  date: string              // Date de la dotation
  period_start: string      // Début période
  period_end: string        // Fin période

  amount: number            // Montant de la dotation
  cumulated_amount: number  // Amortissements cumulés
  net_book_value: number    // Valeur nette comptable après dotation

  is_posted: boolean        // Écriture comptable générée
  accounting_entry_id?: string

  created_at: string
}

// ============ EMPRUNTS ============

export type LoanType =
  | 'bank'          // Emprunt bancaire (164)
  | 'shareholder'   // Compte courant associé (455)
  | 'leasing'       // Crédit-bail (167)
  | 'other'         // Autres emprunts

export type LoanStatus = 'active' | 'completed' | 'early_repaid'

export interface Loan {
  id: string
  company_id: string

  // Identification
  name: string
  reference?: string        // Numéro de contrat
  loan_type: LoanType
  lender: string            // Nom du prêteur

  // Montants
  principal_amount: number  // Capital emprunté
  interest_rate: number     // Taux d'intérêt annuel (%)

  // Durée
  start_date: string
  end_date: string
  duration_months: number

  // Échéances
  payment_frequency: 'monthly' | 'quarterly' | 'yearly'
  payment_amount: number    // Montant échéance (capital + intérêts)
  payment_day?: number      // Jour du mois

  // État
  status: LoanStatus
  remaining_principal: number

  // Comptabilité
  account_code_loan: string     // Compte emprunt (164, 455, etc.)
  account_code_interest: string // Compte intérêts (6611)

  // Métadonnées
  notes?: string
  document_url?: string
  created_at: string
  updated_at: string
}

export interface LoanPayment {
  id: string
  loan_id: string

  // Échéance
  due_date: string          // Date prévue
  payment_date?: string     // Date effective (si payé)

  // Montants
  principal_amount: number  // Part capital
  interest_amount: number   // Part intérêts
  total_amount: number      // Total échéance

  // Solde
  remaining_principal: number // Capital restant dû après paiement

  // Statut
  is_paid: boolean
  bank_transaction_id?: string
  accounting_entry_id?: string

  created_at: string
}

// ============ FORM DATA ============

export interface AssetFormData {
  code: string
  name: string
  description?: string
  category: AssetCategory
  acquisitionDate: string
  acquisitionValue: number
  residualValue: number
  depreciationMethod: DepreciationMethod
  depreciationDurationMonths: number
  depreciationStartDate: string
  accountCodeAsset: string
  accountCodeDepreciation: string
  accountCodeExpense: string
  location?: string
}

export interface LoanFormData {
  name: string
  reference?: string
  loanType: LoanType
  lender: string
  principalAmount: number
  interestRate: number
  startDate: string
  durationMonths: number
  paymentFrequency: 'monthly' | 'quarterly' | 'yearly'
  paymentDay?: number
  accountCodeLoan: string
  accountCodeInterest: string
  notes?: string
}

export interface AssetDisposalFormData {
  disposalDate: string
  disposalValue: number
  disposalReason: string
}

// ============ FILTERS ============

export interface AssetFilters {
  category?: AssetCategory
  status?: AssetStatus
  searchTerm?: string
}

export interface LoanFilters {
  loanType?: LoanType
  status?: LoanStatus
  searchTerm?: string
}

// ============ SCHEDULES ============

export interface DepreciationScheduleEntry {
  year: number
  periodStart: string
  periodEnd: string
  openingValue: number      // VNC début
  depreciationAmount: number // Dotation
  cumulatedDepreciation: number
  closingValue: number      // VNC fin
}

export interface DepreciationScheduleEntryWithStatus extends DepreciationScheduleEntry {
  isPosted: boolean
  depreciationId?: string
}

export interface DepreciationPreviewEntry {
  asset: Asset
  year: number
  amount: number
  cumulatedDepreciation: number
  netBookValueStart: number
  netBookValueEnd: number
  prorata: number
  rate: number
  methodUsed: 'linear' | 'degressive'
  isAlreadyPosted: boolean
  existingDepreciationId?: string
}

export interface LoanAmortizationEntry {
  number: number
  dueDate: string
  principal: number
  interest: number
  total: number
  remainingPrincipal: number
}
