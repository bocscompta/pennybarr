// Bank Import Parser Service - OFX/CSV/QIF/Pennylane/CFONB formats

import { isCFONB120, parseCFONB120 } from './parsers/cfonbParser'

export interface ParsedTransaction {
  date: Date
  dateValue?: Date
  label: string
  amount: number
  type: string // VIR, PRE, CB, CHQ, etc.
  reference?: string
  rawLine?: string
  // Pennylane-specific fields
  thirdParty?: string
  category?: string
  isReconciled?: boolean
  comments?: string
  bankAccountName?: string // For multi-account files like Pennylane
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  format: 'OFX' | 'CSV' | 'QIF' | 'PENNYLANE' | 'CFONB' | 'unknown'
  bankName?: string
  accountNumber?: string
  errors: string[]
  // For Pennylane: mapping of account names found in file
  accountsFound?: string[]
}

// Detect file format from content
export function detectFormat(content: string): 'OFX' | 'CSV' | 'QIF' | 'PENNYLANE' | 'CFONB' | 'unknown' {
  const trimmed = content.trim()

  if (trimmed.includes('<OFX>') || trimmed.includes('OFXHEADER')) {
    return 'OFX'
  }

  if (trimmed.startsWith('!Type:')) {
    return 'QIF'
  }

  // CFONB 120: fixed-length 120-char lines starting with 01/04/05/07
  if (isCFONB120(trimmed)) {
    return 'CFONB'
  }

  // Check for Pennylane format (specific header columns)
  const lines = trimmed.split('\n')
  if (lines.length > 1) {
    const firstLine = lines[0].toLowerCase()

    // Pennylane has specific columns: Date,Mois,Compte Bancaire,Libellé,Montant,Tiers,Justifié,...
    if (
      firstLine.includes('compte bancaire') &&
      firstLine.includes('tiers') &&
      firstLine.includes('justifié')
    ) {
      return 'PENNYLANE'
    }

    // Generic CSV detection
    if (
      firstLine.includes('date') ||
      firstLine.includes('montant') ||
      firstLine.includes('libelle') ||
      firstLine.includes('débit') ||
      firstLine.includes('crédit') ||
      firstLine.includes(';') ||
      firstLine.includes(',')
    ) {
      return 'CSV'
    }
  }

  return 'unknown'
}

// Parse OFX format
function parseOFX(content: string): ParseResult {
  const transactions: ParsedTransaction[] = []
  const errors: string[] = []

  // Extract bank info
  const bankIdMatch = content.match(/<BANKID>([^<]+)/i)
  const acctIdMatch = content.match(/<ACCTID>([^<]+)/i)

  // Find all STMTTRN blocks
  const transactionBlocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || []

  for (const block of transactionBlocks) {
    try {
      const dtposted = block.match(/<DTPOSTED>(\d{8})/i)?.[1]
      const trnamt = block.match(/<TRNAMT>([^<\s]+)/i)?.[1]
      const name = block.match(/<NAME>([^<]+)/i)?.[1]
      const memo = block.match(/<MEMO>([^<]+)/i)?.[1]
      const trntype = block.match(/<TRNTYPE>([^<]+)/i)?.[1]
      const fitid = block.match(/<FITID>([^<]+)/i)?.[1]

      if (!dtposted || !trnamt) {
        errors.push('Transaction incomplète: date ou montant manquant')
        continue
      }

      const year = parseInt(dtposted.slice(0, 4))
      const month = parseInt(dtposted.slice(4, 6)) - 1
      const day = parseInt(dtposted.slice(6, 8))

      transactions.push({
        date: new Date(year, month, day),
        label: name || memo || 'Transaction sans libellé',
        amount: parseFloat(trnamt.replace(',', '.')),
        type: mapOFXType(trntype || ''),
        reference: fitid,
      })
    } catch (e) {
      errors.push(`Erreur parsing transaction OFX: ${e}`)
    }
  }

  return {
    transactions,
    format: 'OFX',
    bankName: bankIdMatch?.[1],
    accountNumber: acctIdMatch?.[1],
    errors,
  }
}

// Map OFX transaction types to Dolibarr types
function mapOFXType(ofxType: string): string {
  const typeMap: Record<string, string> = {
    'CREDIT': 'VIR',
    'DEBIT': 'VIR',
    'XFER': 'VIR',
    'CHECK': 'CHQ',
    'PAYMENT': 'PRE',
    'POS': 'CB',
    'ATM': 'CB',
    'DEP': 'VIR',
    'DIRECTDEBIT': 'PRE',
    'DIRECTDEP': 'VIR',
    'FEE': 'PRE',
    'SRVCHG': 'PRE',
    'INT': 'VIR',
  }
  return typeMap[ofxType.toUpperCase()] || 'VIR'
}

// Parse QIF format
function parseQIF(content: string): ParseResult {
  const transactions: ParsedTransaction[] = []
  const errors: string[] = []

  const lines = content.split('\n')
  let currentTx: Partial<ParsedTransaction> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const code = trimmed[0]
    const value = trimmed.slice(1)

    switch (code) {
      case 'D': // Date
        // QIF date format: MM/DD/YYYY or DD/MM/YYYY (European)
        const parts = value.split('/')
        if (parts.length === 3) {
          // Try European format first (DD/MM/YYYY)
          const day = parseInt(parts[0])
          const month = parseInt(parts[1]) - 1
          const year = parseInt(parts[2])
          currentTx.date = new Date(year, month, day)
        }
        break
      case 'T': // Amount
      case 'U': // Amount (duplicate)
        currentTx.amount = parseFloat(value.replace(/[^\d.-]/g, ''))
        break
      case 'P': // Payee
      case 'M': // Memo
        if (!currentTx.label) {
          currentTx.label = value
        }
        break
      case 'N': // Check number or reference
        currentTx.reference = value
        if (value.match(/^\d+$/)) {
          currentTx.type = 'CHQ'
        }
        break
      case '^': // End of transaction
        if (currentTx.date && currentTx.amount !== undefined) {
          transactions.push({
            date: currentTx.date,
            label: currentTx.label || 'Transaction sans libellé',
            amount: currentTx.amount,
            type: currentTx.type || 'VIR',
            reference: currentTx.reference,
          })
        }
        currentTx = {}
        break
    }
  }

  return {
    transactions,
    format: 'QIF',
    errors,
  }
}

// Parse Pennylane CSV format
function parsePennylane(content: string): ParseResult {
  const transactions: ParsedTransaction[] = []
  const errors: string[] = []
  const accountsFound = new Set<string>()

  const lines = content.split('\n')
  if (lines.length < 2) {
    return { transactions, format: 'PENNYLANE', errors: ['Fichier Pennylane vide ou invalide'] }
  }

  // Parse header - Pennylane uses comma delimiter
  const headerCols = parseCSVLine(lines[0], ',')

  // Find column indices
  const dateCol = findColumnIndex(headerCols, ['date'])
  const accountCol = findColumnIndex(headerCols, ['compte bancaire'])
  const labelCol = findColumnIndex(headerCols, ['libellé', 'libelle'])
  const amountCol = findColumnIndex(headerCols, ['montant'])
  const thirdPartyCol = findColumnIndex(headerCols, ['tiers'])
  const reconciledCol = findColumnIndex(headerCols, ['justifié', 'justifie'])
  const commentsCol = findColumnIndex(headerCols, ['commentaires', 'commentaire'])
  const categoryCol = findColumnIndex(headerCols, ['types de dépenses', 'types de depenses', 'type de dépense'])

  if (dateCol === -1 || labelCol === -1 || amountCol === -1) {
    errors.push('Colonnes obligatoires manquantes (Date, Libellé, Montant)')
    return { transactions, format: 'PENNYLANE', errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    try {
      const cols = parseCSVLine(line, ',')

      // Parse date (Pennylane format: D/M/YYYY or DD/MM/YYYY)
      const dateStr = cols[dateCol]?.trim()
      if (!dateStr || !dateStr.includes('/')) continue

      const dateParts = dateStr.split('/')
      if (dateParts.length !== 3) {
        errors.push(`Date invalide ligne ${i + 1}: ${dateStr}`)
        continue
      }

      const day = parseInt(dateParts[0])
      const month = parseInt(dateParts[1]) - 1
      const year = parseInt(dateParts[2])

      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        errors.push(`Date invalide ligne ${i + 1}: ${dateStr}`)
        continue
      }

      const date = new Date(year, month, day)

      // Parse amount (Pennylane format: "-1,890.00 €" or "20.00 €")
      const amountStr = cols[amountCol]?.trim()
      if (!amountStr) {
        errors.push(`Montant manquant ligne ${i + 1}`)
        continue
      }
      const amount = parsePennylaneAmount(amountStr)

      // Get label
      const label = cols[labelCol]?.trim() || 'Transaction sans libellé'

      // Get bank account name
      const bankAccountName = accountCol !== -1 ? cols[accountCol]?.trim() : undefined
      if (bankAccountName) {
        accountsFound.add(bankAccountName)
      }

      // Get third party
      const thirdParty = thirdPartyCol !== -1 ? cols[thirdPartyCol]?.trim() : undefined

      // Get reconciliation status
      const reconciledStr = reconciledCol !== -1 ? cols[reconciledCol]?.trim()?.toLowerCase() : ''
      const isReconciled = reconciledStr === 'oui' || reconciledStr === 'yes' || reconciledStr === 'true'

      // Get comments
      const comments = commentsCol !== -1 ? cols[commentsCol]?.trim() : undefined

      // Get category
      const category = categoryCol !== -1 ? cols[categoryCol]?.trim() : undefined

      transactions.push({
        date,
        label,
        amount,
        type: detectTransactionType(label),
        thirdParty,
        category,
        isReconciled,
        comments,
        bankAccountName,
        rawLine: line,
      })
    } catch (e) {
      errors.push(`Erreur ligne ${i + 1}: ${e}`)
    }
  }

  return {
    transactions,
    format: 'PENNYLANE',
    errors,
    accountsFound: Array.from(accountsFound),
  }
}

// Parse Pennylane amount format: "-1,890.00 €" or "20.00 €" or "-0.87 €"
function parsePennylaneAmount(value: string): number {
  if (!value) return 0

  // Remove currency symbol and spaces
  let cleaned = value.replace(/[€$£\s]/g, '').trim()

  // Handle negative with quotes: "-1,890.00"
  cleaned = cleaned.replace(/"/g, '')

  // Pennylane uses: comma as thousands separator, dot as decimal
  // Example: "-1,890.00" means -1890.00
  // But also: "-0.87" means -0.87 (no thousands)

  // If there's a comma followed by 3 digits and then a dot, it's thousands separator
  // If there's just a comma, it might be decimal (European) - but Pennylane uses dot for decimal

  // Remove commas (thousands separator in Pennylane)
  cleaned = cleaned.replace(/,/g, '')

  const result = parseFloat(cleaned)
  if (isNaN(result)) {
    throw new Error(`Impossible de parser le montant: ${value}`)
  }
  return result
}

// Parse CSV format (CIC and generic)
function parseCSV(content: string): ParseResult {
  const transactions: ParsedTransaction[] = []
  const errors: string[] = []

  // Detect delimiter
  const firstLines = content.split('\n').slice(0, 3).join('\n')
  const delimiter = firstLines.includes(';') ? ';' : ','

  const lines = content.split('\n')
  if (lines.length < 2) {
    return { transactions, format: 'CSV', errors: ['Fichier CSV vide ou invalide'] }
  }

  // Parse header to find column indices
  const header = lines[0].toLowerCase()
  const headerCols = parseCSVLine(header, delimiter)

  const dateCol = findColumnIndex(headerCols, ['date', 'date operation', 'date opération', 'date_operation'])
  const labelCol = findColumnIndex(headerCols, ['libelle', 'libellé', 'label', 'description', 'libelle operation', 'libellé opération'])
  const amountCol = findColumnIndex(headerCols, ['montant', 'amount', 'valeur'])
  const debitCol = findColumnIndex(headerCols, ['debit', 'débit'])
  const creditCol = findColumnIndex(headerCols, ['credit', 'crédit'])

  if (dateCol === -1 || labelCol === -1) {
    errors.push('Colonnes date ou libellé non trouvées dans le CSV')
    return { transactions, format: 'CSV', errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    try {
      const cols = parseCSVLine(line, delimiter)

      // Parse date (supports DD/MM/YYYY and YYYY-MM-DD)
      const dateStr = cols[dateCol]?.trim()
      if (!dateStr) continue

      let date: Date
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/')
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      } else if (dateStr.includes('-')) {
        date = new Date(dateStr)
      } else {
        errors.push(`Date invalide ligne ${i + 1}: ${dateStr}`)
        continue
      }

      // Parse amount
      let amount: number
      if (amountCol !== -1) {
        amount = parseAmount(cols[amountCol])
      } else if (debitCol !== -1 && creditCol !== -1) {
        const debit = parseAmount(cols[debitCol])
        const credit = parseAmount(cols[creditCol])
        amount = credit - debit
      } else {
        errors.push(`Montant non trouvé ligne ${i + 1}`)
        continue
      }

      const label = cols[labelCol]?.trim() || 'Transaction sans libellé'

      transactions.push({
        date,
        label,
        amount,
        type: detectTransactionType(label),
        rawLine: line,
      })
    } catch (e) {
      errors.push(`Erreur ligne ${i + 1}: ${e}`)
    }
  }

  return {
    transactions,
    format: 'CSV',
    errors,
  }
}

// Parse a CSV line handling quoted values
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

// Find column index from possible names
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim()
    if (possibleNames.some(name => header.includes(name))) {
      return i
    }
  }
  return -1
}

// Parse amount string to number
function parseAmount(value: string | undefined): number {
  if (!value) return 0
  // Remove spaces, currency symbols, and handle European format
  const cleaned = value
    .replace(/[€$£\s]/g, '')
    .replace(/\s/g, '')
    .replace(',', '.')
  return parseFloat(cleaned) || 0
}

// Detect transaction type from label
function detectTransactionType(label: string): string {
  const upper = label.toUpperCase()

  if (upper.includes('CHEQUE') || upper.includes('CHQ')) return 'CHQ'
  if (upper.includes('CARTE') || upper.includes('CB ') || upper.includes('PAIEMENT CB')) return 'CB'
  if (upper.includes('PRELEVEMENT') || upper.includes('PRLV')) return 'PRE'
  if (upper.includes('VIREMENT') || upper.includes('VIR')) return 'VIR'
  if (upper.includes('RETRAIT') || upper.includes('DAB')) return 'CB'
  if (upper.includes('FRAIS') || upper.includes('COMMISSION')) return 'PRE'
  if (upper.includes('INTERETS') || upper.includes('INTÉRÊTS')) return 'VIR'

  return 'VIR' // Default
}

// Parse CFONB 120 format
function parseCFONB(content: string): ParseResult {
  const transactions: ParsedTransaction[] = []
  const errors: string[] = []

  try {
    const statement = parseCFONB120(content)

    for (const tx of statement.transactions) {
      transactions.push({
        date: new Date(tx.date),
        dateValue: tx.valueDate ? new Date(tx.valueDate) : undefined,
        label: tx.complement ? `${tx.label} - ${tx.complement}` : tx.label,
        amount: tx.amount,
        type: detectTransactionType(tx.label),
        reference: tx.reference || undefined,
      })
    }

    return {
      transactions,
      format: 'CFONB',
      accountNumber: statement.accountNumber,
      bankName: statement.bankCode,
      errors,
    }
  } catch (e) {
    errors.push(`Erreur parsing CFONB: ${e instanceof Error ? e.message : String(e)}`)
    return { transactions, format: 'CFONB', errors }
  }
}

// Main parse function
export function parseFile(content: string, filename?: string): ParseResult {
  const format = detectFormat(content)

  switch (format) {
    case 'OFX':
      return parseOFX(content)
    case 'QIF':
      return parseQIF(content)
    case 'PENNYLANE':
      return parsePennylane(content)
    case 'CFONB':
      return parseCFONB(content)
    case 'CSV':
      return parseCSV(content)
    default:
      return {
        transactions: [],
        format: 'unknown',
        errors: [`Format de fichier non reconnu${filename ? `: ${filename}` : ''}`],
      }
  }
}

// Convert ParsedTransaction to Dolibarr format (legacy)
export function toDolibarrFormat(tx: ParsedTransaction): {
  date: string
  type: string
  label: string
  amount: number
} {
  return {
    date: Math.floor(tx.date.getTime() / 1000).toString(),
    type: tx.type,
    label: tx.label,
    amount: tx.amount,
  }
}

// Convert ParsedTransaction to Supabase format
export function toSupabaseFormat(
  tx: ParsedTransaction,
  bankAccountId: string,
  categoryId?: string,
  categoryName?: string
): {
  bank_account_id: string
  date: string
  value_date?: string
  label: string
  amount: number
  type: string
  reference?: string
  category?: string
  category_id?: string
  is_reconciled: boolean
  raw_data?: Record<string, unknown>
} {
  // Build raw_data with all extra info from Pennylane
  const rawData: Record<string, unknown> = {}
  if (tx.rawLine) rawData.rawLine = tx.rawLine
  if (tx.thirdParty) rawData.thirdParty = tx.thirdParty
  if (tx.category) rawData.category = tx.category
  if (tx.comments) rawData.comments = tx.comments
  if (tx.bankAccountName) rawData.bankAccountName = tx.bankAccountName

  return {
    bank_account_id: bankAccountId,
    date: tx.date.toISOString().split('T')[0],
    value_date: tx.dateValue?.toISOString().split('T')[0],
    label: tx.label,
    amount: tx.amount,
    type: tx.type,
    reference: tx.reference,
    category: categoryName || tx.category,  // Use mapped name or original Pennylane category
    category_id: categoryId,
    is_reconciled: tx.isReconciled ?? false,
    raw_data: Object.keys(rawData).length > 0 ? rawData : undefined,
  }
}
