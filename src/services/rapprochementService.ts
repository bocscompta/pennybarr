/**
 * Rapprochement Bancaire Service (Dolibarr-style)
 *
 * Gere les sessions de rapprochement bancaire avec:
 * - Import de releves (OFX, QIF, CSV)
 * - Matching automatique intelligent (score-based)
 * - Interface 2 colonnes (releve vs ecritures comptables)
 * - Gestion des ecarts
 *
 * Ne pas confondre avec reconciliationService.ts qui gere le rapprochement
 * factures <-> transactions (lettrage tiers).
 */
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { BankReconciliation, BankTransaction, AccountingEntry } from '../types/database'
import { isCFONB120, parseCFONB120 } from './parsers/cfonbParser'

// ============ Types ============

export interface ReconciliationSession {
  reconciliation: BankReconciliation
  matchedTransactions: BankTransaction[]
  unmatchedTransactions: BankTransaction[]
  computedBalance: number
  statementBalance: number
  difference: number
}

export interface ReconciliationSummary {
  id: string
  bankAccountId: string
  bankAccountName: string
  statementDate: string
  statementNumber?: string
  openingBalance: number
  closingBalance: number
  status: 'in_progress' | 'completed'
  matchedCount: number
  unmatchedCount: number
  difference: number
  completedAt?: string
  createdAt: string
}

// ============ BANK STATEMENT IMPORT TYPES ============

export interface ImportedBankLine {
  id: string // Generated UUID
  date: string
  valueDate?: string
  label: string
  amount: number
  reference?: string
  checkNumber?: string
  rawData?: Record<string, unknown>
  // For duplicate detection
  hash?: string
}

export interface ImportPreview {
  lines: ImportedBankLine[]
  duplicates: ImportedBankLine[]
  totalCredits: number
  totalDebits: number
  dateRange: { start: string; end: string }
  format: 'ofx' | 'qif' | 'csv' | 'cfonb'
  fileName: string
}

export interface CSVMappingConfig {
  dateColumn: number
  labelColumn: number
  amountColumn?: number
  debitColumn?: number
  creditColumn?: number
  referenceColumn?: number
  valueDateColumn?: number
  dateFormat: string // 'DD/MM/YYYY', 'YYYY-MM-DD', etc.
  skipRows: number
  delimiter: ',' | ';' | '\t'
  decimalSeparator: '.' | ','
  amountSignConvention: 'signed' | 'debit_credit_columns' | 'debit_negative'
}

// ============ MATCHING TYPES ============

export interface MatchSuggestion {
  bankLineId: string
  bankLine: ImportedBankLine
  entryId: string
  entry: AccountingEntry
  score: number
  confidence: 'high' | 'medium' | 'low'
  matchReasons: string[]
}

export interface MatchedPair {
  id: string
  bankLineId: string
  entryId: string
  matchedAt: string
  colorIndex: number // For visual pairing
  difference?: number // If amounts don't match exactly
}

export interface ReconciliationSessionExtended extends ReconciliationSession {
  statementNumber?: string
  importedLines: ImportedBankLine[]
  unmatchedEntries: AccountingEntry[]
  matchedPairs: MatchedPair[]
  suggestions: MatchSuggestion[]
}

// ============ BANK PRESETS ============

export const BANK_PRESETS: Record<string, { label: string; config: CSVMappingConfig }> = {
  cic: {
    label: 'CIC / Credit Mutuel',
    config: {
      dateColumn: 0,
      labelColumn: 1,
      debitColumn: 2,
      creditColumn: 3,
      dateFormat: 'DD/MM/YYYY',
      skipRows: 1,
      delimiter: ';',
      decimalSeparator: ',',
      amountSignConvention: 'debit_credit_columns',
    },
  },
  bnp: {
    label: 'BNP Paribas',
    config: {
      dateColumn: 0,
      valueDateColumn: 1,
      labelColumn: 2,
      amountColumn: 3,
      dateFormat: 'DD/MM/YYYY',
      skipRows: 1,
      delimiter: ';',
      decimalSeparator: ',',
      amountSignConvention: 'signed',
    },
  },
  sg: {
    label: 'Societe Generale',
    config: {
      dateColumn: 0,
      labelColumn: 2,
      debitColumn: 3,
      creditColumn: 4,
      dateFormat: 'DD/MM/YYYY',
      skipRows: 1,
      delimiter: ';',
      decimalSeparator: ',',
      amountSignConvention: 'debit_credit_columns',
    },
  },
  ca: {
    label: 'Credit Agricole',
    config: {
      dateColumn: 0,
      labelColumn: 1,
      debitColumn: 2,
      creditColumn: 3,
      dateFormat: 'DD/MM/YYYY',
      skipRows: 1,
      delimiter: ';',
      decimalSeparator: ',',
      amountSignConvention: 'debit_credit_columns',
    },
  },
  lbp: {
    label: 'La Banque Postale',
    config: {
      dateColumn: 0,
      labelColumn: 1,
      amountColumn: 2,
      dateFormat: 'DD/MM/YYYY',
      skipRows: 1,
      delimiter: ';',
      decimalSeparator: ',',
      amountSignConvention: 'signed',
    },
  },
  boursorama: {
    label: 'Boursorama',
    config: {
      dateColumn: 0,
      labelColumn: 1,
      amountColumn: 2,
      dateFormat: 'DD/MM/YYYY',
      skipRows: 1,
      delimiter: ';',
      decimalSeparator: ',',
      amountSignConvention: 'signed',
    },
  },
}

// ============ PARSERS - OFX ============

/**
 * Parse OFX (Open Financial Exchange) bank statement
 * Format utilise par la plupart des banques francaises
 */
export function parseOFX(content: string): ImportedBankLine[] {
  const lines: ImportedBankLine[] = []

  // OFX uses SGML-like tags
  // Extract transactions between <STMTTRN> and </STMTTRN>
  const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match

  while ((match = transactionRegex.exec(content)) !== null) {
    const block = match[1]

    // Extract fields
    const getField = (tag: string): string | undefined => {
      const fieldMatch = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i').exec(block)
      return fieldMatch ? fieldMatch[1].trim() : undefined
    }

    const dtPosted = getField('DTPOSTED')
    const trnAmt = getField('TRNAMT')
    const name = getField('NAME')
    const memo = getField('MEMO')
    const checkNum = getField('CHECKNUM')
    const refNum = getField('REFNUM')
    const fitId = getField('FITID')

    if (dtPosted && trnAmt) {
      // Parse OFX date format: YYYYMMDDHHMMSS or YYYYMMDD
      const year = dtPosted.substring(0, 4)
      const month = dtPosted.substring(4, 6)
      const day = dtPosted.substring(6, 8)
      const date = `${year}-${month}-${day}`

      const amount = parseFloat(trnAmt.replace(',', '.'))
      const label = [name, memo].filter(Boolean).join(' - ') || 'Transaction'

      const line: ImportedBankLine = {
        id: crypto.randomUUID(),
        date,
        label,
        amount,
        reference: refNum || fitId,
        checkNumber: checkNum,
        rawData: { dtPosted, trnAmt, name, memo, fitId }
      }

      // Generate hash for duplicate detection
      line.hash = generateLineHash(line)

      lines.push(line)
    }
  }

  return lines.sort((a, b) => a.date.localeCompare(b.date))
}

// ============ PARSERS - QIF ============

/**
 * Parse QIF (Quicken Interchange Format) bank statement
 */
export function parseQIF(content: string): ImportedBankLine[] {
  const lines: ImportedBankLine[] = []

  // QIF transactions start with D (date) and end with ^
  const transactionBlocks = content.split('^').filter(b => b.trim())

  for (const block of transactionBlocks) {
    const blockLines = block.split('\n').map(l => l.trim()).filter(Boolean)

    let date: string | undefined
    let amount: number | undefined
    let payee: string | undefined
    let memo: string | undefined
    let checkNum: string | undefined

    for (const line of blockLines) {
      const code = line[0]
      const value = line.substring(1).trim()

      switch (code) {
        case 'D': // Date
          date = parseQIFDate(value)
          break
        case 'T': // Amount (T for total)
        case 'U': // Amount (U for user)
          amount = parseQIFAmount(value)
          break
        case 'P': // Payee
          payee = value
          break
        case 'M': // Memo
          memo = value
          break
        case 'N': // Check number
          checkNum = value
          break
      }
    }

    if (date && amount !== undefined) {
      const line: ImportedBankLine = {
        id: crypto.randomUUID(),
        date,
        label: payee || memo || 'Transaction',
        amount,
        checkNumber: checkNum
      }
      line.hash = generateLineHash(line)
      lines.push(line)
    }
  }

  return lines.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Parse QIF date format (M/D/YY or M/D'YY or DD/MM/YYYY)
 */
function parseQIFDate(dateStr: string): string {
  // Try different formats
  // M/D/YY or M/D'YY (US format)
  const usMatch = /(\d{1,2})[\/'](\d{1,2})[\/'](\d{2,4})/.exec(dateStr)
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0')
    const day = usMatch[2].padStart(2, '0')
    let year = usMatch[3]
    if (year.length === 2) {
      year = parseInt(year) > 50 ? '19' + year : '20' + year
    }
    return `${year}-${month}-${day}`
  }

  // DD/MM/YYYY (European format)
  const euMatch = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dateStr)
  if (euMatch) {
    return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`
  }

  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  throw new Error(`Format de date QIF non reconnu: ${dateStr}`)
}

/**
 * Parse QIF amount format (can include commas as thousands separator)
 */
function parseQIFAmount(amountStr: string): number {
  // Remove thousands separators and normalize decimal
  const normalized = amountStr
    .replace(/\s/g, '')
    .replace(/,(\d{3})/g, '$1') // Remove comma thousands separator
    .replace(',', '.') // Replace comma decimal with dot

  const amount = parseFloat(normalized)
  if (isNaN(amount)) {
    throw new Error(`Montant QIF non valide: ${amountStr}`)
  }
  return amount
}

// ============ PARSERS - CSV ============

/**
 * Parse CSV bank statement with configurable column mapping
 */
export function parseCSV(
  content: string,
  config: CSVMappingConfig
): ImportedBankLine[] {
  const lines: ImportedBankLine[] = []

  // Split by newlines, handling different line endings
  const rows = content.split(/\r?\n/).filter(r => r.trim())

  // Skip header rows
  const dataRows = rows.slice(config.skipRows)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const columns = parseCSVRow(row, config.delimiter)

    if (columns.length === 0) continue

    try {
      // Extract date
      const dateStr = columns[config.dateColumn]?.trim()
      if (!dateStr) continue
      const date = parseCSVDate(dateStr, config.dateFormat)

      // Extract label
      const label = columns[config.labelColumn]?.trim() || 'Transaction'

      // Extract amount
      let amount: number
      if (config.amountSignConvention === 'debit_credit_columns' &&
          config.debitColumn !== undefined &&
          config.creditColumn !== undefined) {
        const debit = parseCSVAmount(columns[config.debitColumn], config.decimalSeparator)
        const credit = parseCSVAmount(columns[config.creditColumn], config.decimalSeparator)
        amount = credit - debit
      } else if (config.amountColumn !== undefined) {
        amount = parseCSVAmount(columns[config.amountColumn], config.decimalSeparator)
        if (config.amountSignConvention === 'debit_negative') {
          // Amount is already signed correctly
        }
      } else {
        console.error(`CSV row ${i + config.skipRows}: missing amount column config`)
        continue
      }

      // Extract optional fields
      const reference = config.referenceColumn !== undefined
        ? columns[config.referenceColumn]?.trim()
        : undefined
      const valueDate = config.valueDateColumn !== undefined
        ? parseCSVDate(columns[config.valueDateColumn]?.trim(), config.dateFormat)
        : undefined

      const line: ImportedBankLine = {
        id: crypto.randomUUID(),
        date,
        valueDate,
        label,
        amount,
        reference,
        rawData: { rowIndex: i, columns }
      }
      line.hash = generateLineHash(line)

      lines.push(line)
    } catch (e) {
      console.error(`Erreur parsing CSV ligne ${i + config.skipRows + 1}:`, e)
      // Continue to next row
    }
  }

  return lines.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Parse a CSV row handling quoted fields
 */
function parseCSVRow(row: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    const nextChar = row[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  result.push(current)
  return result
}

/**
 * Parse CSV date with format string
 */
function parseCSVDate(dateStr: string, format: string): string {
  if (!dateStr) throw new Error('Date vide')

  const cleaned = dateStr.trim()

  // Handle common formats
  if (format === 'DD/MM/YYYY') {
    const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(cleaned)
    if (match) return `${match[3]}-${match[2]}-${match[1]}`
  }

  if (format === 'DD-MM-YYYY') {
    const match = /(\d{2})-(\d{2})-(\d{4})/.exec(cleaned)
    if (match) return `${match[3]}-${match[2]}-${match[1]}`
  }

  if (format === 'YYYY-MM-DD') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  }

  if (format === 'DD.MM.YYYY') {
    const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(cleaned)
    if (match) return `${match[3]}-${match[2]}-${match[1]}`
  }

  if (format === 'MM/DD/YYYY') {
    const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(cleaned)
    if (match) return `${match[3]}-${match[1]}-${match[2]}`
  }

  throw new Error(`Format de date non reconnu: ${cleaned} (attendu: ${format})`)
}

/**
 * Parse CSV amount with configurable decimal separator
 */
function parseCSVAmount(amountStr: string | undefined, decimalSeparator: '.' | ','): number {
  if (!amountStr || amountStr.trim() === '') return 0

  let normalized = amountStr.trim()

  // Remove currency symbols and spaces
  normalized = normalized.replace(/[^0-9,.\-+]/g, '')

  if (decimalSeparator === ',') {
    // French format: 1 234,56 or 1.234,56
    normalized = normalized.replace(/\.(?=\d{3})/g, '') // Remove thousands separator (.)
    normalized = normalized.replace(',', '.') // Convert decimal separator
  } else {
    // US/UK format: 1,234.56
    normalized = normalized.replace(/,(?=\d{3})/g, '') // Remove thousands separator (,)
  }

  const amount = parseFloat(normalized)
  if (isNaN(amount)) {
    throw new Error(`Montant non valide: ${amountStr}`)
  }
  return amount
}

// ============ DUPLICATE DETECTION ============

/**
 * Generate a hash for duplicate detection
 */
function generateLineHash(line: ImportedBankLine): string {
  // Combine date + amount + first 50 chars of label
  const key = `${line.date}|${line.amount.toFixed(2)}|${line.label.substring(0, 50).toLowerCase()}`
  return btoa(key).substring(0, 16)
}

/**
 * Detect duplicates between imported lines and existing transactions
 */
export async function detectDuplicates(
  lines: ImportedBankLine[],
  bankAccountId: string
): Promise<{ unique: ImportedBankLine[]; duplicates: ImportedBankLine[] }> {
  // Get existing transactions for this account
  const { data: existingTx, error } = await supabase
    .from('bank_transactions')
    .select('date, amount, label')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)

  if (error) {
    console.error('Error fetching existing transactions:', error)
    throw new Error(`Erreur detection doublons: ${error.message}`)
  }

  if (!existingTx) {
    console.error('detectDuplicateLines: existingTx is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour existing transactions')
  }

  // Build a set of hashes from existing transactions
  const existingHashes = new Set<string>()
  for (const tx of existingTx) {
    const hash = generateLineHash({
      id: '',
      date: tx.date,
      amount: Number(tx.amount),
      label: tx.label
    })
    existingHashes.add(hash)
  }

  const unique: ImportedBankLine[] = []
  const duplicates: ImportedBankLine[] = []

  for (const line of lines) {
    if (line.hash && existingHashes.has(line.hash)) {
      duplicates.push(line)
    } else {
      unique.push(line)
    }
  }

  return { unique, duplicates }
}

// ============ AUTO-MATCHING ALGORITHM ============

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim()
  const bLower = b.toLowerCase().trim()

  if (aLower === bLower) return 1
  if (aLower.length === 0 || bLower.length === 0) return 0

  const distance = levenshteinDistance(aLower, bLower)
  const maxLen = Math.max(aLower.length, bLower.length)

  return 1 - (distance / maxLen)
}

/**
 * Auto-match bank lines with accounting entries
 *
 * Scoring:
 * - Exact amount match: +100 points
 * - Date within 3 days: +50 points
 * - Label similarity > 50%: +30 points
 *
 * Confidence:
 * - 80+: High (auto-match)
 * - 50-79: Medium (suggestion)
 * - <50: Low (manual)
 */
export function autoMatchTransactions(
  bankLines: ImportedBankLine[],
  entries: AccountingEntry[],
  options: {
    autoMatchThreshold?: number
    suggestionThreshold?: number
    dateToleranceDays?: number
  } = {}
): MatchSuggestion[] {
  const {
    autoMatchThreshold = 80,
    suggestionThreshold = 50,
    dateToleranceDays = 3
  } = options

  const suggestions: MatchSuggestion[] = []

  // Index entries by amount for faster lookup
  const entriesByAmount = new Map<string, AccountingEntry[]>()
  for (const entry of entries) {
    // For bank entries, the amount is the net (credit - debit)
    const netAmount = Number(entry.credit) - Number(entry.debit)
    const key = netAmount.toFixed(2)
    const existing = entriesByAmount.get(key) || []
    existing.push(entry)
    entriesByAmount.set(key, existing)
  }

  for (const line of bankLines) {
    const amountKey = line.amount.toFixed(2)
    const candidateEntries = entriesByAmount.get(amountKey) || []

    // Also check entries with small differences (for fees, etc.)
    const tolerance = 0.05 // 5 centimes
    for (const entry of entries) {
      const netAmount = Number(entry.credit) - Number(entry.debit)
      if (Math.abs(netAmount - line.amount) <= tolerance &&
          !candidateEntries.includes(entry)) {
        candidateEntries.push(entry)
      }
    }

    let bestMatch: { entry: AccountingEntry; score: number; reasons: string[] } | null = null

    for (const entry of candidateEntries) {
      let score = 0
      const reasons: string[] = []
      const netAmount = Number(entry.credit) - Number(entry.debit)

      // Amount match
      if (Math.abs(netAmount - line.amount) < 0.01) {
        score += 100
        reasons.push('Montant exact')
      } else {
        score += 90 // Close amount
        reasons.push(`Montant proche (ecart: ${Math.abs(netAmount - line.amount).toFixed(2)} EUR)`)
      }

      // Date proximity
      const lineDate = new Date(line.date)
      const entryDate = new Date(entry.date)
      const daysDiff = Math.abs(
        (lineDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysDiff <= dateToleranceDays) {
        score += 50 - (daysDiff * 10) // More points for closer dates
        if (daysDiff === 0) {
          reasons.push('Meme date')
        } else {
          reasons.push(`Date proche (${Math.round(daysDiff)} jour${daysDiff > 1 ? 's' : ''})`)
        }
      }

      // Label similarity
      const similarity = stringSimilarity(line.label, entry.label)
      if (similarity >= 0.5) {
        score += similarity * 30
        reasons.push(`Libelle similaire (${Math.round(similarity * 100)}%)`)
      }

      // Reference match
      if (line.reference && entry.piece_number &&
          line.reference.toLowerCase().includes(entry.piece_number.toLowerCase())) {
        score += 40
        reasons.push('Reference correspondante')
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { entry, score, reasons }
      }
    }

    if (bestMatch && bestMatch.score >= suggestionThreshold) {
      const confidence: 'high' | 'medium' | 'low' =
        bestMatch.score >= autoMatchThreshold ? 'high' :
        bestMatch.score >= suggestionThreshold ? 'medium' : 'low'

      suggestions.push({
        bankLineId: line.id,
        bankLine: line,
        entryId: bestMatch.entry.id,
        entry: bestMatch.entry,
        score: bestMatch.score,
        confidence,
        matchReasons: bestMatch.reasons
      })
    }
  }

  return suggestions.sort((a, b) => b.score - a.score)
}

// ============ IMPORT FUNCTIONS ============

/**
 * Import bank statement file and return preview
 */
export async function importBankStatement(
  file: File,
  bankAccountId: string,
  csvConfig?: CSVMappingConfig
): Promise<ImportPreview> {
  const content = await file.text()
  const fileName = file.name.toLowerCase()

  let lines: ImportedBankLine[]
  let format: 'ofx' | 'qif' | 'csv' | 'cfonb'

  // Auto-detect CFONB from content (regardless of extension)
  if (isCFONB120(content)) {
    format = 'cfonb'
    const statement = parseCFONB120(content)
    lines = statement.transactions.map((tx) => {
      const line: ImportedBankLine = {
        id: crypto.randomUUID(),
        date: tx.date,
        valueDate: tx.valueDate,
        label: tx.complement ? `${tx.label} - ${tx.complement}` : tx.label,
        amount: tx.amount,
        reference: tx.reference || undefined,
        rawData: { operationCode: tx.operationCode },
      }
      line.hash = generateLineHash(line)
      return line
    })
  } else if (fileName.endsWith('.ofx') || fileName.endsWith('.qfx')) {
    format = 'ofx'
    lines = parseOFX(content)
  } else if (fileName.endsWith('.qif')) {
    format = 'qif'
    lines = parseQIF(content)
  } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt') || fileName.endsWith('.cfonb')) {
    if (!csvConfig) {
      throw new Error('Configuration CSV requise pour importer un fichier CSV')
    }
    format = 'csv'
    lines = parseCSV(content, csvConfig)
  } else {
    throw new Error(`Format de fichier non supporte: ${fileName}. Formats acceptes: OFX, QIF, CSV, CFONB`)
  }

  if (lines.length === 0) {
    throw new Error('Aucune transaction trouvee dans le fichier')
  }

  // Detect duplicates
  const { unique, duplicates } = await detectDuplicates(lines, bankAccountId)

  // Calculate totals
  let totalCredits = 0
  let totalDebits = 0
  for (const line of unique) {
    if (line.amount > 0) totalCredits += line.amount
    else totalDebits += Math.abs(line.amount)
  }

  // Get date range
  const dates = unique.map(l => l.date).sort()

  return {
    lines: unique,
    duplicates,
    totalCredits,
    totalDebits,
    dateRange: {
      start: dates[0] || '',
      end: dates[dates.length - 1] || ''
    },
    format,
    fileName: file.name
  }
}

/**
 * Confirm import and create bank transactions.
 * Also creates a bank_statement record and links transactions via statement_id.
 */
export async function confirmImport(
  bankAccountId: string,
  lines: ImportedBankLine[],
  reconciliationId?: string,
  meta?: {
    format: 'ofx' | 'qif' | 'csv' | 'cfonb'
    fileName: string
  }
): Promise<{ imported: number; errors: string[]; statementId?: string }> {
  const errors: string[] = []
  let imported = 0
  let statementId: string | undefined

  // Create a bank_statement to track this import
  if (lines.length > 0 && meta) {
    const dates = lines.map((l) => l.date).sort()
    const statementDate = dates[dates.length - 1]
    const statementNumber = `${meta.format.toUpperCase()}-${statementDate}-${Date.now().toString(36)}`

    let totalCredits = 0
    let totalDebits = 0
    for (const l of lines) {
      if (l.amount > 0) totalCredits += l.amount
      else totalDebits += Math.abs(l.amount)
    }

    const { data: stmt, error: stmtError } = await supabase
      .from('bank_statements')
      .insert({
        company_id: COMPANY_ID,
        bank_account_id: bankAccountId,
        statement_number: statementNumber,
        statement_date: statementDate,
        opening_balance: 0,
        closing_balance: totalCredits - totalDebits,
        transaction_count: lines.length,
        source: meta.format,
        file_name: meta.fileName,
        status: 'imported',
        reconciliation_id: reconciliationId || null,
      })
      .select('id')
      .single()

    if (stmtError) {
      console.error('Error creating bank statement:', stmtError)
      errors.push(`Releve: ${stmtError.message}`)
    } else {
      statementId = stmt.id
    }
  }

  for (const line of lines) {
    const { error } = await supabase
      .from('bank_transactions')
      .insert({
        company_id: COMPANY_ID,
        bank_account_id: bankAccountId,
        date: line.date,
        value_date: line.valueDate,
        label: line.label,
        amount: line.amount,
        reference: line.reference,
        type: line.amount > 0 ? 'credit' : 'debit',
        reconciliation_id: reconciliationId || null,
        statement_id: statementId || null,
        is_reconciled: false,
        raw_data: line.rawData,
      })

    if (error) {
      errors.push(`Ligne ${line.date} - ${line.label}: ${error.message}`)
    } else {
      imported++
    }
  }

  return { imported, errors, statementId }
}

// ============ Create Reconciliation ============

/**
 * Creer une nouvelle session de rapprochement bancaire
 * @param bankAccountId - ID du compte bancaire
 * @param statementDate - Date du releve bancaire
 * @param openingBalance - Solde d'ouverture du releve
 * @param closingBalance - Solde de cloture du releve
 * @param statementNumber - Numero optionnel du releve
 */
export async function createReconciliation(
  bankAccountId: string,
  statementDate: string,
  openingBalance: number,
  closingBalance: number,
  statementNumber?: string
): Promise<BankReconciliation> {
  // Verifier qu'il n'y a pas de rapprochement en cours pour ce compte
  const { data: existing, error: checkError } = await supabase
    .from('bank_reconciliations')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (checkError) {
    console.error('Error checking existing reconciliation:', checkError)
    throw new Error(`Erreur verification rapprochement existant: ${checkError.message}`)
  }

  if (existing) {
    throw new Error('Un rapprochement est deja en cours pour ce compte. Veuillez le terminer ou l\'annuler avant d\'en creer un nouveau.')
  }

  // Creer la session de rapprochement
  const { data, error } = await supabase
    .from('bank_reconciliations')
    .insert({
      company_id: COMPANY_ID,
      bank_account_id: bankAccountId,
      statement_date: statementDate,
      statement_reference: statementNumber,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      status: 'in_progress',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating reconciliation:', error)
    throw new Error(`Erreur creation rapprochement: ${error.message}`)
  }

  console.log(`Created reconciliation session ${data.id} for account ${bankAccountId}`)
  return data
}

// ============ Get Reconciliation Session ============

/**
 * Recuperer une session de rapprochement avec toutes ses transactions
 * @param reconciliationId - ID de la session de rapprochement
 */
export async function getReconciliationSession(
  reconciliationId: string
): Promise<ReconciliationSession> {
  // Recuperer la session de rapprochement
  const { data: reconciliation, error: recError } = await supabase
    .from('bank_reconciliations')
    .select('*')
    .eq('id', reconciliationId)
    .single()

  if (recError) {
    console.error('Error fetching reconciliation:', recError)
    throw new Error(`Erreur chargement rapprochement: ${recError.message}`)
  }

  if (!reconciliation) {
    throw new Error('Rapprochement non trouve')
  }

  // Recuperer les transactions pointees (liees a cette session)
  const { data: matchedTransactions, error: matchedError } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', reconciliation.bank_account_id)
    .eq('reconciliation_id', reconciliationId)
    .order('date', { ascending: true })

  if (matchedError) {
    console.error('Error fetching matched transactions:', matchedError)
    throw new Error(`Erreur chargement transactions pointees: ${matchedError.message}`)
  }

  // Recuperer les transactions non pointees (jusqu'a la date du releve)
  const { data: unmatchedTransactions, error: unmatchedError } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', reconciliation.bank_account_id)
    .is('reconciliation_id', null)
    .lte('date', reconciliation.statement_date)
    .order('date', { ascending: true })

  if (unmatchedError) {
    console.error('Error fetching unmatched transactions:', unmatchedError)
    throw new Error(`Erreur chargement transactions non pointees: ${unmatchedError.message}`)
  }

  // Calculer le solde calcule (opening + somme des transactions pointees)
  const matchedSum = (matchedTransactions || []).reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  )
  const computedBalance = Number(reconciliation.opening_balance) + matchedSum
  const statementBalance = Number(reconciliation.closing_balance)
  const difference = Math.round((computedBalance - statementBalance) * 100) / 100

  return {
    reconciliation,
    matchedTransactions: matchedTransactions || [],
    unmatchedTransactions: unmatchedTransactions || [],
    computedBalance: Math.round(computedBalance * 100) / 100,
    statementBalance,
    difference,
  }
}

// ============ Get Unmatched Accounting Entries ============

/**
 * Get accounting entries for account 512 (bank) that are not yet reconciled
 */
export async function getUnmatchedAccountingEntries(
  bankAccountId: string,
  beforeDate?: string
): Promise<AccountingEntry[]> {
  // First get the bank account to find linked journal
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('id, name')
    .eq('id', bankAccountId)
    .single()

  if (accountError || !account) {
    console.error('Error fetching bank account:', accountError)
    throw new Error('Compte bancaire non trouve')
  }

  // Get entries on account 512xxx that are not linked to a transaction yet
  let query = supabase
    .from('accounting_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .like('account_code', '512%')
    .is('linked_transaction_id', null)
    .order('date', { ascending: true })

  if (beforeDate) {
    query = query.lte('date', beforeDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching accounting entries:', error)
    throw new Error(`Erreur chargement ecritures: ${error.message}`)
  }

  if (!data) {
    console.error('getAccountingEntriesForReconciliation: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour accounting entries')
  }

  return data
}

// ============ Match/Unmatch Transactions ============

/**
 * Pointer une transaction (la marquer comme rapprochee)
 * @param reconciliationId - ID de la session de rapprochement
 * @param transactionId - ID de la transaction a pointer
 */
export async function matchTransaction(
  reconciliationId: string,
  transactionId: string
): Promise<void> {
  // Verifier que le rapprochement est en cours
  const { data: reconciliation, error: recError } = await supabase
    .from('bank_reconciliations')
    .select('status')
    .eq('id', reconciliationId)
    .single()

  if (recError) {
    console.error('Error checking reconciliation status:', recError)
    throw new Error(`Erreur verification rapprochement: ${recError.message}`)
  }

  if (reconciliation.status !== 'in_progress') {
    throw new Error('Ce rapprochement est deja cloture. Impossible de modifier les transactions.')
  }

  // Pointer la transaction
  const { error } = await supabase
    .from('bank_transactions')
    .update({
      reconciliation_id: reconciliationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error matching transaction:', error)
    throw new Error(`Erreur pointage transaction: ${error.message}`)
  }

  console.log(`Matched transaction ${transactionId} to reconciliation ${reconciliationId}`)
}

/**
 * De-pointer une transaction
 * @param reconciliationId - ID de la session de rapprochement
 * @param transactionId - ID de la transaction a de-pointer
 */
export async function unmatchTransaction(
  reconciliationId: string,
  transactionId: string
): Promise<void> {
  // Verifier que le rapprochement est en cours
  const { data: reconciliation, error: recError } = await supabase
    .from('bank_reconciliations')
    .select('status')
    .eq('id', reconciliationId)
    .single()

  if (recError) {
    console.error('Error checking reconciliation status:', recError)
    throw new Error(`Erreur verification rapprochement: ${recError.message}`)
  }

  if (reconciliation.status !== 'in_progress') {
    throw new Error('Ce rapprochement est deja cloture. Impossible de modifier les transactions.')
  }

  // De-pointer la transaction
  const { error } = await supabase
    .from('bank_transactions')
    .update({
      reconciliation_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .eq('reconciliation_id', reconciliationId)

  if (error) {
    console.error('Error unmatching transaction:', error)
    throw new Error(`Erreur de-pointage transaction: ${error.message}`)
  }

  console.log(`Unmatched transaction ${transactionId} from reconciliation ${reconciliationId}`)
}

/**
 * Pointer plusieurs transactions en une fois
 */
export async function matchTransactions(
  reconciliationId: string,
  transactionIds: string[]
): Promise<{ success: number; errors: string[] }> {
  const results = { success: 0, errors: [] as string[] }

  for (const txId of transactionIds) {
    try {
      await matchTransaction(reconciliationId, txId)
      results.success++
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      results.errors.push(`Transaction ${txId}: ${message}`)
    }
  }

  return results
}

/**
 * Pointer toutes les transactions non pointees jusqu'a la date du releve
 */
export async function matchAllTransactions(
  reconciliationId: string
): Promise<{ matched: number }> {
  // Recuperer le rapprochement
  const { data: reconciliation, error: recError } = await supabase
    .from('bank_reconciliations')
    .select('*')
    .eq('id', reconciliationId)
    .single()

  if (recError) {
    console.error('Error fetching reconciliation:', recError)
    throw new Error(`Erreur chargement rapprochement: ${recError.message}`)
  }

  if (reconciliation.status !== 'in_progress') {
    throw new Error('Ce rapprochement est deja cloture.')
  }

  // Pointer toutes les transactions non pointees jusqu'a la date du releve
  const { data, error } = await supabase
    .from('bank_transactions')
    .update({
      reconciliation_id: reconciliationId,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', reconciliation.bank_account_id)
    .is('reconciliation_id', null)
    .lte('date', reconciliation.statement_date)
    .select('id')

  if (error) {
    console.error('Error matching all transactions:', error)
    throw new Error(`Erreur pointage groupe: ${error.message}`)
  }

  const matched = data?.length || 0
  console.log(`Matched ${matched} transactions to reconciliation ${reconciliationId}`)
  return { matched }
}

// ============ Complete/Cancel Reconciliation ============

/**
 * Valider et cloturer le rapprochement
 * @param reconciliationId - ID de la session de rapprochement
 * @param force - Forcer la cloture meme si l'ecart n'est pas nul
 */
export async function completeReconciliation(
  reconciliationId: string,
  force: boolean = false
): Promise<BankReconciliation> {
  // Verifier l'ecart
  const session = await getReconciliationSession(reconciliationId)

  if (session.reconciliation.status === 'completed') {
    throw new Error('Ce rapprochement est deja cloture.')
  }

  if (Math.abs(session.difference) > 0.01 && !force) {
    throw new Error(
      `L'ecart de rapprochement est de ${session.difference.toFixed(2)} EUR. ` +
      `Veuillez pointer toutes les transactions ou utiliser force=true pour forcer la cloture.`
    )
  }

  // Mark all matched transactions as reconciled
  const { error: updateError } = await supabase
    .from('bank_transactions')
    .update({
      is_reconciled: true,
      reconciled_at: new Date().toISOString(),
    })
    .eq('reconciliation_id', reconciliationId)

  if (updateError) {
    console.error('Error marking transactions as reconciled:', updateError)
    throw new Error(`Erreur mise a jour transactions: ${updateError.message}`)
  }

  // Cloturer le rapprochement
  const { data, error } = await supabase
    .from('bank_reconciliations')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId)
    .select()
    .single()

  if (error) {
    console.error('Error completing reconciliation:', error)
    throw new Error(`Erreur cloture rapprochement: ${error.message}`)
  }

  // Mark linked bank_statements as reconciled
  const { error: stmtUpdateError } = await supabase
    .from('bank_statements')
    .update({ status: 'reconciled', reconciliation_id: reconciliationId, updated_at: new Date().toISOString() })
    .eq('company_id', COMPANY_ID)
    .eq('reconciliation_id', reconciliationId)

  if (stmtUpdateError) {
    console.error('Error updating bank statements status:', stmtUpdateError)
  }

  console.log(`Completed reconciliation ${reconciliationId} with difference ${session.difference}`)
  return data
}

/**
 * Annuler un rapprochement (reouvrir ou supprimer)
 * @param reconciliationId - ID de la session de rapprochement
 */
export async function cancelReconciliation(reconciliationId: string): Promise<void> {
  // Recuperer le rapprochement
  const { data: reconciliation, error: recError } = await supabase
    .from('bank_reconciliations')
    .select('status')
    .eq('id', reconciliationId)
    .single()

  if (recError) {
    console.error('Error fetching reconciliation:', recError)
    throw new Error(`Erreur chargement rapprochement: ${recError.message}`)
  }

  // Si en cours, supprimer completement et de-pointer les transactions
  if (reconciliation.status === 'in_progress') {
    // De-pointer toutes les transactions liees
    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        reconciliation_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('reconciliation_id', reconciliationId)

    if (updateError) {
      console.error('Error unmatching transactions:', updateError)
      throw new Error(`Erreur de-pointage transactions: ${updateError.message}`)
    }

    // Supprimer le rapprochement
    const { error: deleteError } = await supabase
      .from('bank_reconciliations')
      .delete()
      .eq('id', reconciliationId)

    if (deleteError) {
      console.error('Error deleting reconciliation:', deleteError)
      throw new Error(`Erreur suppression rapprochement: ${deleteError.message}`)
    }

    console.log(`Cancelled and deleted reconciliation ${reconciliationId}`)
  } else {
    // Si cloture, juste reouvrir
    const { error } = await supabase
      .from('bank_reconciliations')
      .update({
        status: 'in_progress',
        completed_at: null,
      })
      .eq('id', reconciliationId)

    if (error) {
      console.error('Error reopening reconciliation:', error)
      throw new Error(`Erreur reouverture rapprochement: ${error.message}`)
    }

    // Also un-reconcile the transactions
    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        is_reconciled: false,
        reconciled_at: null,
      })
      .eq('reconciliation_id', reconciliationId)

    if (updateError) {
      console.error('Error un-reconciling transactions:', updateError)
    }

    console.log(`Reopened reconciliation ${reconciliationId}`)
  }
}

// ============ History & Queries ============

/**
 * Historique des rapprochements d'un compte
 * @param bankAccountId - ID du compte bancaire
 */
export async function getReconciliationHistory(
  bankAccountId: string
): Promise<BankReconciliation[]> {
  const { data, error } = await supabase
    .from('bank_reconciliations')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .order('statement_date', { ascending: false })

  if (error) {
    console.error('Error fetching reconciliation history:', error)
    throw new Error(`Erreur chargement historique: ${error.message}`)
  }

  if (!data) {
    console.error('getReconciliationHistory: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour reconciliation history')
  }

  return data
}

/**
 * Recuperer tous les rapprochements avec resume
 */
export async function getAllReconciliations(): Promise<ReconciliationSummary[]> {
  // Recuperer les rapprochements avec le compte bancaire
  const { data: reconciliations, error } = await supabase
    .from('bank_reconciliations')
    .select(`
      *,
      bank_account:bank_accounts(name)
    `)
    .eq('company_id', COMPANY_ID)
    .order('statement_date', { ascending: false })

  if (error) {
    console.error('Error fetching all reconciliations:', error)
    throw new Error(`Erreur chargement rapprochements: ${error.message}`)
  }

  if (!reconciliations || reconciliations.length === 0) {
    return []
  }

  // Pour chaque rapprochement, calculer les stats
  const summaries: ReconciliationSummary[] = []

  for (const rec of reconciliations) {
    // Compter les transactions pointees
    const { count: matchedCount } = await supabase
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('reconciliation_id', rec.id)

    // Compter les transactions non pointees (jusqu'a la date du releve)
    const { count: unmatchedCount } = await supabase
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', COMPANY_ID)
      .eq('bank_account_id', rec.bank_account_id)
      .is('reconciliation_id', null)
      .lte('date', rec.statement_date)

    // Calculer la somme des transactions pointees
    const { data: matchedTx } = await supabase
      .from('bank_transactions')
      .select('amount')
      .eq('reconciliation_id', rec.id)

    const matchedSum = (matchedTx || []).reduce((sum, tx) => sum + Number(tx.amount), 0)
    const computedBalance = Number(rec.opening_balance) + matchedSum
    const difference = Math.round((computedBalance - Number(rec.closing_balance)) * 100) / 100

    summaries.push({
      id: rec.id,
      bankAccountId: rec.bank_account_id,
      bankAccountName: rec.bank_account?.name || 'Compte inconnu',
      statementDate: rec.statement_date,
      statementNumber: rec.statement_reference,
      openingBalance: Number(rec.opening_balance),
      closingBalance: Number(rec.closing_balance),
      status: rec.status,
      matchedCount: matchedCount || 0,
      unmatchedCount: unmatchedCount || 0,
      difference,
      completedAt: rec.completed_at,
      createdAt: rec.created_at,
    })
  }

  return summaries
}

/**
 * Recuperer le rapprochement en cours pour un compte
 * @param bankAccountId - ID du compte bancaire
 */
export async function getInProgressReconciliation(
  bankAccountId: string
): Promise<BankReconciliation | null> {
  const { data, error } = await supabase
    .from('bank_reconciliations')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (error) {
    console.error('Error fetching in-progress reconciliation:', error)
    throw new Error(`Erreur chargement rapprochement en cours: ${error.message}`)
  }

  return data
}

/**
 * Transactions non pointees d'un compte (pas liees a un rapprochement)
 * @param bankAccountId - ID du compte bancaire
 * @param beforeDate - Date limite optionnelle
 */
export async function getUnmatchedTransactions(
  bankAccountId: string,
  beforeDate?: string
): Promise<BankTransaction[]> {
  let query = supabase
    .from('bank_transactions')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .is('reconciliation_id', null)
    .order('date', { ascending: true })

  if (beforeDate) {
    query = query.lte('date', beforeDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching unmatched transactions:', error)
    throw new Error(`Erreur chargement transactions non pointees: ${error.message}`)
  }

  if (!data) {
    console.error('getUnmatchedTransactions: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour unmatched transactions')
  }

  return data
}

// ============ Calculations ============

/**
 * Calculer l'ecart de rapprochement
 * @param reconciliationId - ID de la session de rapprochement
 */
export async function calculateReconciliationDifference(
  reconciliationId: string
): Promise<{ computed: number; statement: number; difference: number }> {
  const session = await getReconciliationSession(reconciliationId)

  return {
    computed: session.computedBalance,
    statement: session.statementBalance,
    difference: session.difference,
  }
}

/**
 * Calculer le solde theorique d'un compte a une date donnee
 * @param bankAccountId - ID du compte bancaire
 * @param date - Date de calcul
 */
export async function calculateTheoreticalBalance(
  bankAccountId: string,
  date: string
): Promise<{ balance: number; transactionCount: number }> {
  // Recuperer le solde initial du compte
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('initial_balance')
    .eq('id', bankAccountId)
    .single()

  if (accountError) {
    console.error('Error fetching bank account:', accountError)
    throw new Error(`Erreur chargement compte: ${accountError.message}`)
  }

  // Somme des transactions jusqu'a la date
  const { data: transactions, error: txError } = await supabase
    .from('bank_transactions')
    .select('amount')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .lte('date', date)

  if (txError) {
    console.error('Error fetching transactions:', txError)
    throw new Error(`Erreur chargement transactions: ${txError.message}`)
  }

  const txSum = (transactions || []).reduce((sum, tx) => sum + Number(tx.amount), 0)
  const balance = Number(account.initial_balance) + txSum

  return {
    balance: Math.round(balance * 100) / 100,
    transactionCount: transactions?.length || 0,
  }
}

/**
 * Obtenir le dernier rapprochement valide pour un compte
 * (utile pour proposer le solde d'ouverture du prochain rapprochement)
 */
export async function getLastCompletedReconciliation(
  bankAccountId: string
): Promise<BankReconciliation | null> {
  const { data, error } = await supabase
    .from('bank_reconciliations')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'completed')
    .order('statement_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching last completed reconciliation:', error)
    throw new Error(`Erreur chargement dernier rapprochement: ${error.message}`)
  }

  return data
}

/**
 * Suggerer les parametres pour un nouveau rapprochement
 * base sur le dernier rapprochement et les transactions recentes
 */
export async function suggestReconciliationParams(
  bankAccountId: string
): Promise<{
  suggestedOpeningBalance: number
  suggestedDate: string
  lastReconciliationDate?: string
  transactionsSinceLastReconciliation: number
}> {
  // Recuperer le dernier rapprochement
  const lastReconciliation = await getLastCompletedReconciliation(bankAccountId)

  let suggestedOpeningBalance: number
  let lastReconciliationDate: string | undefined

  if (lastReconciliation) {
    suggestedOpeningBalance = Number(lastReconciliation.closing_balance)
    lastReconciliationDate = lastReconciliation.statement_date
  } else {
    // Pas de rapprochement precedent, utiliser le solde initial du compte
    const { data: account, error } = await supabase
      .from('bank_accounts')
      .select('initial_balance')
      .eq('id', bankAccountId)
      .single()

    if (error) {
      console.error('Error fetching bank account:', error)
      throw new Error(`Erreur chargement compte: ${error.message}`)
    }

    suggestedOpeningBalance = Number(account.initial_balance)
  }

  // Compter les transactions non pointees
  const { count: transactionCount } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('bank_account_id', bankAccountId)
    .is('reconciliation_id', null)

  // Date suggeree = fin du mois precedent
  const now = new Date()
  const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const suggestedDate = lastDayOfPrevMonth.toISOString().split('T')[0]

  return {
    suggestedOpeningBalance: Math.round(suggestedOpeningBalance * 100) / 100,
    suggestedDate,
    lastReconciliationDate,
    transactionsSinceLastReconciliation: transactionCount || 0,
  }
}

// ============ ADJUSTMENT ENTRIES ============

/**
 * Create an adjustment entry for reconciliation differences
 * (e.g., bank fees, rounding, etc.)
 */
export async function createAdjustmentEntry(
  reconciliationId: string,
  amount: number,
  label: string,
  _accountCode: string = '627100' // Frais bancaires par defaut (reserved for future use)
): Promise<void> {
  // Get reconciliation details
  const { data: reconciliation, error: recError } = await supabase
    .from('bank_reconciliations')
    .select(`
      *,
      bank_account:bank_accounts(*)
    `)
    .eq('id', reconciliationId)
    .single()

  if (recError || !reconciliation) {
    throw new Error('Rapprochement non trouve')
  }

  // Create bank transaction for the adjustment
  const { data: tx, error: txError } = await supabase
    .from('bank_transactions')
    .insert({
      company_id: COMPANY_ID,
      bank_account_id: reconciliation.bank_account_id,
      date: reconciliation.statement_date,
      label: label || 'Ajustement de rapprochement',
      amount: amount,
      type: amount > 0 ? 'credit' : 'debit',
      reconciliation_id: reconciliationId,
      is_reconciled: false,
    })
    .select()
    .single()

  if (txError) {
    throw new Error(`Erreur creation ajustement: ${txError.message}`)
  }

  console.log(`Created adjustment entry ${tx.id} for ${amount} EUR`)
}

// ============ COLOR PAIRING FOR MATCHED ITEMS ============

/**
 * Generate color classes for matched pairs
 */
export function getMatchColorClasses(colorIndex: number): {
  bg: string
  border: string
  text: string
} {
  const colors = [
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  ]

  return colors[colorIndex % colors.length]
}
