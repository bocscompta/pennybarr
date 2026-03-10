// Contracts/Subscriptions Service - CRUD and billing operations
// Pennybarr - Gestion des Contrats et Abonnements

import { supabase, COMPANY_ID } from '../lib/supabase'
import type {
  Contract,
  ContractFormData,
  ContractLineFormData,
  ContractFilters,
  ContractStatus,
  BillingResult,
  AutoBillingResult,
  ExpiringContract,
  ContractStats,
} from '../types/contrats'
import type { Invoice } from '../types/database'

// ============ Helper Functions ============

/**
 * Calculate line totals from input data
 */
function calculateLineTotals(line: ContractLineFormData): {
  total_ht: number
  total_vat: number
  total_ttc: number
} {
  const totalHT = line.quantity * line.unitPrice
  const vatRate = parseFloat(line.vatRate) || 0
  const totalVAT = (totalHT * vatRate) / 100
  const totalTTC = totalHT + totalVAT

  return {
    total_ht: totalHT,
    total_vat: totalVAT,
    total_ttc: totalTTC,
  }
}

/**
 * Calculate next billing date based on frequency and billing day
 */
function calculateNextBillingDate(
  startDate: string,
  billingFrequency: 'monthly' | 'quarterly' | 'yearly',
  billingDay: number,
  fromDate?: string
): string {
  const start = new Date(fromDate || startDate)
  let nextDate = new Date(start)

  // Move to next period
  switch (billingFrequency) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
  }

  // Set to billing day
  const daysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
  const dayToSet = Math.min(billingDay, daysInMonth)
  nextDate.setDate(dayToSet)

  return nextDate.toISOString().split('T')[0]
}

/**
 * Calculate initial billing date
 */
function calculateInitialBillingDate(
  startDate: string,
  billingDay: number
): string {
  const start = new Date(startDate)
  let billingDate = new Date(start.getFullYear(), start.getMonth(), billingDay)

  // If billing day has passed this month, move to next month
  if (start.getDate() > billingDay) {
    billingDate.setMonth(billingDate.getMonth() + 1)
  }

  // Handle end of month
  const daysInMonth = new Date(billingDate.getFullYear(), billingDate.getMonth() + 1, 0).getDate()
  if (billingDay > daysInMonth) {
    billingDate.setDate(daysInMonth)
  }

  return billingDate.toISOString().split('T')[0]
}

// ============ Contract Number Generation ============

/**
 * Generate next contract number
 * Format: CTR-YYYY-NNNNN (ex: CTR-2025-00001)
 */
export async function generateContractNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `CTR-${year}-`

  const { data, error } = await supabase
    .from('contracts')
    .select('number')
    .eq('company_id', COMPANY_ID)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching last contract number:', error)
    throw new Error(`Erreur generation numero contrat: ${error.message}`)
  }

  let nextNumber = 1
  if (data && data.length > 0) {
    const lastNumber = data[0].number
    const lastSeq = parseInt(lastNumber.replace(prefix, ''), 10)
    if (!isNaN(lastSeq)) {
      nextNumber = lastSeq + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`
}

// ============ CRUD Operations ============

/**
 * Create a new contract
 */
export async function createContract(data: ContractFormData): Promise<Contract> {
  // Validate required fields
  if (!data.customerId) {
    throw new Error('Le client est requis pour creer un contrat')
  }
  if (!data.name) {
    throw new Error('Le nom du contrat est requis')
  }
  if (!data.startDate) {
    throw new Error('La date de debut est requise')
  }
  if (!data.lines || data.lines.length === 0) {
    throw new Error('Au moins une ligne est requise')
  }
  if (data.billingDay < 1 || data.billingDay > 28) {
    throw new Error('Le jour de facturation doit etre entre 1 et 28')
  }

  // Generate contract number
  const contractNumber = await generateContractNumber()

  // Calculate totals from lines
  let totalHT = 0
  let totalVAT = 0
  let totalTTC = 0

  const processedLines = data.lines.map((line, index) => {
    const lineTotals = calculateLineTotals(line)
    totalHT += lineTotals.total_ht
    totalVAT += lineTotals.total_vat
    totalTTC += lineTotals.total_ttc

    return {
      product_id: line.productId || null,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      vat_rate: parseFloat(line.vatRate) || 0,
      total_ht: lineTotals.total_ht,
      total_vat: lineTotals.total_vat,
      total_ttc: lineTotals.total_ttc,
      sort_order: index + 1,
    }
  })

  // Calculate next billing date
  const nextBillingDate = calculateInitialBillingDate(data.startDate, data.billingDay)

  // Create contract
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      company_id: COMPANY_ID,
      customer_id: data.customerId,
      number: contractNumber,
      name: data.name,
      type: data.type,
      status: 'draft' as ContractStatus,
      start_date: data.startDate,
      end_date: data.endDate || null,
      billing_frequency: data.billingFrequency,
      billing_day: data.billingDay,
      auto_renew: data.autoRenew,
      renewal_notice_days: data.renewalNoticeDays,
      total_ht: totalHT,
      total_vat: totalVAT,
      total_ttc: totalTTC,
      next_billing_date: nextBillingDate,
      notes: data.notes || null,
    })
    .select('*, customer:third_parties(*)')
    .single()

  if (contractError) {
    console.error('Error creating contract:', contractError)
    throw new Error(`Erreur creation contrat: ${contractError.message}`)
  }

  // Create lines
  const linesWithContractId = processedLines.map((line) => ({
    ...line,
    contract_id: contract.id,
  }))

  const { data: lines, error: linesError } = await supabase
    .from('contract_lines')
    .insert(linesWithContractId)
    .select('*')

  if (linesError) {
    console.error('Error creating contract lines:', linesError)
    // Rollback: delete the contract
    await supabase.from('contracts').delete().eq('id', contract.id)
    throw new Error(`Erreur creation lignes contrat: ${linesError.message}`)
  }

  console.log(`Created contract ${contractNumber} with ${lines?.length || 0} lines`)

  return {
    ...contract,
    lines: lines || [],
  }
}

/**
 * Get a contract by ID
 */
export async function getContract(contractId: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .eq('id', contractId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (error) {
    console.error('Error fetching contract:', error)
    throw new Error(`Erreur chargement contrat: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Contrat non trouve: ${contractId}`)
  }

  return data
}

/**
 * Update a contract
 */
export async function updateContract(
  contractId: string,
  data: Partial<ContractFormData>
): Promise<Contract> {
  // Check if contract exists and is editable
  const existing = await getContract(contractId)
  if (existing.status !== 'draft' && existing.status !== 'active') {
    throw new Error('Seuls les contrats en brouillon ou actifs peuvent etre modifies')
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.customerId !== undefined) updateData.customer_id = data.customerId
  if (data.name !== undefined) updateData.name = data.name
  if (data.type !== undefined) updateData.type = data.type
  if (data.startDate !== undefined) updateData.start_date = data.startDate
  if (data.endDate !== undefined) updateData.end_date = data.endDate || null
  if (data.billingFrequency !== undefined) updateData.billing_frequency = data.billingFrequency
  if (data.billingDay !== undefined) {
    if (data.billingDay < 1 || data.billingDay > 28) {
      throw new Error('Le jour de facturation doit etre entre 1 et 28')
    }
    updateData.billing_day = data.billingDay
  }
  if (data.autoRenew !== undefined) updateData.auto_renew = data.autoRenew
  if (data.renewalNoticeDays !== undefined) updateData.renewal_notice_days = data.renewalNoticeDays
  if (data.notes !== undefined) updateData.notes = data.notes || null

  // If lines are provided, replace all lines
  if (data.lines && data.lines.length > 0) {
    // Delete existing lines
    const { error: deleteError } = await supabase
      .from('contract_lines')
      .delete()
      .eq('contract_id', contractId)

    if (deleteError) {
      console.error('Error deleting existing contract lines:', deleteError)
      throw new Error(`Erreur suppression lignes: ${deleteError.message}`)
    }

    // Calculate new totals
    let totalHT = 0
    let totalVAT = 0
    let totalTTC = 0

    const newLines = data.lines.map((line, index) => {
      const lineTotals = calculateLineTotals(line)
      totalHT += lineTotals.total_ht
      totalVAT += lineTotals.total_vat
      totalTTC += lineTotals.total_ttc

      return {
        contract_id: contractId,
        product_id: line.productId || null,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        vat_rate: parseFloat(line.vatRate) || 0,
        total_ht: lineTotals.total_ht,
        total_vat: lineTotals.total_vat,
        total_ttc: lineTotals.total_ttc,
        sort_order: index + 1,
      }
    })

    // Insert new lines
    const { error: insertError } = await supabase
      .from('contract_lines')
      .insert(newLines)

    if (insertError) {
      console.error('Error inserting new contract lines:', insertError)
      throw new Error(`Erreur insertion lignes: ${insertError.message}`)
    }

    updateData.total_ht = totalHT
    updateData.total_vat = totalVAT
    updateData.total_ttc = totalTTC
  }

  // Recalculate next billing date if dates changed
  if (data.startDate || data.billingDay || data.billingFrequency) {
    const startDate = data.startDate || existing.start_date
    const billingDay = data.billingDay || existing.billing_day

    if (existing.status === 'draft') {
      // For draft contracts, recalculate from start
      updateData.next_billing_date = calculateInitialBillingDate(startDate, billingDay)
    }
  }

  // Update contract
  const { data: updated, error: updateError } = await supabase
    .from('contracts')
    .update(updateData)
    .eq('id', contractId)
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .single()

  if (updateError) {
    console.error('Error updating contract:', updateError)
    throw new Error(`Erreur mise a jour contrat: ${updateError.message}`)
  }

  return updated
}

/**
 * Delete a contract
 */
export async function deleteContract(contractId: string): Promise<void> {
  const existing = await getContract(contractId)
  if (existing.status !== 'draft') {
    throw new Error('Seuls les contrats en brouillon peuvent etre supprimes')
  }

  // Delete lines first
  const { error: linesError } = await supabase
    .from('contract_lines')
    .delete()
    .eq('contract_id', contractId)

  if (linesError) {
    console.error('Error deleting contract lines:', linesError)
    throw new Error(`Erreur suppression lignes contrat: ${linesError.message}`)
  }

  // Delete contract
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contractId)

  if (error) {
    console.error('Error deleting contract:', error)
    throw new Error(`Erreur suppression contrat: ${error.message}`)
  }

  console.log(`Deleted contract ${existing.number}`)
}

/**
 * List contracts with optional filters
 */
export async function listContracts(filters?: ContractFilters): Promise<Contract[]> {
  let query = supabase
    .from('contracts')
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }

  if (filters?.startDate) {
    query = query.gte('start_date', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('start_date', filters.endDate)
  }

  if (filters?.searchTerm) {
    query = query.or(
      `name.ilike.%${filters.searchTerm}%,number.ilike.%${filters.searchTerm}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error listing contracts:', error)
    throw new Error(`Erreur liste contrats: ${error.message}`)
  }

  if (!data) {
    console.error('listContracts: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour contracts')
  }

  let result = data

  // Filter expiring contracts if requested
  if (filters?.expiringInDays !== undefined) {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + filters.expiringInDays)

    result = result.filter(contract => {
      if (!contract.end_date) return false
      const endDate = new Date(contract.end_date)
      return endDate >= today && endDate <= futureDate
    })
  }

  return result
}

// ============ Workflow Operations ============

/**
 * Activate a contract (draft -> active)
 */
export async function activateContract(contractId: string): Promise<Contract> {
  const contract = await getContract(contractId)

  if (contract.status !== 'draft') {
    throw new Error('Seuls les contrats en brouillon peuvent etre actives')
  }

  const { data, error } = await supabase
    .from('contracts')
    .update({
      status: 'active' as ContractStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .single()

  if (error) {
    console.error('Error activating contract:', error)
    throw new Error(`Erreur activation contrat: ${error.message}`)
  }

  console.log(`Contract ${data.number} activated`)
  return data
}

/**
 * Suspend a contract (active -> suspended)
 */
export async function suspendContract(contractId: string, reason?: string): Promise<Contract> {
  const contract = await getContract(contractId)

  if (contract.status !== 'active') {
    throw new Error('Seuls les contrats actifs peuvent etre suspendus')
  }

  const updateData: Record<string, unknown> = {
    status: 'suspended' as ContractStatus,
    suspended_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (reason) {
    updateData.notes = contract.notes
      ? `${contract.notes}\n\n--- Suspension ---\n${reason}`
      : `--- Suspension ---\n${reason}`
  }

  const { data, error } = await supabase
    .from('contracts')
    .update(updateData)
    .eq('id', contractId)
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .single()

  if (error) {
    console.error('Error suspending contract:', error)
    throw new Error(`Erreur suspension contrat: ${error.message}`)
  }

  console.log(`Contract ${data.number} suspended`)
  return data
}

/**
 * Resume a suspended contract (suspended -> active)
 */
export async function resumeContract(contractId: string): Promise<Contract> {
  const contract = await getContract(contractId)

  if (contract.status !== 'suspended') {
    throw new Error('Seuls les contrats suspendus peuvent etre relances')
  }

  const { data, error } = await supabase
    .from('contracts')
    .update({
      status: 'active' as ContractStatus,
      suspended_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .single()

  if (error) {
    console.error('Error resuming contract:', error)
    throw new Error(`Erreur reprise contrat: ${error.message}`)
  }

  console.log(`Contract ${data.number} resumed`)
  return data
}

/**
 * Terminate a contract (active/suspended -> terminated)
 */
export async function terminateContract(
  contractId: string,
  reason?: string
): Promise<Contract> {
  const contract = await getContract(contractId)

  if (contract.status !== 'active' && contract.status !== 'suspended') {
    throw new Error('Seuls les contrats actifs ou suspendus peuvent etre resilies')
  }

  const updateData: Record<string, unknown> = {
    status: 'terminated' as ContractStatus,
    termination_reason: reason || null,
    terminated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('contracts')
    .update(updateData)
    .eq('id', contractId)
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .single()

  if (error) {
    console.error('Error terminating contract:', error)
    throw new Error(`Erreur resiliation contrat: ${error.message}`)
  }

  console.log(`Contract ${data.number} terminated`)
  return data
}

// ============ Billing Operations ============

/**
 * Get contracts due for billing on a specific date
 */
export async function getContractsDueForBilling(date: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'active')
    .lte('next_billing_date', date)

  if (error) {
    console.error('Error fetching contracts due for billing:', error)
    throw new Error(`Erreur chargement contrats a facturer: ${error.message}`)
  }

  if (!data) {
    console.error('getContractsDueForBilling: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour contracts due for billing')
  }

  return data
}

/**
 * Generate an invoice from a contract
 */
export async function generateInvoiceFromContract(contractId: string): Promise<Invoice> {
  const contract = await getContract(contractId)

  if (contract.status !== 'active') {
    throw new Error('Seuls les contrats actifs peuvent etre factures')
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

  // Calculate due date based on payment terms (30 days default)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: COMPANY_ID,
      third_party_id: contract.customer_id,
      type: 'customer',
      number: invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      status: 'draft',
      total_ht: contract.total_ht,
      total_vat: contract.total_vat,
      total_ttc: contract.total_ttc,
      currency: 'EUR',
      notes: `Facture generee depuis contrat ${contract.number} - ${contract.name}`,
    })
    .select('*, third_party:third_parties(*)')
    .single()

  if (invoiceError) {
    console.error('Error creating invoice from contract:', invoiceError)
    throw new Error(`Erreur creation facture: ${invoiceError.message}`)
  }

  // Create invoice lines from contract lines
  if (contract.lines && contract.lines.length > 0) {
    const invoiceLines = contract.lines.map((line) => ({
      invoice_id: invoice.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      vat_rate: line.vat_rate,
      total_ht: line.total_ht,
      total_vat: line.total_vat,
      total_ttc: line.total_ttc,
    }))

    const { error: linesError } = await supabase
      .from('invoice_lines')
      .insert(invoiceLines)

    if (linesError) {
      console.error('Error creating invoice lines:', linesError)
      console.warn('Invoice created but lines failed - manual fix needed')
    }
  }

  // Update contract billing dates
  const today = new Date().toISOString().split('T')[0]
  const nextBillingDate = calculateNextBillingDate(
    contract.start_date,
    contract.billing_frequency,
    contract.billing_day,
    today
  )

  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      last_billing_date: today,
      next_billing_date: nextBillingDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (updateError) {
    console.error('Error updating contract billing dates:', updateError)
    console.warn('Invoice created but contract update failed')
  }

  console.log(`Generated invoice ${invoiceNumber} from contract ${contract.number}`)
  return invoice
}

/**
 * Run automatic billing for all due contracts
 */
export async function runAutoBilling(): Promise<AutoBillingResult> {
  const today = new Date().toISOString().split('T')[0]
  const contractsDue = await getContractsDueForBilling(today)

  const results: BillingResult[] = []
  const errors: BillingResult[] = []

  for (const contract of contractsDue) {
    try {
      const invoice = await generateInvoiceFromContract(contract.id)
      results.push({
        contractId: contract.id,
        contractNumber: contract.number,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        success: true,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      errors.push({
        contractId: contract.id,
        contractNumber: contract.number,
        success: false,
        error: errorMessage,
      })
      console.error(`Error billing contract ${contract.number}:`, errorMessage)
    }
  }

  console.log(`Auto-billing completed: ${results.length} success, ${errors.length} errors`)

  return {
    generated: results,
    errors: errors,
    totalProcessed: contractsDue.length,
    totalSuccess: results.length,
    totalFailed: errors.length,
  }
}

// ============ Renewal Operations ============

/**
 * Get contracts expiring soon
 */
export async function getContractsExpiringSoon(days: number): Promise<ExpiringContract[]> {
  const today = new Date()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  const { data, error } = await supabase
    .from('contracts')
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .eq('company_id', COMPANY_ID)
    .in('status', ['active', 'suspended'])
    .not('end_date', 'is', null)
    .gte('end_date', today.toISOString().split('T')[0])
    .lte('end_date', futureDate.toISOString().split('T')[0])

  if (error) {
    console.error('Error fetching expiring contracts:', error)
    throw new Error(`Erreur chargement contrats expirant: ${error.message}`)
  }

  return (data || []).map(contract => {
    const endDate = new Date(contract.end_date!)
    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return {
      contract,
      daysUntilExpiry,
    }
  })
}

/**
 * Renew a contract
 */
export async function renewContract(
  contractId: string,
  newEndDate?: string
): Promise<Contract> {
  const contract = await getContract(contractId)

  if (contract.status !== 'active' && contract.status !== 'expired') {
    throw new Error('Seuls les contrats actifs ou expires peuvent etre renouveles')
  }

  // Calculate new end date if not provided
  let endDate = newEndDate
  if (!endDate && contract.end_date) {
    const currentEnd = new Date(contract.end_date)
    switch (contract.billing_frequency) {
      case 'monthly':
        currentEnd.setMonth(currentEnd.getMonth() + 12)
        break
      case 'quarterly':
        currentEnd.setMonth(currentEnd.getMonth() + 12)
        break
      case 'yearly':
        currentEnd.setFullYear(currentEnd.getFullYear() + 1)
        break
    }
    endDate = currentEnd.toISOString().split('T')[0]
  }

  const { data, error } = await supabase
    .from('contracts')
    .update({
      status: 'active' as ContractStatus,
      end_date: endDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .select('*, customer:third_parties(*), lines:contract_lines(*)')
    .single()

  if (error) {
    console.error('Error renewing contract:', error)
    throw new Error(`Erreur renouvellement contrat: ${error.message}`)
  }

  console.log(`Contract ${data.number} renewed until ${endDate}`)
  return data
}

// ============ Statistics ============

/**
 * Get contract statistics
 */
export async function getContractStats(): Promise<ContractStats> {
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, status, total_ttc, billing_frequency, end_date, next_billing_date')
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error fetching contract stats:', error)
    throw new Error(`Erreur chargement statistiques: ${error.message}`)
  }

  const allContracts = contracts || []
  const activeContracts = allContracts.filter(c => c.status === 'active')

  // Calculate MRR (Monthly Recurring Revenue)
  let totalMRR = 0
  for (const contract of activeContracts) {
    switch (contract.billing_frequency) {
      case 'monthly':
        totalMRR += contract.total_ttc
        break
      case 'quarterly':
        totalMRR += contract.total_ttc / 3
        break
      case 'yearly':
        totalMRR += contract.total_ttc / 12
        break
    }
  }

  // Calculate contracts due soon (next 30 days)
  const today = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const contractsDueSoon = activeContracts.filter(c => {
    if (!c.next_billing_date) return false
    const nextBilling = new Date(c.next_billing_date)
    return nextBilling >= today && nextBilling <= thirtyDaysFromNow
  }).length

  // Calculate contracts expiring soon (next 60 days)
  const sixtyDaysFromNow = new Date()
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)

  const contractsExpiringSoon = allContracts.filter(c => {
    if (!c.end_date || c.status === 'terminated' || c.status === 'expired') return false
    const endDate = new Date(c.end_date)
    return endDate >= today && endDate <= sixtyDaysFromNow
  }).length

  return {
    totalContracts: allContracts.length,
    activeContracts: activeContracts.length,
    totalMRR: Math.round(totalMRR * 100) / 100,
    totalARR: Math.round(totalMRR * 12 * 100) / 100,
    contractsDueSoon,
    contractsExpiringSoon,
  }
}

/**
 * Get invoices generated from a contract
 */
export async function getContractInvoices(contractId: string): Promise<Invoice[]> {
  const contract = await getContract(contractId)

  const { data, error } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .eq('third_party_id', contract.customer_id)
    .like('notes', `%${contract.number}%`)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching contract invoices:', error)
    throw new Error(`Erreur chargement factures contrat: ${error.message}`)
  }

  if (!data) {
    console.error('getContractInvoices: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour contract invoices')
  }

  return data
}
