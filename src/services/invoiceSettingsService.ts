import { supabase } from '../lib/supabase'
import type {
  InvoiceSettings,
  CreateInvoiceSettingsData,
  UpdateInvoiceSettingsData,
  InvoiceTemplate,
  CreateInvoiceTemplateData,
  UpdateInvoiceTemplateData,
  InvoicePaymentConfig,
  CreateInvoicePaymentConfigData,
  UpdateInvoicePaymentConfigData,
  EmailTemplate,
  CreateEmailTemplateData,
  UpdateEmailTemplateData,
  DocumentType,
  EmailTemplateType
} from '../types/invoiceSettings'

// ==============================================================================
// INVOICE SETTINGS (Configuration générale)
// ==============================================================================

export async function getInvoiceSettings(companyId: string): Promise<InvoiceSettings> {
  const { data, error } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to fetch invoice settings:', error)
    throw new Error(`Failed to fetch invoice settings: ${error.message}`)
  }

  if (!data) {
    throw new Error('Invoice settings not found')
  }

  return data
}

export async function createInvoiceSettings(
  settingsData: CreateInvoiceSettingsData
): Promise<InvoiceSettings> {
  const { data, error } = await supabase
    .from('invoice_settings')
    .insert(settingsData)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to create invoice settings:', error)
    throw new Error(`Failed to create invoice settings: ${error.message}`)
  }

  return data
}

export async function updateInvoiceSettings(
  companyId: string,
  updates: UpdateInvoiceSettingsData
): Promise<InvoiceSettings> {
  const { data, error } = await supabase
    .from('invoice_settings')
    .update(updates)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to update invoice settings:', error)
    throw new Error(`Failed to update invoice settings: ${error.message}`)
  }

  return data
}

// ==============================================================================
// INVOICE TEMPLATES (Modèles de documents)
// ==============================================================================

export async function getInvoiceTemplates(
  companyId: string,
  documentType?: DocumentType
): Promise<InvoiceTemplate[]> {
  let query = supabase
    .from('invoice_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (documentType) {
    query = query.eq('document_type', documentType)
  }

  const { data, error } = await query

  if (error) {
    console.error('[invoiceSettingsService] Failed to fetch invoice templates:', error)
    throw new Error(`Failed to fetch invoice templates: ${error.message}`)
  }

  return data || []
}

export async function getInvoiceTemplateById(templateId: string): Promise<InvoiceTemplate> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to fetch invoice template:', error)
    throw new Error(`Failed to fetch invoice template: ${error.message}`)
  }

  if (!data) {
    throw new Error('Invoice template not found')
  }

  return data
}

export async function createInvoiceTemplate(
  templateData: CreateInvoiceTemplateData
): Promise<InvoiceTemplate> {
  // Si is_default = true, désactiver les autres templates du même type
  if (templateData.is_default) {
    await unsetDefaultTemplate(templateData.company_id, templateData.document_type)
  }

  const { data, error } = await supabase
    .from('invoice_templates')
    .insert(templateData)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to create invoice template:', error)
    throw new Error(`Failed to create invoice template: ${error.message}`)
  }

  return data
}

export async function updateInvoiceTemplate(
  templateId: string,
  updates: UpdateInvoiceTemplateData
): Promise<InvoiceTemplate> {
  // Si is_default = true, désactiver les autres templates du même type
  if (updates.is_default && updates.document_type) {
    const template = await getInvoiceTemplateById(templateId)
    await unsetDefaultTemplate(template.company_id, updates.document_type)
  }

  const { data, error } = await supabase
    .from('invoice_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to update invoice template:', error)
    throw new Error(`Failed to update invoice template: ${error.message}`)
  }

  return data
}

export async function deleteInvoiceTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('invoice_templates')
    .delete()
    .eq('id', templateId)

  if (error) {
    console.error('[invoiceSettingsService] Failed to delete invoice template:', error)
    throw new Error(`Failed to delete invoice template: ${error.message}`)
  }
}

// Helper pour désactiver le template par défaut du même type
async function unsetDefaultTemplate(companyId: string, documentType: DocumentType): Promise<void> {
  const { error } = await supabase
    .from('invoice_templates')
    .update({ is_default: false })
    .eq('company_id', companyId)
    .eq('document_type', documentType)
    .eq('is_default', true)

  if (error) {
    console.error('[invoiceSettingsService] Failed to unset default template:', error)
    throw new Error(`Failed to unset default template: ${error.message}`)
  }
}

// ==============================================================================
// INVOICE PAYMENT CONFIG (Configuration paiements)
// ==============================================================================

export async function getInvoicePaymentConfig(companyId: string): Promise<InvoicePaymentConfig> {
  const { data, error } = await supabase
    .from('invoice_payment_config')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to fetch payment config:', error)
    throw new Error(`Failed to fetch payment config: ${error.message}`)
  }

  if (!data) {
    throw new Error('Payment config not found')
  }

  return data
}

export async function createInvoicePaymentConfig(
  configData: CreateInvoicePaymentConfigData
): Promise<InvoicePaymentConfig> {
  const { data, error } = await supabase
    .from('invoice_payment_config')
    .insert(configData)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to create payment config:', error)
    throw new Error(`Failed to create payment config: ${error.message}`)
  }

  return data
}

export async function updateInvoicePaymentConfig(
  companyId: string,
  updates: UpdateInvoicePaymentConfigData
): Promise<InvoicePaymentConfig> {
  const { data, error } = await supabase
    .from('invoice_payment_config')
    .update(updates)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to update payment config:', error)
    throw new Error(`Failed to update payment config: ${error.message}`)
  }

  return data
}

// ==============================================================================
// EMAIL TEMPLATES (Templates d'emails)
// ==============================================================================

export async function getEmailTemplates(
  companyId: string,
  templateType?: EmailTemplateType
): Promise<EmailTemplate[]> {
  let query = supabase
    .from('email_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (templateType) {
    query = query.eq('template_type', templateType)
  }

  const { data, error } = await query

  if (error) {
    console.error('[invoiceSettingsService] Failed to fetch email templates:', error)
    throw new Error(`Failed to fetch email templates: ${error.message}`)
  }

  return data || []
}

export async function getEmailTemplateById(templateId: string): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to fetch email template:', error)
    throw new Error(`Failed to fetch email template: ${error.message}`)
  }

  if (!data) {
    throw new Error('Email template not found')
  }

  return data
}

export async function createEmailTemplate(
  templateData: CreateEmailTemplateData
): Promise<EmailTemplate> {
  // Si is_default = true, désactiver les autres templates du même type
  if (templateData.is_default) {
    await unsetDefaultEmailTemplate(templateData.company_id, templateData.template_type)
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert(templateData)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to create email template:', error)
    throw new Error(`Failed to create email template: ${error.message}`)
  }

  return data
}

export async function updateEmailTemplate(
  templateId: string,
  updates: UpdateEmailTemplateData
): Promise<EmailTemplate> {
  // Si is_default = true, désactiver les autres templates du même type
  if (updates.is_default && updates.template_type) {
    const template = await getEmailTemplateById(templateId)
    await unsetDefaultEmailTemplate(template.company_id, updates.template_type)
  }

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single()

  if (error) {
    console.error('[invoiceSettingsService] Failed to update email template:', error)
    throw new Error(`Failed to update email template: ${error.message}`)
  }

  return data
}

export async function deleteEmailTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', templateId)

  if (error) {
    console.error('[invoiceSettingsService] Failed to delete email template:', error)
    throw new Error(`Failed to delete email template: ${error.message}`)
  }
}

// Helper pour désactiver le template email par défaut du même type
async function unsetDefaultEmailTemplate(
  companyId: string,
  templateType: EmailTemplateType
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ is_default: false })
    .eq('company_id', companyId)
    .eq('template_type', templateType)
    .eq('is_default', true)

  if (error) {
    console.error('[invoiceSettingsService] Failed to unset default email template:', error)
    throw new Error(`Failed to unset default email template: ${error.message}`)
  }
}

// ==============================================================================
// INITIALIZATION (Créer settings par défaut pour nouvelle entreprise)
// ==============================================================================

export async function initializeInvoiceSettings(companyId: string): Promise<void> {
  const { error } = await supabase.rpc('initialize_invoice_settings_for_company', {
    p_company_id: companyId
  })

  if (error) {
    console.error('[invoiceSettingsService] Failed to initialize invoice settings:', error)
    throw new Error(`Failed to initialize invoice settings: ${error.message}`)
  }
}
