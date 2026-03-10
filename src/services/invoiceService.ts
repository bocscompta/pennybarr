// Invoice Service - CRUD operations for invoices
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { Invoice, ThirdParty, InvoiceFormData, InvoiceAnalyticalAssignment } from '../types/database'

// ============ Document Upload ============

/**
 * Upload invoice document (PDF/image) to Supabase Storage
 * Returns the public URL of the uploaded file
 */
export async function uploadInvoiceDocument(
  file: File,
  transactionId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const fileName = `${COMPANY_ID}/${transactionId}_${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('invoice-documents')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Error uploading document:', uploadError)
    throw new Error(`Erreur upload document: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('invoice-documents')
    .getPublicUrl(fileName)

  console.log(`📄 Document uploaded: ${urlData.publicUrl}`)
  return urlData.publicUrl
}

// ============ Third Party Management ============

/**
 * Find or create a third party by name
 */
export async function findOrCreateThirdParty(
  name: string,
  type: 'supplier' | 'customer'
): Promise<ThirdParty> {
  if (!name || !name.trim()) {
    throw new Error('Le nom du tiers est requis')
  }

  const normalizedName = name.trim().toUpperCase()

  // Try to find existing third party (limit 1 in case of duplicates)
  const { data: existingList, error: searchError } = await supabase
    .from('third_parties')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .ilike('name', normalizedName)
    .limit(1)

  if (searchError) {
    console.error('Error searching third party:', searchError)
    throw new Error(`Erreur recherche tiers: ${searchError.message}`)
  }

  if (existingList && existingList.length > 0) {
    console.log(`Found existing third party: ${existingList[0].name} (${existingList[0].id})`)
    return existingList[0]
  }

  // Create new third party
  const { data: created, error: createError } = await supabase
    .from('third_parties')
    .insert({
      company_id: COMPANY_ID,
      name: normalizedName,
      type: type,
      country: 'FR',
      payment_terms: 30,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating third party:', createError)
    throw new Error(`Erreur création tiers: ${createError.message}`)
  }

  console.log(`Created new third party: ${created.name} (${created.id})`)
  return created
}

// ============ Invoice CRUD ============

/**
 * Create a supplier invoice from form data
 */
export async function createSupplierInvoice(
  formData: InvoiceFormData,
  _transactionId: string, // Used by caller for linking
  documentUrl?: string
): Promise<Invoice> {
  // Validate required fields
  if (!formData.thirdPartyName) {
    throw new Error('Le nom du fournisseur est requis')
  }
  if (!formData.invoiceNumber) {
    throw new Error('Le numéro de facture est requis')
  }
  if (!formData.invoiceDate) {
    throw new Error('La date de facture est requise')
  }
  if (formData.totalTTC <= 0) {
    throw new Error('Le montant TTC doit être supérieur à 0')
  }

  // Find or create third party
  const thirdParty = await findOrCreateThirdParty(
    formData.thirdPartyName,
    formData.thirdPartyType
  )

  // Create invoice
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      company_id: COMPANY_ID,
      third_party_id: thirdParty.id,
      type: formData.thirdPartyType,
      number: formData.invoiceNumber,
      date: formData.invoiceDate,
      due_date: formData.dueDate || null,
      status: 'paid', // Already paid since linked to transaction
      total_ht: formData.totalHT,
      total_vat: formData.totalVAT,
      total_ttc: formData.totalTTC,
      currency: formData.currency || 'EUR',
      exchange_rate: formData.exchangeRate || null,
      base_currency: formData.currency !== 'EUR' ? 'EUR' : null,
      pdf_url: documentUrl || null,
      payment_method: formData.paymentMethod || null,
    })
    .select('*, third_party:third_parties(*)')
    .single()

  if (error) {
    console.error('Error creating invoice:', error)
    throw new Error(`Erreur création facture: ${error.message}`)
  }

  console.log(`Created invoice ${invoice.number} for ${thirdParty.name}`)
  return invoice
}

/**
 * Update an existing invoice
 */
export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select('*, third_party:third_parties(*)')
    .single()

  if (error) {
    console.error('Error updating invoice:', error)
    throw new Error(`Erreur mise à jour facture: ${error.message}`)
  }

  return data
}

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('id', invoiceId)
    .single()

  if (error) {
    console.error('Error fetching invoice:', error)
    throw new Error(`Erreur chargement facture: ${error.message}`)
  }

  return data
}

/**
 * Delete invoice
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)

  if (error) {
    console.error('Error deleting invoice:', error)
    throw new Error(`Erreur suppression facture: ${error.message}`)
  }
}

/**
 * Link invoice to bank transaction
 */
export async function linkInvoiceToTransaction(
  invoiceId: string,
  transactionId: string
): Promise<void> {
  const { error } = await supabase
    .from('bank_transactions')
    .update({
      linked_invoice_id: invoiceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)

  if (error) {
    console.error('Error linking invoice to transaction:', error)
    throw new Error(`Erreur liaison facture/transaction: ${error.message}`)
  }
}

// ============ Draft Invoice Management ============

/**
 * Save invoice draft data to bank transaction
 * Called automatically when OCR completes or user modifies form
 */
export async function saveInvoiceDraft(
  transactionId: string,
  draftData: InvoiceFormData,
  documentUrl?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    draft_invoice_data: draftData,
    updated_at: new Date().toISOString(),
  }

  if (documentUrl) {
    updateData.draft_document_url = documentUrl
  }

  const { error } = await supabase
    .from('bank_transactions')
    .update(updateData)
    .eq('id', transactionId)

  if (error) {
    console.error('Error saving invoice draft:', error)
    throw new Error(`Erreur sauvegarde brouillon: ${error.message}`)
  }

  console.log(`💾 Draft saved for transaction ${transactionId}`)
}

/**
 * Load invoice draft data from bank transaction
 */
export async function loadInvoiceDraft(
  transactionId: string
): Promise<{ draftData: InvoiceFormData | null; documentUrl: string | null }> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('draft_invoice_data, draft_document_url')
    .eq('id', transactionId)
    .single()

  if (error) {
    console.error('Error loading invoice draft:', error)
    throw new Error(`Erreur chargement brouillon: ${error.message}`)
  }

  return {
    draftData: data.draft_invoice_data as InvoiceFormData | null,
    documentUrl: data.draft_document_url as string | null,
  }
}

/**
 * Clear invoice draft after successful save
 */
export async function clearInvoiceDraft(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('bank_transactions')
    .update({
      draft_invoice_data: null,
      draft_document_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)

  if (error) {
    console.error('Error clearing invoice draft:', error)
    throw new Error(`Erreur suppression brouillon: ${error.message}`)
  }

  console.log(`🗑️ Draft cleared for transaction ${transactionId}`)
}

// ============ Analytical Assignments ============

/**
 * Save analytical code assignments for a finalized invoice.
 * Deletes existing assignments first then inserts new ones.
 */
export async function saveAnalyticalAssignments(
  invoiceId: string,
  companyId: string,
  totalTTC: number,
  codes: { id: string; categoryId: string; categoryName: string; percentage: number; accountCode?: string }[]
): Promise<void> {
  if (codes.length === 0) return

  // Delete existing assignments for this invoice
  const { error: deleteError } = await supabase
    .from('invoice_analytical_assignments')
    .delete()
    .eq('invoice_id', invoiceId)

  if (deleteError) {
    console.error('Error deleting old analytical assignments:', deleteError)
    throw new Error(`Erreur suppression anciennes ventilations: ${deleteError.message}`)
  }

  // Insert new assignments
  const rows = codes.map(code => ({
    company_id: companyId,
    invoice_id: invoiceId,
    category_id: code.categoryId || null,
    category_name: code.categoryName,
    percentage: code.percentage,
    amount: Math.round(totalTTC * code.percentage / 100 * 100) / 100,
    account_code: code.accountCode || null,
  }))

  const { error: insertError } = await supabase
    .from('invoice_analytical_assignments')
    .insert(rows)

  if (insertError) {
    console.error('Error saving analytical assignments:', insertError)
    throw new Error(`Erreur sauvegarde ventilations analytiques: ${insertError.message}`)
  }

  console.log(`📊 Saved ${rows.length} analytical assignments for invoice ${invoiceId}`)
}

/**
 * Load analytical assignments for a finalized invoice
 */
export async function loadAnalyticalAssignments(
  invoiceId: string
): Promise<InvoiceAnalyticalAssignment[]> {
  const { data, error } = await supabase
    .from('invoice_analytical_assignments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at')

  if (error) {
    console.error('Error loading analytical assignments:', error)
    throw new Error(`Erreur chargement ventilations analytiques: ${error.message}`)
  }

  return data as InvoiceAnalyticalAssignment[]
}
