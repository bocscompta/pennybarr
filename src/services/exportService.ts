// Export Service - PDF, CSV, FEC exports for accounting data
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { AccountingEntry } from '../types/database'
import type { jsPDF as JsPDFType } from 'jspdf'

// ============ Types ============

export interface ExportFilters {
  startDate?: string
  endDate?: string
  journal?: string
  accountCode?: string
}

export type ExportType = 'balance' | 'grandlivre' | 'journal'

interface BalanceRow {
  accountCode: string
  accountLabel: string
  debitMovement: number
  creditMovement: number
  debitBalance: number
  creditBalance: number
}

interface GrandLivreRow {
  date: string
  pieceNumber: string
  journal: string
  label: string
  debit: number
  credit: number
  balance: number
}

interface JournalRow {
  date: string
  pieceNumber: string
  accountCode: string
  accountLabel: string
  label: string
  debit: number
  credit: number
}

interface FECRow {
  JournalCode: string
  JournalLib: string
  EcritureNum: string
  EcritureDate: string
  CompteNum: string
  CompteLib: string
  CompAuxNum: string
  CompAuxLib: string
  PieceRef: string
  PieceDate: string
  EcritureLib: string
  Debit: string
  Credit: string
  EcritureLet: string
  DateLet: string
  ValidDate: string
  Montantdevise: string
  Idevise: string
}

// ============ Data Fetching ============

async function getFilteredEntries(filters: ExportFilters): Promise<AccountingEntry[]> {
  let query = supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: true })
    .order('piece_number', { ascending: true })
    .order('account_code', { ascending: true })

  if (filters.startDate) {
    query = query.gte('date', filters.startDate)
  }

  if (filters.endDate) {
    query = query.lte('date', filters.endDate)
  }

  if (filters.journal) {
    query = query.eq('journal', filters.journal)
  }

  if (filters.accountCode) {
    query = query.eq('account_code', filters.accountCode)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching entries for export:', error)
    throw new Error(`Erreur chargement ecritures: ${error.message}`)
  }

  if (!data) {
    console.error('getEntriesForExport: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour accounting entries')
  }

  return data
}

async function getChartOfAccounts(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('code, label')
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error fetching chart of accounts:', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }

  const map = new Map<string, string>()
  data?.forEach(account => {
    map.set(account.code, account.label)
  })
  return map
}

async function getJournals(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('accounting_journals')
    .select('code, label')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching journals from accounting_journals:', error)
    throw new Error(`Erreur chargement journaux: ${error.message}`)
  }

  if (!data) {
    console.error('getJournals: data is null')
    throw new Error('Erreur inattendue: données manquantes pour les journaux')
  }

  const map = new Map<string, string>()
  data.forEach(journal => {
    map.set(journal.code, journal.label)
  })
  return map
}

async function getCompanyInfo(): Promise<{ name: string; siren?: string; siret?: string }> {
  const { data, error } = await supabase
    .from('companies')
    .select('name, siren, siret')
    .eq('id', COMPANY_ID)
    .single()

  if (error) {
    console.error('Error fetching company info:', error)
    throw new Error(`Erreur chargement entreprise: ${error.message}`)
  }

  return data
}

// ============ Balance Data Preparation ============

function prepareBalanceData(entries: AccountingEntry[], accountLabels: Map<string, string>): BalanceRow[] {
  // Group entries by account code
  const accountBalances = new Map<string, { debit: number; credit: number }>()

  for (const entry of entries) {
    const existing = accountBalances.get(entry.account_code) || { debit: 0, credit: 0 }
    existing.debit += entry.debit || 0
    existing.credit += entry.credit || 0
    accountBalances.set(entry.account_code, existing)
  }

  // Convert to balance rows sorted by account code
  const rows: BalanceRow[] = []
  const sortedCodes = Array.from(accountBalances.keys()).sort()

  for (const code of sortedCodes) {
    const balance = accountBalances.get(code)!
    const solde = balance.debit - balance.credit
    rows.push({
      accountCode: code,
      accountLabel: accountLabels.get(code) || getDefaultAccountLabel(code),
      debitMovement: balance.debit,
      creditMovement: balance.credit,
      debitBalance: solde > 0 ? solde : 0,
      creditBalance: solde < 0 ? Math.abs(solde) : 0,
    })
  }

  return rows
}

// ============ Grand Livre Data Preparation ============

function prepareGrandLivreData(entries: AccountingEntry[], accountCode: string, accountLabels: Map<string, string>): {
  accountLabel: string
  rows: GrandLivreRow[]
  totalDebit: number
  totalCredit: number
} {
  const filteredEntries = accountCode
    ? entries.filter(e => e.account_code === accountCode)
    : entries

  // Group by account if no specific account filter
  if (!accountCode) {
    // Return all entries grouped by account
    const rows: GrandLivreRow[] = []
    let runningBalance = 0
    let totalDebit = 0
    let totalCredit = 0

    for (const entry of filteredEntries) {
      const debit = entry.debit || 0
      const credit = entry.credit || 0
      runningBalance += debit - credit
      totalDebit += debit
      totalCredit += credit

      rows.push({
        date: entry.date,
        pieceNumber: entry.piece_number || '',
        journal: entry.journal,
        label: entry.label,
        debit,
        credit,
        balance: runningBalance,
      })
    }

    return {
      accountLabel: 'Tous les comptes',
      rows,
      totalDebit,
      totalCredit,
    }
  }

  // Specific account
  const rows: GrandLivreRow[] = []
  let runningBalance = 0
  let totalDebit = 0
  let totalCredit = 0

  for (const entry of filteredEntries) {
    const debit = entry.debit || 0
    const credit = entry.credit || 0
    runningBalance += debit - credit
    totalDebit += debit
    totalCredit += credit

    rows.push({
      date: entry.date,
      pieceNumber: entry.piece_number || '',
      journal: entry.journal,
      label: entry.label,
      debit,
      credit,
      balance: runningBalance,
    })
  }

  return {
    accountLabel: accountLabels.get(accountCode) || getDefaultAccountLabel(accountCode),
    rows,
    totalDebit,
    totalCredit,
  }
}

// ============ Journal Data Preparation ============

function prepareJournalData(entries: AccountingEntry[], accountLabels: Map<string, string>): {
  rows: JournalRow[]
  totalDebit: number
  totalCredit: number
} {
  const rows: JournalRow[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const entry of entries) {
    const debit = entry.debit || 0
    const credit = entry.credit || 0
    totalDebit += debit
    totalCredit += credit

    rows.push({
      date: entry.date,
      pieceNumber: entry.piece_number || '',
      accountCode: entry.account_code,
      accountLabel: accountLabels.get(entry.account_code) || getDefaultAccountLabel(entry.account_code),
      label: entry.label,
      debit,
      credit,
    })
  }

  return { rows, totalDebit, totalCredit }
}

// ============ Helper Functions ============

function getDefaultAccountLabel(code: string): string {
  // Generic labels based on PCG class prefix (no hardcoded account codes)
  if (code.startsWith('401')) return 'Fournisseur'
  if (code.startsWith('411')) return 'Client'
  if (code.startsWith('512')) return 'Banque'
  if (code.startsWith('1')) return 'Capitaux'
  if (code.startsWith('2')) return 'Immobilisations'
  if (code.startsWith('3')) return 'Stocks'
  if (code.startsWith('4')) return 'Tiers'
  if (code.startsWith('5')) return 'Financier'
  if (code.startsWith('6')) return 'Charges'
  if (code.startsWith('7')) return 'Produits'
  return code
}

function formatDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR')
}

function formatDateFEC(date: string): string {
  // FEC format: YYYYMMDD
  return date.replace(/-/g, '')
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatAmountFEC(amount: number): string {
  // FEC format: comma as decimal separator, no thousands separator
  return amount.toFixed(2).replace('.', ',')
}

function getPeriodLabel(filters: ExportFilters): string {
  if (filters.startDate && filters.endDate) {
    return `Du ${formatDate(filters.startDate)} au ${formatDate(filters.endDate)}`
  } else if (filters.startDate) {
    return `A partir du ${formatDate(filters.startDate)}`
  } else if (filters.endDate) {
    return `Jusqu'au ${formatDate(filters.endDate)}`
  }
  return 'Toutes periodes'
}

// ============ PDF Export ============

export async function exportToPDF(type: ExportType, filters: ExportFilters): Promise<void> {
  // Dynamic imports for code splitting - jsPDF is ~400kB
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const entries = await getFilteredEntries(filters)
  const accountLabels = await getChartOfAccounts()
  const journalLabels = await getJournals()
  const company = await getCompanyInfo()

  if (entries.length === 0) {
    throw new Error('Aucune ecriture a exporter pour cette periode')
  }

  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')

  let title: string
  switch (type) {
    case 'balance':
      title = 'Balance Generale'
      break
    case 'grandlivre':
      title = 'Grand Livre'
      break
    case 'journal':
      title = 'Journal Comptable'
      break
  }

  doc.text(title, margin, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(company.name, margin, 28)
  doc.text(getPeriodLabel(filters), margin, 34)

  // Date d'edition
  const today = new Date().toLocaleDateString('fr-FR')
  doc.setFontSize(8)
  doc.text(`Edition le ${today}`, pageWidth - margin - 30, 20)

  const startY = 45

  switch (type) {
    case 'balance':
      generateBalancePDF(doc, entries, accountLabels, startY, autoTable)
      break
    case 'grandlivre':
      generateGrandLivrePDF(doc, entries, accountLabels, filters, startY, autoTable)
      break
    case 'journal':
      generateJournalPDF(doc, entries, accountLabels, journalLabels, filters, startY, autoTable)
      break
  }

  // Download
  const filename = `${type}_${filters.startDate || 'all'}_${filters.endDate || 'all'}.pdf`
  doc.save(filename)
}

function generateBalancePDF(
  doc: JsPDFType,
  entries: AccountingEntry[],
  accountLabels: Map<string, string>,
  startY: number,
  autoTable: typeof import('jspdf-autotable').default
): void {
  const balanceData = prepareBalanceData(entries, accountLabels)

  // Calculate totals
  const totals = balanceData.reduce(
    (acc, row) => ({
      debitMovement: acc.debitMovement + row.debitMovement,
      creditMovement: acc.creditMovement + row.creditMovement,
      debitBalance: acc.debitBalance + row.debitBalance,
      creditBalance: acc.creditBalance + row.creditBalance,
    }),
    { debitMovement: 0, creditMovement: 0, debitBalance: 0, creditBalance: 0 }
  )

  const tableData = balanceData.map(row => [
    row.accountCode,
    row.accountLabel,
    formatAmount(row.debitMovement),
    formatAmount(row.creditMovement),
    formatAmount(row.debitBalance),
    formatAmount(row.creditBalance),
  ])

  // Add totals row
  tableData.push([
    '',
    'TOTAUX',
    formatAmount(totals.debitMovement),
    formatAmount(totals.creditMovement),
    formatAmount(totals.debitBalance),
    formatAmount(totals.creditBalance),
  ])

  autoTable(doc, {
    startY,
    head: [['Compte', 'Libelle', 'Mouvement Debit', 'Mouvement Credit', 'Solde Debiteur', 'Solde Crediteur']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 50 },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (data) => {
      // Bold totals row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
}

function generateGrandLivrePDF(
  doc: JsPDFType,
  entries: AccountingEntry[],
  accountLabels: Map<string, string>,
  filters: ExportFilters,
  startY: number,
  autoTable: typeof import('jspdf-autotable').default
): void {
  const { accountLabel, rows, totalDebit, totalCredit } = prepareGrandLivreData(
    entries,
    filters.accountCode || '',
    accountLabels
  )

  if (filters.accountCode) {
    doc.setFontSize(10)
    doc.text(`Compte: ${filters.accountCode} - ${accountLabel}`, 15, startY - 5)
    startY += 5
  }

  const tableData = rows.map(row => [
    formatDate(row.date),
    row.pieceNumber,
    row.journal,
    row.label,
    row.debit > 0 ? formatAmount(row.debit) : '',
    row.credit > 0 ? formatAmount(row.credit) : '',
    formatAmount(row.balance),
  ])

  // Add totals row
  tableData.push([
    '',
    '',
    '',
    'TOTAUX',
    formatAmount(totalDebit),
    formatAmount(totalCredit),
    formatAmount(totalDebit - totalCredit),
  ])

  autoTable(doc, {
    startY,
    head: [['Date', 'Piece', 'Journal', 'Libelle', 'Debit', 'Credit', 'Solde']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 15 },
      3: { cellWidth: 55 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 22 },
    },
    didParseCell: (data) => {
      // Bold totals row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
}

function generateJournalPDF(
  doc: JsPDFType,
  entries: AccountingEntry[],
  accountLabels: Map<string, string>,
  journalLabels: Map<string, string>,
  filters: ExportFilters,
  startY: number,
  autoTable: typeof import('jspdf-autotable').default
): void {
  if (filters.journal) {
    const journalName = journalLabels.get(filters.journal) || filters.journal
    doc.setFontSize(10)
    doc.text(`Journal: ${filters.journal} - ${journalName}`, 15, startY - 5)
    startY += 5
  }

  const { rows, totalDebit, totalCredit } = prepareJournalData(entries, accountLabels)

  const tableData = rows.map(row => [
    formatDate(row.date),
    row.pieceNumber,
    row.accountCode,
    row.accountLabel,
    row.label,
    row.debit > 0 ? formatAmount(row.debit) : '',
    row.credit > 0 ? formatAmount(row.credit) : '',
  ])

  // Add totals row
  tableData.push([
    '',
    '',
    '',
    '',
    'TOTAUX',
    formatAmount(totalDebit),
    formatAmount(totalCredit),
  ])

  autoTable(doc, {
    startY,
    head: [['Date', 'Piece', 'Compte', 'Libelle Compte', 'Libelle', 'Debit', 'Credit']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 25 },
      2: { cellWidth: 18 },
      3: { cellWidth: 35 },
      4: { cellWidth: 45 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 22 },
    },
    didParseCell: (data) => {
      // Bold totals row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
}

// ============ CSV Export ============

export async function exportToCSV(type: ExportType, filters: ExportFilters): Promise<void> {
  const entries = await getFilteredEntries(filters)
  const accountLabels = await getChartOfAccounts()
  // Journal labels loaded but not currently used - could be added for enhanced CSV export
  await getJournals()

  if (entries.length === 0) {
    throw new Error('Aucune ecriture a exporter pour cette periode')
  }

  let csvContent: string
  let filename: string

  switch (type) {
    case 'balance':
      csvContent = generateBalanceCSV(entries, accountLabels)
      filename = 'balance'
      break
    case 'grandlivre':
      csvContent = generateGrandLivreCSV(entries, accountLabels, filters)
      filename = 'grand_livre'
      break
    case 'journal':
      csvContent = generateJournalCSV(entries, accountLabels)
      filename = 'journal'
      break
  }

  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${filters.startDate || 'all'}_${filters.endDate || 'all'}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function generateBalanceCSV(entries: AccountingEntry[], accountLabels: Map<string, string>): string {
  const balanceData = prepareBalanceData(entries, accountLabels)

  const headers = ['Compte', 'Libelle', 'Mouvement Debit', 'Mouvement Credit', 'Solde Debiteur', 'Solde Crediteur']
  const rows = balanceData.map(row => [
    row.accountCode,
    `"${row.accountLabel}"`,
    formatAmount(row.debitMovement),
    formatAmount(row.creditMovement),
    formatAmount(row.debitBalance),
    formatAmount(row.creditBalance),
  ])

  // Add totals
  const totals = balanceData.reduce(
    (acc, row) => ({
      debitMovement: acc.debitMovement + row.debitMovement,
      creditMovement: acc.creditMovement + row.creditMovement,
      debitBalance: acc.debitBalance + row.debitBalance,
      creditBalance: acc.creditBalance + row.creditBalance,
    }),
    { debitMovement: 0, creditMovement: 0, debitBalance: 0, creditBalance: 0 }
  )

  rows.push([
    '',
    'TOTAUX',
    formatAmount(totals.debitMovement),
    formatAmount(totals.creditMovement),
    formatAmount(totals.debitBalance),
    formatAmount(totals.creditBalance),
  ])

  return [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n')
}

function generateGrandLivreCSV(entries: AccountingEntry[], accountLabels: Map<string, string>, filters: ExportFilters): string {
  const { rows, totalDebit, totalCredit } = prepareGrandLivreData(entries, filters.accountCode || '', accountLabels)

  const headers = ['Date', 'Piece', 'Journal', 'Libelle', 'Debit', 'Credit', 'Solde']
  const csvRows = rows.map(row => [
    formatDate(row.date),
    row.pieceNumber,
    row.journal,
    `"${row.label}"`,
    formatAmount(row.debit),
    formatAmount(row.credit),
    formatAmount(row.balance),
  ])

  // Add totals
  csvRows.push([
    '',
    '',
    '',
    'TOTAUX',
    formatAmount(totalDebit),
    formatAmount(totalCredit),
    formatAmount(totalDebit - totalCredit),
  ])

  return [headers.join(';'), ...csvRows.map(row => row.join(';'))].join('\r\n')
}

function generateJournalCSV(entries: AccountingEntry[], accountLabels: Map<string, string>): string {
  const { rows, totalDebit, totalCredit } = prepareJournalData(entries, accountLabels)

  const headers = ['Date', 'Piece', 'Compte', 'Libelle Compte', 'Libelle', 'Debit', 'Credit']
  const csvRows = rows.map(row => [
    formatDate(row.date),
    row.pieceNumber,
    row.accountCode,
    `"${row.accountLabel}"`,
    `"${row.label}"`,
    formatAmount(row.debit),
    formatAmount(row.credit),
  ])

  // Add totals
  csvRows.push([
    '',
    '',
    '',
    '',
    'TOTAUX',
    formatAmount(totalDebit),
    formatAmount(totalCredit),
  ])

  return [headers.join(';'), ...csvRows.map(row => row.join(';'))].join('\r\n')
}

// ============ FEC Export ============

/**
 * Export to FEC (Fichier des Ecritures Comptables) format
 * French DGFiP standard format for accounting data
 * Tab-separated values, ISO-8859-1 encoding spec (we use UTF-8 with BOM)
 */
export async function exportToFEC(fiscalYearStart: string, fiscalYearEnd: string): Promise<void> {
  const entries = await getFilteredEntries({
    startDate: fiscalYearStart,
    endDate: fiscalYearEnd,
  })

  if (entries.length === 0) {
    throw new Error('Aucune ecriture a exporter pour cet exercice')
  }

  const accountLabels = await getChartOfAccounts()
  const journalLabels = await getJournals()
  const company = await getCompanyInfo()

  // Only export validated entries for FEC
  const validatedEntries = entries.filter(e => e.is_validated)
  if (validatedEntries.length === 0) {
    throw new Error('Aucune ecriture validee a exporter. Le FEC ne contient que les ecritures validees.')
  }

  const fecRows: FECRow[] = validatedEntries.map(entry => ({
    JournalCode: entry.journal,
    JournalLib: journalLabels.get(entry.journal) || entry.journal,
    EcritureNum: entry.piece_number || '',
    EcritureDate: formatDateFEC(entry.date),
    CompteNum: entry.account_code,
    CompteLib: accountLabels.get(entry.account_code) || getDefaultAccountLabel(entry.account_code),
    CompAuxNum: getAuxiliaryAccountCode(entry.account_code),
    CompAuxLib: getAuxiliaryAccountLabel(entry.account_code, accountLabels),
    PieceRef: entry.piece_number || '',
    PieceDate: formatDateFEC(entry.date),
    EcritureLib: entry.label,
    Debit: formatAmountFEC(entry.debit || 0),
    Credit: formatAmountFEC(entry.credit || 0),
    EcritureLet: entry.lettrage_code || '',
    DateLet: entry.lettrage_date ? formatDateFEC(entry.lettrage_date.split('T')[0]) : '',
    ValidDate: formatDateFEC(entry.created_at.split('T')[0]),
    Montantdevise: '',
    Idevise: '',
  }))

  // FEC header (standard columns)
  const headers = [
    'JournalCode',
    'JournalLib',
    'EcritureNum',
    'EcritureDate',
    'CompteNum',
    'CompteLib',
    'CompAuxNum',
    'CompAuxLib',
    'PieceRef',
    'PieceDate',
    'EcritureLib',
    'Debit',
    'Credit',
    'EcritureLet',
    'DateLet',
    'ValidDate',
    'Montantdevise',
    'Idevise',
  ]

  const rows = fecRows.map(row => [
    row.JournalCode,
    row.JournalLib,
    row.EcritureNum,
    row.EcritureDate,
    row.CompteNum,
    row.CompteLib,
    row.CompAuxNum,
    row.CompAuxLib,
    row.PieceRef,
    row.PieceDate,
    row.EcritureLib,
    row.Debit,
    row.Credit,
    row.EcritureLet,
    row.DateLet,
    row.ValidDate,
    row.Montantdevise,
    row.Idevise,
  ])

  // Tab-separated content
  const fecContent = [
    headers.join('\t'),
    ...rows.map(row => row.join('\t')),
  ].join('\r\n')

  // Create file with UTF-8 BOM
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + fecContent], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  // FEC filename format: SIRENFECyyyymmdd.txt
  const siren = company.siren || 'XXXXXXXXX'
  const exportDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `${siren}FEC${exportDate}.txt`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Get auxiliary account code (for client/supplier accounts)
 * Only applicable for accounts 401xxx and 411xxx
 */
function getAuxiliaryAccountCode(accountCode: string): string {
  if (accountCode.startsWith('401') || accountCode.startsWith('411')) {
    return accountCode
  }
  return ''
}

/**
 * Get auxiliary account label (for client/supplier accounts)
 */
function getAuxiliaryAccountLabel(accountCode: string, accountLabels: Map<string, string>): string {
  if (accountCode.startsWith('401') || accountCode.startsWith('411')) {
    return accountLabels.get(accountCode) || getDefaultAccountLabel(accountCode)
  }
  return ''
}

// ============ Utility Exports ============

/**
 * Get available export periods (fiscal years)
 */
export async function getAvailableExportPeriods(): Promise<{ startDate: string; endDate: string; label: string }[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('date')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) {
    // Return current fiscal year as default
    const currentYear = new Date().getFullYear()
    return [{
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      label: `Exercice ${currentYear}`,
    }]
  }

  const firstDate = new Date(data[0].date)
  const currentDate = new Date()
  const periods: { startDate: string; endDate: string; label: string }[] = []

  // Generate available fiscal years
  for (let year = firstDate.getFullYear(); year <= currentDate.getFullYear(); year++) {
    periods.push({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      label: `Exercice ${year}`,
    })
  }

  return periods.reverse()
}

/**
 * Get list of available journals for filtering
 */
export async function getAvailableJournals(): Promise<{ code: string; name: string }[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('journal')
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error fetching available journals:', error)
    throw new Error(`Erreur chargement journaux: ${error.message}`)
  }

  // Get unique journal codes
  const uniqueJournals = [...new Set(data?.map(d => d.journal) || [])]
  const journalLabels = await getJournals()

  return uniqueJournals.map(code => ({
    code,
    name: journalLabels.get(code) || code,
  })).sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Get list of accounts with movements for filtering
 */
export async function getAccountsWithMovements(): Promise<{ code: string; label: string }[]> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('account_code')
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error fetching accounts with movements:', error)
    throw new Error(`Erreur chargement comptes: ${error.message}`)
  }

  // Get unique account codes
  const uniqueAccounts = [...new Set(data?.map(d => d.account_code) || [])]
  const accountLabels = await getChartOfAccounts()

  return uniqueAccounts.map(code => ({
    code,
    label: accountLabels.get(code) || getDefaultAccountLabel(code),
  })).sort((a, b) => a.code.localeCompare(b.code))
}
