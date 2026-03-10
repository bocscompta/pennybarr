// Lettrage Colors Utility - Pennylane-style color coding for accounting entries
import type { LettrageType, AccountingEntry } from '../types/database'

// ============ Color Definitions ============

export interface LettrageColor {
  badge: {
    bg: string
    text: string
    border: string
  }
  row: {
    bg: string
    bgHover: string
  }
}

// Pennylane-style lettrage colors
export const LETTRAGE_COLORS: Record<LettrageType, LettrageColor> = {
  // Green: Direct lettrage between invoice and payment (supplier/customer accounts)
  tiers: {
    badge: {
      bg: '#D1FAE5',      // green-100
      text: '#065F46',     // green-800
      border: '#6EE7B7',   // green-300
    },
    row: {
      bg: '#ECFDF5',       // green-50
      bgHover: '#D1FAE5',  // green-100
    },
  },

  // Yellow/Amber: Autoliquidation VAT entries
  autoliquidation: {
    badge: {
      bg: '#FEF3C7',      // amber-100
      text: '#92400E',     // amber-800
      border: '#FCD34D',   // amber-300
    },
    row: {
      bg: '#FFFBEB',       // amber-50
      bgHover: '#FEF3C7',  // amber-100
    },
  },

  // Pink/Purple: VAT recovery on receipts (RT journal)
  tva_encaissement: {
    badge: {
      bg: '#FCE7F3',      // pink-100
      text: '#9D174D',     // pink-800
      border: '#F9A8D4',   // pink-300
    },
    row: {
      bg: '#FDF2F8',       // pink-50
      bgHover: '#FCE7F3',  // pink-100
    },
  },
}

// Default color for unlettered entries
export const DEFAULT_LETTRAGE_COLOR: LettrageColor = {
  badge: {
    bg: '#F3F4F6',        // gray-100
    text: '#374151',       // gray-700
    border: '#D1D5DB',     // gray-300
  },
  row: {
    bg: 'transparent',
    bgHover: '#F9FAFB',    // gray-50
  },
}

// ============ Helper Functions ============

/**
 * Get lettrage color based on type
 */
export function getLettrageColor(type?: LettrageType): LettrageColor {
  if (!type) return DEFAULT_LETTRAGE_COLOR
  return LETTRAGE_COLORS[type] || DEFAULT_LETTRAGE_COLOR
}

/**
 * Determine lettrage type based on account code and journal
 */
export function determineLettrageType(
  accountCode: string,
  journal: string,
  label?: string
): LettrageType {
  // RT journal = TVA recovery on receipts
  if (journal === 'RT') {
    return 'tva_encaissement'
  }

  // TVA accounts with autoliquidation
  const isAutoLiq = label?.toLowerCase().includes('autoliq') ||
                    label?.toLowerCase().includes('auto-liq') ||
                    label?.toLowerCase().includes('autoliquidation')

  // TVA deductible/collectee accounts (44566, 44571)
  if (accountCode.startsWith('44566') || accountCode.startsWith('44571')) {
    if (isAutoLiq) {
      return 'autoliquidation'
    }
  }

  // TVA sur encaissements accounts (44564, 44574)
  if (accountCode.startsWith('44564') || accountCode.startsWith('44574')) {
    return 'tva_encaissement'
  }

  // Supplier/Customer accounts (401xxx, 411xxx)
  if (accountCode.startsWith('401') || accountCode.startsWith('411')) {
    return 'tiers'
  }

  // Default to tiers for other lettered accounts
  return 'tiers'
}

/**
 * Generate next lettrage code (A, B, C, ..., AA, AB, etc.)
 */
export function generateNextLettrageCode(existingCodes: string[]): string {
  if (existingCodes.length === 0) return 'A'

  // Find the highest code
  const sortedCodes = existingCodes.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b)
  })

  const lastCode = sortedCodes[sortedCodes.length - 1]
  return incrementLettrageCode(lastCode)
}

/**
 * Increment a lettrage code (A -> B, Z -> AA, AZ -> BA)
 */
function incrementLettrageCode(code: string): string {
  const chars = code.split('')
  let i = chars.length - 1

  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A'
      i--
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      return chars.join('')
    }
  }

  // All letters were Z, add new letter
  return 'A' + chars.join('')
}

/**
 * Check if entries can be lettered together (same account, balanced)
 */
export function canLetterEntries(entries: AccountingEntry[]): boolean {
  if (entries.length < 2) return false

  // All entries must be for the same account
  const accountCodes = new Set(entries.map(e => e.account_code))
  if (accountCodes.size !== 1) return false

  // Total debit must equal total credit
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)

  // Allow small floating point differences
  return Math.abs(totalDebit - totalCredit) < 0.01
}

/**
 * Check if lettrage is complete (total debit = total credit)
 */
export function isLettrageComplete(entries: AccountingEntry[]): boolean {
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)
  return Math.abs(totalDebit - totalCredit) < 0.01
}

/**
 * Format lettrage code for display (uppercase = complete, lowercase = partial)
 */
export function formatLettrageCode(code: string, isComplete: boolean): string {
  return isComplete ? code.toUpperCase() : code.toLowerCase()
}

// ============ Journal Type Colors ============

// Colors for journal type badges
export const JOURNAL_COLORS: Record<string, { bg: string; text: string }> = {
  'HA': { bg: '#FEE2E2', text: '#DC2626' },   // Achats - Red
  'ACH': { bg: '#FEE2E2', text: '#DC2626' },  // Achats - Red
  'VE': { bg: '#DCFCE7', text: '#16A34A' },   // Ventes - Green
  'VT': { bg: '#DCFCE7', text: '#16A34A' },   // Ventes - Green
  'VTE': { bg: '#DCFCE7', text: '#16A34A' },  // Ventes - Green
  'BQ': { bg: '#DBEAFE', text: '#2563EB' },   // Banque - Blue
  'BQ1': { bg: '#DBEAFE', text: '#2563EB' },  // Banque - Blue
  'OD': { bg: '#FEF3C7', text: '#D97706' },   // OD - Amber
  'AN': { bg: '#E0E7FF', text: '#4F46E5' },   // A-nouveaux - Indigo
  'RT': { bg: '#FCE7F3', text: '#DB2777' },   // Récup TVA - Pink
  'CAI': { bg: '#F3E8FF', text: '#7C3AED' },  // Caisse - Purple
  'SAL': { bg: '#ECFDF5', text: '#059669' },  // Salaires - Emerald
}

/**
 * Get journal color
 */
export function getJournalColor(journalCode: string): { bg: string; text: string } {
  // Extract base journal code (BQ1 -> BQ)
  const baseCode = journalCode.replace(/\d+$/, '')
  return JOURNAL_COLORS[journalCode] || JOURNAL_COLORS[baseCode] || { bg: '#F3F4F6', text: '#374151' }
}
