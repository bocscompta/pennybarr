// Notes de Frais Service - CRUD operations for expense reports
// Workflow: draft → submitted → approved → paid
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { ExpenseReport, AccountingEntry, ChartOfAccount } from '../types/database'
import { generatePieceNumber } from './accountingService'
import {
  resolveByRole,
  resolveJournal,
  resolveExpenseCategory,
} from './accountResolverService'

// ============ Types ============

export interface ExpenseReportLine {
  id?: string
  expense_report_id: string
  date: string
  description: string
  category: string  // 'transport', 'repas', 'hebergement', 'fournitures', 'autre'
  amount_ht: number
  amount_vat: number
  amount_ttc: number
  vat_rate: string  // '20', '10', '5.5', '0'
  accounting_code: string
  receipt_url?: string
  created_at?: string
}

export interface CreateExpenseReportData {
  date: string
  notes?: string
  userId?: string
  lines: Omit<ExpenseReportLine, 'id' | 'expense_report_id' | 'created_at'>[]
}

// ============ Chart of Accounts Loader ============

async function loadChartOfAccounts(): Promise<ChartOfAccount[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)

  if (error) {
    console.error('loadChartOfAccounts: failed', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }

  if (!data) {
    console.error('loadChartOfAccounts: data is null')
    throw new Error('Erreur inattendue: plan comptable manquant')
  }

  return data
}

/**
 * Resolve expense category account code from DB
 */
async function resolveExpenseCategoryCode(category: string): Promise<string> {
  const result = await resolveExpenseCategory(category)
  return result.accountCode
}

// ============ Expense Report Number Generation ============

/**
 * Generate unique expense report number
 * Format: NDF2025-0001
 */
export async function generateExpenseReportNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `NDF${year}-`

  const { data, error } = await supabase
    .from('expense_reports')
    .select('number')
    .eq('company_id', COMPANY_ID)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching last expense report number:', error)
    throw new Error(`Erreur génération numéro note de frais: ${error.message}`)
  }

  let nextNumber = 1
  if (data && data.length > 0 && data[0].number) {
    const lastNumber = parseInt(data[0].number.replace(prefix, ''), 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// ============ CRUD Operations ============

/**
 * Create an expense report with lines
 */
export async function createExpenseReport(
  data: CreateExpenseReportData
): Promise<ExpenseReport> {
  if (!data.date) {
    throw new Error('La date de la note de frais est requise')
  }
  if (!data.lines || data.lines.length === 0) {
    throw new Error('Au moins une ligne de frais est requise')
  }

  // Validate all lines
  for (const line of data.lines) {
    if (!line.date) {
      throw new Error('La date est requise pour chaque ligne')
    }
    if (!line.description) {
      throw new Error('La description est requise pour chaque ligne')
    }
    if (line.amount_ttc <= 0) {
      throw new Error('Le montant TTC doit être supérieur à 0')
    }
  }

  // Generate unique number
  const number = await generateExpenseReportNumber()

  // Calculate totals
  const totalAmount = data.lines.reduce((sum, l) => sum + l.amount_ttc, 0)
  const totalVat = data.lines.reduce((sum, l) => sum + l.amount_vat, 0)

  // Create expense report
  const { data: report, error: reportError } = await supabase
    .from('expense_reports')
    .insert({
      company_id: COMPANY_ID,
      user_id: data.userId || null,
      number,
      date: data.date,
      status: 'draft',
      total_amount: totalAmount,
      total_vat: totalVat,
      notes: data.notes || null,
    })
    .select()
    .single()

  if (reportError) {
    console.error('Error creating expense report:', reportError)
    throw new Error(`Erreur création note de frais: ${reportError.message}`)
  }

  // Create expense lines - resolve category codes from DB
  const linesToInsert = await Promise.all(data.lines.map(async line => ({
    expense_report_id: report.id,
    date: line.date,
    description: line.description,
    category: line.category,
    amount_ht: line.amount_ht,
    amount_vat: line.amount_vat,
    amount_ttc: line.amount_ttc,
    vat_rate: parseFloat(line.vat_rate),
    accounting_code: line.accounting_code || await resolveExpenseCategoryCode(line.category),
    receipt_url: line.receipt_url || null,
  })))

  const { error: linesError } = await supabase
    .from('expense_report_lines')
    .insert(linesToInsert)

  if (linesError) {
    console.error('Error creating expense lines:', linesError)
    // Rollback: delete the report
    await supabase.from('expense_reports').delete().eq('id', report.id)
    throw new Error(`Erreur création lignes de frais: ${linesError.message}`)
  }

  console.log(`Created expense report ${number} with ${data.lines.length} lines`)
  return report
}

/**
 * Add a line to an existing expense report
 */
export async function addExpenseLine(
  reportId: string,
  line: Omit<ExpenseReportLine, 'id' | 'expense_report_id' | 'created_at'>
): Promise<ExpenseReportLine> {
  // Verify report exists and is in draft status
  const { data: report, error: fetchError } = await supabase
    .from('expense_reports')
    .select('status')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError || !report) {
    throw new Error(`Note de frais non trouvée: ${fetchError?.message}`)
  }

  if (report.status !== 'draft') {
    throw new Error('Impossible de modifier une note de frais qui n\'est plus en brouillon')
  }

  // Validate line
  if (!line.date) {
    throw new Error('La date est requise')
  }
  if (!line.description) {
    throw new Error('La description est requise')
  }
  if (line.amount_ttc <= 0) {
    throw new Error('Le montant TTC doit être supérieur à 0')
  }

  // Insert line
  const { data: newLine, error: insertError } = await supabase
    .from('expense_report_lines')
    .insert({
      expense_report_id: reportId,
      date: line.date,
      description: line.description,
      category: line.category,
      amount_ht: line.amount_ht,
      amount_vat: line.amount_vat,
      amount_ttc: line.amount_ttc,
      vat_rate: parseFloat(line.vat_rate),
      accounting_code: line.accounting_code || await resolveExpenseCategoryCode(line.category),
      receipt_url: line.receipt_url || null,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error adding expense line:', insertError)
    throw new Error(`Erreur ajout ligne de frais: ${insertError.message}`)
  }

  // Update totals
  await recalculateReportTotals(reportId)

  console.log(`Added line to expense report ${reportId}`)
  return newLine
}

/**
 * Delete an expense line
 */
export async function deleteExpenseLine(lineId: string): Promise<void> {
  // Get the line to find report ID
  const { data: line, error: fetchError } = await supabase
    .from('expense_report_lines')
    .select('expense_report_id')
    .eq('id', lineId)
    .single()

  if (fetchError || !line) {
    throw new Error(`Ligne de frais non trouvée: ${fetchError?.message}`)
  }

  // Verify report is in draft status
  const { data: report, error: reportError } = await supabase
    .from('expense_reports')
    .select('status')
    .eq('id', line.expense_report_id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (reportError || !report) {
    throw new Error(`Note de frais non trouvée: ${reportError?.message}`)
  }

  if (report.status !== 'draft') {
    throw new Error('Impossible de modifier une note de frais qui n\'est plus en brouillon')
  }

  // Delete line
  const { error: deleteError } = await supabase
    .from('expense_report_lines')
    .delete()
    .eq('id', lineId)

  if (deleteError) {
    console.error('Error deleting expense line:', deleteError)
    throw new Error(`Erreur suppression ligne de frais: ${deleteError.message}`)
  }

  // Update totals
  await recalculateReportTotals(line.expense_report_id)

  console.log(`Deleted expense line ${lineId}`)
}

/**
 * Recalculate report totals from lines
 */
async function recalculateReportTotals(reportId: string): Promise<void> {
  const { data: lines, error: fetchError } = await supabase
    .from('expense_report_lines')
    .select('amount_ttc, amount_vat')
    .eq('expense_report_id', reportId)

  if (fetchError) {
    console.error('Error fetching lines for recalculation:', fetchError)
    throw new Error(`Erreur recalcul totaux: ${fetchError.message}`)
  }

  const totalAmount = (lines || []).reduce((sum, l) => sum + Number(l.amount_ttc), 0)
  const totalVat = (lines || []).reduce((sum, l) => sum + Number(l.amount_vat), 0)

  const { error: updateError } = await supabase
    .from('expense_reports')
    .update({
      total_amount: totalAmount,
      total_vat: totalVat,
    })
    .eq('id', reportId)

  if (updateError) {
    console.error('Error updating report totals:', updateError)
    throw new Error(`Erreur mise à jour totaux: ${updateError.message}`)
  }
}

// ============ Status Workflow ============

/**
 * Submit expense report for approval
 * Transition: draft → submitted
 */
export async function submitForApproval(reportId: string): Promise<ExpenseReport> {
  const { data: report, error: fetchError } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError || !report) {
    throw new Error(`Note de frais non trouvée: ${fetchError?.message}`)
  }

  if (report.status !== 'draft') {
    throw new Error('Seule une note de frais en brouillon peut être soumise')
  }

  // Verify has at least one line
  const { count, error: countError } = await supabase
    .from('expense_report_lines')
    .select('*', { count: 'exact', head: true })
    .eq('expense_report_id', reportId)

  if (countError) {
    throw new Error(`Erreur vérification lignes: ${countError.message}`)
  }

  if (!count || count === 0) {
    throw new Error('La note de frais doit contenir au moins une ligne')
  }

  const { data: updated, error: updateError } = await supabase
    .from('expense_reports')
    .update({ status: 'submitted' })
    .eq('id', reportId)
    .select()
    .single()

  if (updateError) {
    console.error('Error submitting expense report:', updateError)
    throw new Error(`Erreur soumission note de frais: ${updateError.message}`)
  }

  console.log(`Expense report ${report.number} submitted for approval`)
  return updated
}

/**
 * Approve expense report
 * Transition: submitted → approved
 */
export async function approveExpenseReport(
  reportId: string,
  approverId: string
): Promise<ExpenseReport> {
  const { data: report, error: fetchError } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError || !report) {
    throw new Error(`Note de frais non trouvée: ${fetchError?.message}`)
  }

  if (report.status !== 'submitted') {
    throw new Error('Seule une note de frais soumise peut être approuvée')
  }

  const { data: updated, error: updateError } = await supabase
    .from('expense_reports')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select()
    .single()

  if (updateError) {
    console.error('Error approving expense report:', updateError)
    throw new Error(`Erreur approbation note de frais: ${updateError.message}`)
  }

  console.log(`Expense report ${report.number} approved by ${approverId}`)
  return updated
}

/**
 * Reject expense report
 * Transition: submitted → rejected
 */
export async function rejectExpenseReport(
  reportId: string,
  reason: string
): Promise<ExpenseReport> {
  if (!reason || reason.trim() === '') {
    throw new Error('Un motif de rejet est requis')
  }

  const { data: report, error: fetchError } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError || !report) {
    throw new Error(`Note de frais non trouvée: ${fetchError?.message}`)
  }

  if (report.status !== 'submitted') {
    throw new Error('Seule une note de frais soumise peut être rejetée')
  }

  const { data: updated, error: updateError } = await supabase
    .from('expense_reports')
    .update({
      status: 'rejected',
      notes: `${report.notes || ''}\n[REJET] ${reason}`.trim(),
    })
    .eq('id', reportId)
    .select()
    .single()

  if (updateError) {
    console.error('Error rejecting expense report:', updateError)
    throw new Error(`Erreur rejet note de frais: ${updateError.message}`)
  }

  console.log(`Expense report ${report.number} rejected: ${reason}`)
  return updated
}

/**
 * Mark expense report as paid and generate accounting entries
 * Transition: approved → paid
 */
export async function markAsPaid(
  reportId: string,
  paymentDate: string,
  bankAccountCode: string = '512000'
): Promise<ExpenseReport> {
  const { data: report, error: fetchError } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError || !report) {
    throw new Error(`Note de frais non trouvée: ${fetchError?.message}`)
  }

  if (report.status !== 'approved') {
    throw new Error('Seule une note de frais approuvée peut être remboursée')
  }

  // Generate payment entries (421 → 512)
  await generatePaymentEntries(reportId, paymentDate, bankAccountCode)

  // Update status
  const { data: updated, error: updateError } = await supabase
    .from('expense_reports')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select()
    .single()

  if (updateError) {
    console.error('Error marking expense report as paid:', updateError)
    throw new Error(`Erreur remboursement note de frais: ${updateError.message}`)
  }

  console.log(`Expense report ${report.number} marked as paid`)
  return updated
}

// ============ Accounting Entries ============

/**
 * Generate accounting entries for expense report (charges + TVA + 421)
 * Called when report is approved
 *
 * Entries for each line:
 *   Debit  6xxx (charge)        = HT
 *   Debit  44566 (TVA déduct.)  = TVA (if > 0)
 *   Credit 421 (Personnel dû)   = TTC
 */
export async function generateExpenseEntries(reportId: string): Promise<AccountingEntry[]> {
  // Get report with lines
  const { report, lines } = await getExpenseReportWithLines(reportId)

  if (report.status !== 'approved' && report.status !== 'paid') {
    throw new Error('La note de frais doit être approuvée pour générer les écritures')
  }

  // Resolve journal and accounts from DB
  const chartOfAccounts = await loadChartOfAccounts()
  const journalOD = await resolveJournal('misc')
  const tvaDeductible = resolveByRole('TVA_DEDUCTIBLE_ABS', chartOfAccounts)
  const personnelDu = resolveByRole('PERSONNEL_DU', chartOfAccounts)

  const pieceNumber = await generatePieceNumber(journalOD.code)
  const entries: Partial<AccountingEntry>[] = []

  // Group lines by accounting code to optimize entries
  const linesByAccount = new Map<string, { totalHT: number; totalVAT: number }>()

  for (const line of lines) {
    const accountCode = line.accounting_code || await resolveExpenseCategoryCode(line.category)
    const existing = linesByAccount.get(accountCode) || { totalHT: 0, totalVAT: 0 }
    existing.totalHT += Number(line.amount_ht)
    existing.totalVAT += Number(line.amount_vat)
    linesByAccount.set(accountCode, existing)
  }

  const label = `Note de frais ${report.number}`
  const date = report.date

  // Create charge entries (one per account code)
  for (const [accountCode, totals] of linesByAccount) {
    // Debit charge account (6xxx) = HT
    entries.push({
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date,
      piece_number: pieceNumber,
      label,
      account_code: accountCode,
      debit: totals.totalHT,
      credit: 0,
      is_validated: false,
    })

    // Debit TVA déductible = TVA (if > 0)
    if (totals.totalVAT > 0) {
      entries.push({
        company_id: COMPANY_ID,
        journal: journalOD.code,
        date,
        piece_number: pieceNumber,
        label,
        account_code: tvaDeductible.code,
        debit: totals.totalVAT,
        credit: 0,
        is_validated: false,
      })
    }
  }

  // Credit personnel account = TTC
  entries.push({
    company_id: COMPANY_ID,
    journal: journalOD.code,
    date,
    piece_number: pieceNumber,
    label,
    account_code: personnelDu.code,
    debit: 0,
    credit: Number(report.total_amount),
    is_validated: false,
  })

  // Insert entries
  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating expense entries:', error)
    throw new Error(`Erreur création écritures comptables: ${error.message}`)
  }

  console.log(`Created ${data.length} accounting entries for expense report ${report.number}`)
  return data
}

/**
 * Generate payment entries when expense report is paid
 *
 * Payment entries:
 *   Debit  421 (Personnel dû)  = TTC
 *   Credit 512 (Banque)        = TTC
 */
async function generatePaymentEntries(
  reportId: string,
  paymentDate: string,
  bankAccountCode: string
): Promise<AccountingEntry[]> {
  const { report } = await getExpenseReportWithLines(reportId)

  // Resolve journal and accounts from DB
  const chartOfAccounts = await loadChartOfAccounts()
  const journalBanque = await resolveJournal('bank')
  const personnelDu = resolveByRole('PERSONNEL_DU', chartOfAccounts)

  const pieceNumber = await generatePieceNumber(journalBanque.code)
  const label = `Remboursement ${report.number}`

  const entries: Partial<AccountingEntry>[] = [
    // Debit personnel account = TTC
    {
      company_id: COMPANY_ID,
      journal: journalBanque.code,
      date: paymentDate,
      piece_number: pieceNumber,
      label,
      account_code: personnelDu.code,
      debit: Number(report.total_amount),
      credit: 0,
      is_validated: false,
    },
    // Credit bank account (512) = TTC
    {
      company_id: COMPANY_ID,
      journal: journalBanque.code,
      date: paymentDate,
      piece_number: pieceNumber,
      label,
      account_code: bankAccountCode,
      debit: 0,
      credit: Number(report.total_amount),
      is_validated: false,
    },
  ]

  const { data, error } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error creating payment entries:', error)
    throw new Error(`Erreur création écritures de remboursement: ${error.message}`)
  }

  console.log(`Created ${data.length} payment entries for expense report ${report.number}`)
  return data
}

// ============ Queries ============

/**
 * Get list of expense reports with optional filters
 */
export async function getExpenseReports(filters?: {
  status?: string
  startDate?: string
  endDate?: string
  userId?: string
}): Promise<ExpenseReport[]> {
  let query = supabase
    .from('expense_reports')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate)
  }

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching expense reports:', error)
    throw new Error(`Erreur chargement notes de frais: ${error.message}`)
  }

  if (!data) {
    console.error('listExpenseReports: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour expense reports')
  }

  return data
}

/**
 * Get expense report with its lines
 */
export async function getExpenseReportWithLines(
  reportId: string
): Promise<{ report: ExpenseReport; lines: ExpenseReportLine[] }> {
  // Get report
  const { data: report, error: reportError } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (reportError || !report) {
    throw new Error(`Note de frais non trouvée: ${reportError?.message}`)
  }

  // Get lines
  const { data: lines, error: linesError } = await supabase
    .from('expense_report_lines')
    .select('*')
    .eq('expense_report_id', reportId)
    .order('date', { ascending: true })

  if (linesError) {
    console.error('Error fetching expense lines:', linesError)
    throw new Error(`Erreur chargement lignes de frais: ${linesError.message}`)
  }

  if (!lines) {
    console.error('getExpenseReportWithLines: lines is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour expense report lines')
  }

  return { report, lines }
}

/**
 * Delete an expense report (only if in draft status)
 */
export async function deleteExpenseReport(reportId: string): Promise<void> {
  const { data: report, error: fetchError } = await supabase
    .from('expense_reports')
    .select('status, number')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError || !report) {
    throw new Error(`Note de frais non trouvée: ${fetchError?.message}`)
  }

  if (report.status !== 'draft') {
    throw new Error('Seule une note de frais en brouillon peut être supprimée')
  }

  // Delete lines first (cascade should handle this but let's be explicit)
  const { error: linesDeleteError } = await supabase
    .from('expense_report_lines')
    .delete()
    .eq('expense_report_id', reportId)

  if (linesDeleteError) {
    console.error('Error deleting expense lines:', linesDeleteError)
    throw new Error(`Erreur suppression lignes: ${linesDeleteError.message}`)
  }

  // Delete report
  const { error: reportDeleteError } = await supabase
    .from('expense_reports')
    .delete()
    .eq('id', reportId)

  if (reportDeleteError) {
    console.error('Error deleting expense report:', reportDeleteError)
    throw new Error(`Erreur suppression note de frais: ${reportDeleteError.message}`)
  }

  console.log(`Deleted expense report ${report.number}`)
}

/**
 * Revert rejected report to draft for modification
 * Transition: rejected → draft
 */
export async function revertToDraft(reportId: string): Promise<ExpenseReport> {
  const { data: report, error: fetchError } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('id', reportId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (fetchError || !report) {
    throw new Error(`Note de frais non trouvée: ${fetchError?.message}`)
  }

  if (report.status !== 'rejected') {
    throw new Error('Seule une note de frais rejetée peut être remise en brouillon')
  }

  const { data: updated, error: updateError } = await supabase
    .from('expense_reports')
    .update({
      status: 'draft',
    })
    .eq('id', reportId)
    .select()
    .single()

  if (updateError) {
    console.error('Error reverting expense report to draft:', updateError)
    throw new Error(`Erreur modification statut: ${updateError.message}`)
  }

  console.log(`Expense report ${report.number} reverted to draft`)
  return updated
}

/**
 * Upload receipt document to Supabase Storage
 */
export async function uploadReceipt(
  file: File,
  reportId: string,
  lineIndex: number
): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${COMPANY_ID}/expense-receipts/${reportId}_${lineIndex}_${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Error uploading receipt:', uploadError)
    throw new Error(`Erreur upload justificatif: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName)

  console.log(`Receipt uploaded: ${urlData.publicUrl}`)
  return urlData.publicUrl
}
