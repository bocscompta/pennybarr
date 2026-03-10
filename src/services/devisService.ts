// Devis (Quotes) Service - CRUD operations for quotes before invoicing
// Pennybarr - Gestion Commerciale

import { supabase, COMPANY_ID } from '../lib/supabase'
import type {
  Devis,
  DevisLine,
  DevisFormData,
  DevisFilters,
  DevisStatus,
} from '../types/commercial'
import type { Invoice } from '../types/database'

// ============ Types for Service ============

export interface DevisLineInput {
  productId?: string
  description: string
  quantity: number
  unit: string
  unitPriceHT: number
  vatRate: string
  discountPercent?: number
  sortOrder?: number
}

// ============ Helper Functions ============

/**
 * Calculate line totals from input data
 */
function calculateLineTotals(line: DevisLineInput): {
  total_ht: number
  total_vat: number
  total_ttc: number
  discount_amount: number
} {
  const baseTotal = line.quantity * line.unitPriceHT
  const discountAmount = line.discountPercent
    ? (baseTotal * line.discountPercent) / 100
    : 0
  const totalHT = baseTotal - discountAmount
  const vatRate = parseFloat(line.vatRate) || 0
  const totalVAT = (totalHT * vatRate) / 100
  const totalTTC = totalHT + totalVAT

  return {
    total_ht: totalHT,
    total_vat: totalVAT,
    total_ttc: totalTTC,
    discount_amount: discountAmount,
  }
}

/**
 * Recalculate devis totals from lines
 */
async function recalculateDevisTotals(devisId: string): Promise<void> {
  // Get all lines for this devis
  const { data: lines, error: linesError } = await supabase
    .from('devis_lines')
    .select('total_ht, total_vat, total_ttc')
    .eq('devis_id', devisId)

  if (linesError) {
    console.error('Error fetching devis lines for recalculation:', linesError)
    throw new Error(`Erreur recalcul totaux devis: ${linesError.message}`)
  }

  const totals = (lines || []).reduce(
    (acc, line) => ({
      total_ht: acc.total_ht + Number(line.total_ht),
      total_vat: acc.total_vat + Number(line.total_vat),
      total_ttc: acc.total_ttc + Number(line.total_ttc),
    }),
    { total_ht: 0, total_vat: 0, total_ttc: 0 }
  )

  // Update devis totals
  const { error: updateError } = await supabase
    .from('devis')
    .update({
      total_ht: totals.total_ht,
      total_vat: totals.total_vat,
      total_ttc: totals.total_ttc,
      updated_at: new Date().toISOString(),
    })
    .eq('id', devisId)

  if (updateError) {
    console.error('Error updating devis totals:', updateError)
    throw new Error(`Erreur mise a jour totaux devis: ${updateError.message}`)
  }
}

// ============ Devis Number Generation ============

/**
 * Generate next devis number from invoice_settings
 * Format: {quote_prefix}{year}-{quote_next_number} (ex: D-2026-00001)
 */
export async function generateDevisNumber(): Promise<string> {
  const year = new Date().getFullYear()

  // Get quote numbering config from invoice_settings
  const { data: settings, error: settingsError } = await supabase
    .from('invoice_settings')
    .select('quote_prefix, quote_next_number')
    .eq('company_id', COMPANY_ID)
    .single()

  if (settingsError) {
    console.error('Error fetching invoice settings:', settingsError)
    throw new Error(`Erreur recuperation config: ${settingsError.message}`)
  }

  if (!settings) {
    throw new Error('Configuration de numerotation introuvable')
  }

  const prefix = settings.quote_prefix || 'D-'
  const nextNumber = settings.quote_next_number || 1

  return `${prefix}${year}-${nextNumber.toString().padStart(5, '0')}`
}

/**
 * Increment quote number in invoice_settings after successful creation
 */
export async function incrementQuoteNumber(): Promise<void> {
  const { data: settings, error: fetchError } = await supabase
    .from('invoice_settings')
    .select('quote_next_number')
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError) {
    console.error('Error fetching invoice settings for increment:', fetchError)
    throw new Error(`Erreur recuperation config: ${fetchError.message}`)
  }

  if (!settings) {
    throw new Error('Configuration de numerotation introuvable')
  }

  const nextNumber = (settings.quote_next_number || 1) + 1

  const { error: updateError } = await supabase
    .from('invoice_settings')
    .update({ quote_next_number: nextNumber })
    .eq('company_id', COMPANY_ID)

  if (updateError) {
    console.error('Error incrementing quote number:', updateError)
    throw new Error(`Erreur increment numero devis: ${updateError.message}`)
  }

  console.log(`Quote number incremented to ${nextNumber}`)
}

// ============ CRUD Operations ============

/**
 * Create a new devis
 */
export async function createDevis(data: DevisFormData): Promise<Devis> {
  // Validate required fields
  if (!data.customerId) {
    throw new Error('Le client est requis pour creer un devis')
  }
  if (!data.date) {
    throw new Error('La date du devis est requise')
  }
  if (!data.validityDate) {
    throw new Error('La date de validite est requise')
  }
  if (!data.lines || data.lines.length === 0) {
    throw new Error('Au moins une ligne est requise')
  }

  // Generate devis number
  const devisNumber = await generateDevisNumber()

  // Calculate totals from lines
  let totalHT = 0
  let totalVAT = 0
  let totalTTC = 0

  const processedLines = data.lines.map((line, index) => {
    const lineTotals = calculateLineTotals({
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceHT: line.unitPriceHT,
      vatRate: line.vatRate,
      discountPercent: line.discountPercent,
    })

    totalHT += lineTotals.total_ht
    totalVAT += lineTotals.total_vat
    totalTTC += lineTotals.total_ttc

    return {
      product_id: line.productId || null,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price_ht: line.unitPriceHT,
      vat_rate: line.vatRate,
      discount_percent: line.discountPercent || null,
      discount_amount: lineTotals.discount_amount || null,
      total_ht: lineTotals.total_ht,
      total_vat: lineTotals.total_vat,
      total_ttc: lineTotals.total_ttc,
      sort_order: index + 1,
    }
  })

  // Apply global discount if any
  if (data.discountPercent && data.discountPercent > 0) {
    const discountAmount = (totalHT * data.discountPercent) / 100
    totalHT -= discountAmount
    totalVAT = totalTTC - totalHT // Recalculate VAT proportionally
    totalTTC = totalHT + totalVAT
  }

  // Create devis
  const { data: devis, error: devisError } = await supabase
    .from('devis')
    .insert({
      company_id: COMPANY_ID,
      customer_id: data.customerId,
      number: devisNumber,
      reference: data.reference || null,
      date: data.date,
      validity_date: data.validityDate,
      status: 'draft' as DevisStatus,
      total_ht: totalHT,
      total_vat: totalVAT,
      total_ttc: totalTTC,
      discount_percent: data.discountPercent || null,
      notes: data.notes || null,
      terms: data.terms || null,
      payment_terms: data.paymentTerms || null,
    })
    .select('*, customer:third_parties(*)')
    .single()

  if (devisError) {
    console.error('Error creating devis:', devisError)
    throw new Error(`Erreur creation devis: ${devisError.message}`)
  }

  // Create lines
  const linesWithDevisId = processedLines.map((line) => ({
    ...line,
    devis_id: devis.id,
  }))

  const { data: lines, error: linesError } = await supabase
    .from('devis_lines')
    .insert(linesWithDevisId)
    .select('*')

  if (linesError) {
    console.error('Error creating devis lines:', linesError)
    // Rollback: delete the devis
    await supabase.from('devis').delete().eq('id', devis.id)
    throw new Error(`Erreur creation lignes devis: ${linesError.message}`)
  }

  console.log(`Created devis ${devisNumber} with ${lines?.length || 0} lines`)

  // Increment quote number in settings
  await incrementQuoteNumber()

  return {
    ...devis,
    lines: lines || [],
  }
}

/**
 * Get a devis by ID
 */
export async function getDevis(devisId: string): Promise<Devis> {
  const { data, error } = await supabase
    .from('devis')
    .select('*, customer:third_parties(*), lines:devis_lines(*)')
    .eq('id', devisId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (error) {
    console.error('Error fetching devis:', error)
    throw new Error(`Erreur chargement devis: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Devis non trouve: ${devisId}`)
  }

  return data
}

/**
 * Update a devis
 */
export async function updateDevis(
  devisId: string,
  data: Partial<DevisFormData>
): Promise<Devis> {
  // Check if devis exists and is editable
  const existing = await getDevis(devisId)
  if (existing.status !== 'draft') {
    throw new Error('Seuls les devis en brouillon peuvent etre modifies')
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.customerId !== undefined) updateData.customer_id = data.customerId
  if (data.date !== undefined) updateData.date = data.date
  if (data.validityDate !== undefined) updateData.validity_date = data.validityDate
  if (data.reference !== undefined) updateData.reference = data.reference || null
  if (data.notes !== undefined) updateData.notes = data.notes || null
  if (data.terms !== undefined) updateData.terms = data.terms || null
  if (data.paymentTerms !== undefined) updateData.payment_terms = data.paymentTerms || null
  if (data.discountPercent !== undefined) updateData.discount_percent = data.discountPercent || null

  // If lines are provided, replace all lines
  if (data.lines && data.lines.length > 0) {
    // Delete existing lines
    const { error: deleteError } = await supabase
      .from('devis_lines')
      .delete()
      .eq('devis_id', devisId)

    if (deleteError) {
      console.error('Error deleting existing devis lines:', deleteError)
      throw new Error(`Erreur suppression lignes: ${deleteError.message}`)
    }

    // Calculate new totals
    let totalHT = 0
    let totalVAT = 0
    let totalTTC = 0

    const newLines = data.lines.map((line, index) => {
      const lineTotals = calculateLineTotals({
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceHT: line.unitPriceHT,
        vatRate: line.vatRate,
        discountPercent: line.discountPercent,
      })

      totalHT += lineTotals.total_ht
      totalVAT += lineTotals.total_vat
      totalTTC += lineTotals.total_ttc

      return {
        devis_id: devisId,
        product_id: line.productId || null,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price_ht: line.unitPriceHT,
        vat_rate: line.vatRate,
        discount_percent: line.discountPercent || null,
        discount_amount: lineTotals.discount_amount || null,
        total_ht: lineTotals.total_ht,
        total_vat: lineTotals.total_vat,
        total_ttc: lineTotals.total_ttc,
        sort_order: index + 1,
      }
    })

    // Insert new lines
    const { error: insertError } = await supabase
      .from('devis_lines')
      .insert(newLines)

    if (insertError) {
      console.error('Error inserting new devis lines:', insertError)
      throw new Error(`Erreur insertion lignes: ${insertError.message}`)
    }

    // Apply global discount
    const discountPercent = data.discountPercent ?? existing.discount_percent ?? 0
    if (discountPercent > 0) {
      const discountAmount = (totalHT * discountPercent) / 100
      totalHT -= discountAmount
      totalVAT = totalTTC - totalHT
      totalTTC = totalHT + totalVAT
    }

    updateData.total_ht = totalHT
    updateData.total_vat = totalVAT
    updateData.total_ttc = totalTTC
  }

  // Update devis
  const { data: updated, error: updateError } = await supabase
    .from('devis')
    .update(updateData)
    .eq('id', devisId)
    .select('*, customer:third_parties(*), lines:devis_lines(*)')
    .single()

  if (updateError) {
    console.error('Error updating devis:', updateError)
    throw new Error(`Erreur mise a jour devis: ${updateError.message}`)
  }

  return updated
}

/**
 * Delete a devis
 */
export async function deleteDevis(devisId: string): Promise<void> {
  // Check if devis exists and is deletable
  const existing = await getDevis(devisId)
  if (existing.status === 'invoiced') {
    throw new Error('Un devis facture ne peut pas etre supprime')
  }

  // Delete lines first (cascade should handle this, but being explicit)
  const { error: linesError } = await supabase
    .from('devis_lines')
    .delete()
    .eq('devis_id', devisId)

  if (linesError) {
    console.error('Error deleting devis lines:', linesError)
    throw new Error(`Erreur suppression lignes devis: ${linesError.message}`)
  }

  // Delete devis
  const { error } = await supabase
    .from('devis')
    .delete()
    .eq('id', devisId)

  if (error) {
    console.error('Error deleting devis:', error)
    throw new Error(`Erreur suppression devis: ${error.message}`)
  }

  console.log(`Deleted devis ${existing.number}`)
}

/**
 * List devis with optional filters
 */
export async function listDevis(filters?: DevisFilters): Promise<Devis[]> {
  let query = supabase
    .from('devis')
    .select('*, customer:third_parties(*), lines:devis_lines(*)')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate)
  }

  if (filters?.searchTerm) {
    query = query.or(
      `number.ilike.%${filters.searchTerm}%,reference.ilike.%${filters.searchTerm}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error listing devis:', error)
    throw new Error(`Erreur liste devis: ${error.message}`)
  }

  if (!data) {
    console.error('listDevis: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour devis')
  }

  return data
}

// ============ Devis Lines Management ============

/**
 * Add a line to a devis
 */
export async function addDevisLine(
  devisId: string,
  line: DevisLineInput
): Promise<DevisLine> {
  // Check if devis is editable
  const devis = await getDevis(devisId)
  if (devis.status !== 'draft') {
    throw new Error('Seuls les devis en brouillon peuvent etre modifies')
  }

  // Get max sort_order
  const { data: maxOrderData } = await supabase
    .from('devis_lines')
    .select('sort_order')
    .eq('devis_id', devisId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (maxOrderData?.[0]?.sort_order ?? 0) + 1

  // Calculate line totals
  const lineTotals = calculateLineTotals(line)

  // Insert line
  const { data: newLine, error } = await supabase
    .from('devis_lines')
    .insert({
      devis_id: devisId,
      product_id: line.productId || null,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price_ht: line.unitPriceHT,
      vat_rate: line.vatRate,
      discount_percent: line.discountPercent || null,
      discount_amount: lineTotals.discount_amount || null,
      total_ht: lineTotals.total_ht,
      total_vat: lineTotals.total_vat,
      total_ttc: lineTotals.total_ttc,
      sort_order: line.sortOrder ?? nextOrder,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error adding devis line:', error)
    throw new Error(`Erreur ajout ligne: ${error.message}`)
  }

  // Recalculate devis totals
  await recalculateDevisTotals(devisId)

  return newLine
}

/**
 * Update a devis line
 */
export async function updateDevisLine(
  lineId: string,
  data: Partial<DevisLineInput>
): Promise<DevisLine> {
  // Get the line to find the devis
  const { data: existingLine, error: fetchError } = await supabase
    .from('devis_lines')
    .select('*, devis:devis!inner(id, status, company_id)')
    .eq('id', lineId)
    .single()

  if (fetchError) {
    console.error('Error fetching devis line:', fetchError)
    throw new Error(`Erreur chargement ligne: ${fetchError.message}`)
  }

  if (!existingLine) {
    throw new Error(`Ligne non trouvee: ${lineId}`)
  }

  // Check devis is editable and belongs to company
  const devisData = Array.isArray(existingLine.devis) ? existingLine.devis[0] : existingLine.devis
  if (devisData.company_id !== COMPANY_ID) {
    throw new Error('Acces refuse a ce devis')
  }

  if (devisData.status !== 'draft') {
    throw new Error('Seuls les devis en brouillon peuvent etre modifies')
  }

  // Build update data
  const updateData: Record<string, unknown> = {}

  if (data.productId !== undefined) updateData.product_id = data.productId || null
  if (data.description !== undefined) updateData.description = data.description
  if (data.quantity !== undefined) updateData.quantity = data.quantity
  if (data.unit !== undefined) updateData.unit = data.unit
  if (data.unitPriceHT !== undefined) updateData.unit_price_ht = data.unitPriceHT
  if (data.vatRate !== undefined) updateData.vat_rate = data.vatRate
  if (data.discountPercent !== undefined) updateData.discount_percent = data.discountPercent || null
  if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

  // Recalculate totals if price-related fields changed
  const needsRecalc =
    data.quantity !== undefined ||
    data.unitPriceHT !== undefined ||
    data.vatRate !== undefined ||
    data.discountPercent !== undefined

  if (needsRecalc) {
    const lineTotals = calculateLineTotals({
      productId: data.productId ?? existingLine.product_id,
      description: data.description ?? existingLine.description,
      quantity: data.quantity ?? existingLine.quantity,
      unit: data.unit ?? existingLine.unit,
      unitPriceHT: data.unitPriceHT ?? existingLine.unit_price_ht,
      vatRate: data.vatRate ?? existingLine.vat_rate,
      discountPercent: data.discountPercent ?? existingLine.discount_percent,
    })

    updateData.discount_amount = lineTotals.discount_amount || null
    updateData.total_ht = lineTotals.total_ht
    updateData.total_vat = lineTotals.total_vat
    updateData.total_ttc = lineTotals.total_ttc
  }

  // Update line
  const { data: updatedLine, error: updateError } = await supabase
    .from('devis_lines')
    .update(updateData)
    .eq('id', lineId)
    .select('*')
    .single()

  if (updateError) {
    console.error('Error updating devis line:', updateError)
    throw new Error(`Erreur mise a jour ligne: ${updateError.message}`)
  }

  // Recalculate devis totals
  if (needsRecalc) {
    await recalculateDevisTotals(existingLine.devis_id)
  }

  return updatedLine
}

/**
 * Delete a devis line
 */
export async function deleteDevisLine(lineId: string): Promise<void> {
  // Get the line to find the devis
  const { data: existingLine, error: fetchError } = await supabase
    .from('devis_lines')
    .select('devis_id, devis:devis!inner(status, company_id)')
    .eq('id', lineId)
    .single()

  if (fetchError) {
    console.error('Error fetching devis line:', fetchError)
    throw new Error(`Erreur chargement ligne: ${fetchError.message}`)
  }

  if (!existingLine) {
    throw new Error(`Ligne non trouvee: ${lineId}`)
  }

  // Check devis is editable and belongs to company
  const devis = Array.isArray(existingLine.devis) ? existingLine.devis[0] : existingLine.devis
  if (devis.company_id !== COMPANY_ID) {
    throw new Error('Acces refuse a ce devis')
  }

  if (devis.status !== 'draft') {
    throw new Error('Seuls les devis en brouillon peuvent etre modifies')
  }

  // Delete line
  const { error: deleteError } = await supabase
    .from('devis_lines')
    .delete()
    .eq('id', lineId)

  if (deleteError) {
    console.error('Error deleting devis line:', deleteError)
    throw new Error(`Erreur suppression ligne: ${deleteError.message}`)
  }

  // Recalculate devis totals
  await recalculateDevisTotals(existingLine.devis_id)
}

// ============ Workflow Operations ============

/**
 * Send a devis to customer (draft -> sent)
 */
export async function sendDevis(devisId: string): Promise<Devis> {
  const devis = await getDevis(devisId)

  if (devis.status !== 'draft') {
    throw new Error('Seuls les devis en brouillon peuvent etre envoyes')
  }

  const { data, error } = await supabase
    .from('devis')
    .update({
      status: 'sent' as DevisStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', devisId)
    .select('*, customer:third_parties(*), lines:devis_lines(*)')
    .single()

  if (error) {
    console.error('Error sending devis:', error)
    throw new Error(`Erreur envoi devis: ${error.message}`)
  }

  console.log(`Devis ${data.number} marked as sent`)
  return data
}

/**
 * Accept a devis (sent -> accepted)
 */
export async function acceptDevis(devisId: string): Promise<Devis> {
  const devis = await getDevis(devisId)

  if (devis.status !== 'sent') {
    throw new Error('Seuls les devis envoyes peuvent etre acceptes')
  }

  const { data, error } = await supabase
    .from('devis')
    .update({
      status: 'accepted' as DevisStatus,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', devisId)
    .select('*, customer:third_parties(*), lines:devis_lines(*)')
    .single()

  if (error) {
    console.error('Error accepting devis:', error)
    throw new Error(`Erreur acceptation devis: ${error.message}`)
  }

  console.log(`Devis ${data.number} accepted`)
  return data
}

/**
 * Reject a devis (sent -> refused)
 */
export async function rejectDevis(
  devisId: string,
  reason?: string
): Promise<Devis> {
  const devis = await getDevis(devisId)

  if (devis.status !== 'sent') {
    throw new Error('Seuls les devis envoyes peuvent etre refuses')
  }

  const updateData: Record<string, unknown> = {
    status: 'refused' as DevisStatus,
    refused_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (reason) {
    updateData.notes = devis.notes
      ? `${devis.notes}\n\n--- Motif refus ---\n${reason}`
      : `--- Motif refus ---\n${reason}`
  }

  const { data, error } = await supabase
    .from('devis')
    .update(updateData)
    .eq('id', devisId)
    .select('*, customer:third_parties(*), lines:devis_lines(*)')
    .single()

  if (error) {
    console.error('Error rejecting devis:', error)
    throw new Error(`Erreur refus devis: ${error.message}`)
  }

  console.log(`Devis ${data.number} refused`)
  return data
}

/**
 * Convert accepted devis to customer invoice
 */
export async function convertToInvoice(devisId: string): Promise<Invoice> {
  const devis = await getDevis(devisId)

  if (devis.status !== 'accepted') {
    throw new Error('Seuls les devis acceptes peuvent etre convertis en facture')
  }

  // Generate invoice number
  const year = new Date().getFullYear()
  const prefix = `FC-${year}-`

  const { data: lastInvoice, error: seqError } = await supabase
    .from('invoices')
    .select('number')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)

  if (seqError) {
    console.error('Error fetching last invoice number:', seqError)
    throw new Error(`Erreur generation numero facture: ${seqError.message}`)
  }

  let nextNumber = 1
  if (lastInvoice && lastInvoice.length > 0) {
    const lastSeq = parseInt(lastInvoice[0].number.replace(prefix, ''), 10)
    if (!isNaN(lastSeq)) {
      nextNumber = lastSeq + 1
    }
  }

  const invoiceNumber = `${prefix}${nextNumber.toString().padStart(5, '0')}`

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: COMPANY_ID,
      third_party_id: devis.customer_id,
      type: 'customer',
      number: invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0], // +30 days
      status: 'draft',
      total_ht: devis.total_ht,
      total_vat: devis.total_vat,
      total_ttc: devis.total_ttc,
      currency: 'EUR',
      notes: `Converti depuis devis ${devis.number}`,
    })
    .select('*, third_party:third_parties(*)')
    .single()

  if (invoiceError) {
    console.error('Error creating invoice from devis:', invoiceError)
    throw new Error(`Erreur creation facture: ${invoiceError.message}`)
  }

  // Create invoice lines from devis lines
  if (devis.lines && devis.lines.length > 0) {
    const invoiceLines = devis.lines.map((line) => ({
      invoice_id: invoice.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price_ht,
      vat_rate: parseFloat(line.vat_rate) || 0,
      total_ht: line.total_ht,
      total_vat: line.total_vat,
      total_ttc: line.total_ttc,
    }))

    const { error: linesError } = await supabase
      .from('invoice_lines')
      .insert(invoiceLines)

    if (linesError) {
      console.error('Error creating invoice lines:', linesError)
      // Don't rollback, invoice is created, just log warning
      console.warn('Invoice created but lines failed - manual fix needed')
    }
  }

  // Update devis status
  const { error: updateError } = await supabase
    .from('devis')
    .update({
      status: 'invoiced' as DevisStatus,
      converted_to_invoice_id: invoice.id,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', devisId)

  if (updateError) {
    console.error('Error updating devis status after conversion:', updateError)
    // Don't throw, invoice is created
    console.warn('Invoice created but devis status update failed')
  }

  console.log(`Devis ${devis.number} converted to invoice ${invoiceNumber}`)
  return invoice
}
