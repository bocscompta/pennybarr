// Types pour les paramètres de facturation client

// ==============================================================================
// ENUMS
// ==============================================================================

export type DocumentType = 'invoice' | 'quote' | 'delivery_note' | 'purchase_order' | 'proforma'

export type SaleType = 'services' | 'goods' | 'mixed'

export type SepaMode = 'manual' | 'automatic'

export type EmailTemplateType = 'quote' | 'invoice' | 'reminder' | 'payment_confirmation' | 'delivery_note'

export type Language = 'fr' | 'en' | 'es' | 'de' | 'it'

// ==============================================================================
// INVOICE SETTINGS (Configuration générale)
// ==============================================================================

export interface AttachmentsConfig {
  cgv: boolean
  kbis: boolean
  rib: boolean
}

export interface InvoiceSettings {
  id: string
  company_id: string

  // Numérotation
  invoice_next_number: number
  invoice_prefix: string
  quote_next_number: number
  quote_prefix: string
  delivery_note_next_number: number
  delivery_note_prefix: string
  purchase_order_next_number: number
  purchase_order_prefix: string
  proforma_next_number: number
  proforma_prefix: string

  // Informations entreprise
  company_display_name: string | null
  company_email: string | null
  company_phone: string | null
  sale_type: SaleType

  // Design
  logo_url: string | null
  primary_color: string

  // Annexes
  attachments_config: AttachmentsConfig

  created_at: string
  updated_at: string
}

export interface CreateInvoiceSettingsData {
  company_id: string
  company_display_name?: string
  company_email?: string
  company_phone?: string
  sale_type?: SaleType
  logo_url?: string
  primary_color?: string
}

export interface UpdateInvoiceSettingsData {
  invoice_next_number?: number
  invoice_prefix?: string
  quote_next_number?: number
  quote_prefix?: string
  delivery_note_next_number?: number
  delivery_note_prefix?: string
  purchase_order_next_number?: number
  purchase_order_prefix?: string
  proforma_next_number?: number
  proforma_prefix?: string
  company_display_name?: string
  company_email?: string
  company_phone?: string
  sale_type?: SaleType
  logo_url?: string | null
  primary_color?: string
  attachments_config?: AttachmentsConfig
}

// ==============================================================================
// INVOICE TEMPLATES (Modèles de documents)
// ==============================================================================

export interface InvoiceTemplate {
  id: string
  company_id: string
  name: string
  document_type: DocumentType
  language: Language
  is_default: boolean
  footer_text: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateInvoiceTemplateData {
  company_id: string
  name: string
  document_type: DocumentType
  language?: Language
  is_default?: boolean
  footer_text?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateInvoiceTemplateData {
  name?: string
  document_type?: DocumentType
  language?: Language
  is_default?: boolean
  footer_text?: string
  custom_fields?: Record<string, unknown>
}

// ==============================================================================
// INVOICE PAYMENT CONFIG (Configuration paiements)
// ==============================================================================

export interface InvoicePaymentConfig {
  id: string
  company_id: string

  // Virements
  iban: string | null
  bic: string | null
  default_payment_terms_days: number
  show_payment_option: boolean
  has_factoring: boolean

  // Prélèvement SEPA
  sepa_enabled: boolean
  sepa_mode: SepaMode

  // Carte bancaire (Stripe)
  stripe_enabled: boolean
  stripe_account_id: string | null

  // Chèques
  checks_enabled: boolean

  created_at: string
  updated_at: string
}

export interface CreateInvoicePaymentConfigData {
  company_id: string
  iban?: string
  bic?: string
  default_payment_terms_days?: number
  show_payment_option?: boolean
  has_factoring?: boolean
  sepa_enabled?: boolean
  sepa_mode?: SepaMode
  stripe_enabled?: boolean
  stripe_account_id?: string
  checks_enabled?: boolean
}

export interface UpdateInvoicePaymentConfigData {
  iban?: string
  bic?: string
  default_payment_terms_days?: number
  show_payment_option?: boolean
  has_factoring?: boolean
  sepa_enabled?: boolean
  sepa_mode?: SepaMode
  stripe_enabled?: boolean
  stripe_account_id?: string
  checks_enabled?: boolean
}

// ==============================================================================
// EMAIL TEMPLATES (Templates d'emails)
// ==============================================================================

export interface EmailTemplate {
  id: string
  company_id: string
  name: string
  template_type: EmailTemplateType
  language: Language
  subject: string
  body_html: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateEmailTemplateData {
  company_id: string
  name: string
  template_type: EmailTemplateType
  language?: Language
  subject: string
  body_html: string
  is_default?: boolean
}

export interface UpdateEmailTemplateData {
  name?: string
  template_type?: EmailTemplateType
  language?: Language
  subject?: string
  body_html?: string
  is_default?: boolean
}

// ==============================================================================
// PAYMENT REMINDER SEQUENCES (Séquences de relances)
// ==============================================================================

export interface PaymentReminderSequence {
  id: string
  company_id: string
  name: string
  description: string | null
  is_active: boolean
  is_automatic: boolean // true = Automatique, false = Avec validation
  created_at: string
  updated_at: string
}

export interface CreatePaymentReminderSequenceData {
  company_id: string
  name: string
  description?: string
  is_active?: boolean
  is_automatic?: boolean
}

export interface UpdatePaymentReminderSequenceData {
  name?: string
  description?: string
  is_active?: boolean
  is_automatic?: boolean
}

// ==============================================================================
// PAYMENT REMINDER STEPS (Étapes de relances)
// ==============================================================================

export interface PaymentReminderStep {
  id: string
  sequence_id: string
  step_order: number
  delay_days: number
  email_template_id: string | null
  created_at: string
}

export interface CreatePaymentReminderStepData {
  sequence_id: string
  step_order: number
  delay_days: number
  email_template_id?: string
}

export interface UpdatePaymentReminderStepData {
  step_order?: number
  delay_days?: number
  email_template_id?: string
}

// ==============================================================================
// EXTENDED TYPES (avec relations)
// ==============================================================================

export interface PaymentReminderSequenceWithSteps extends PaymentReminderSequence {
  steps: PaymentReminderStep[]
}

export interface PaymentReminderStepWithTemplate extends PaymentReminderStep {
  email_template: EmailTemplate | null
}

// ==============================================================================
// DOCUMENT NUMBERING (pour UI)
// ==============================================================================

export interface DocumentNumberingConfig {
  type: DocumentType
  prefix: string
  next_number: number
  example: string // Ex: "F-2026-0034"
  status: 'active' | 'pending' | 'resetable'
}

// ==============================================================================
// UI HELPERS
// ==============================================================================

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Facture',
  quote: 'Devis',
  delivery_note: 'Bon de livraison',
  purchase_order: 'Bon de commande',
  proforma: 'Proforma'
}

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  services: 'Prestations de services',
  goods: 'Vente de biens',
  mixed: 'Mixte (biens et services)'
}

export const EMAIL_TEMPLATE_TYPE_LABELS: Record<EmailTemplateType, string> = {
  quote: 'Devis',
  invoice: 'Facture',
  reminder: 'Relance',
  payment_confirmation: 'Confirmation de paiement',
  delivery_note: 'Bon de livraison'
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: '🇫🇷 Français',
  en: '🇬🇧 English',
  es: '🇪🇸 Español',
  de: '🇩🇪 Deutsch',
  it: '🇮🇹 Italiano'
}

export const SEPA_MODE_LABELS: Record<SepaMode, string> = {
  manual: 'Manuels',
  automatic: 'Automatique'
}
