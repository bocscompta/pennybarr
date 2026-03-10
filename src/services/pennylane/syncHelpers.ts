// Shared helpers for Pennylane sync modules

/**
 * Parse Pennylane amount string ("1234.56") to number
 */
export function parseAmount(amountStr: string | null): number {
  if (!amountStr) return 0
  const cleaned = amountStr.replace(/[^0-9.,\-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (isNaN(num)) {
    throw new Error(`Failed to parse amount: "${amountStr}"`)
  }
  return num
}

/**
 * Check if two amounts match within tolerance
 */
export function amountsMatch(a: number, b: number, tolerance: number = 0.02): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= tolerance
}

/**
 * Check if two dates are within N days of each other
 */
export function datesWithinDays(dateA: string, dateB: string, maxDays: number): boolean {
  const a = new Date(dateA)
  const b = new Date(dateB)
  const diffMs = Math.abs(a.getTime() - b.getTime())
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= maxDays
}

/**
 * Clean a third-party name from Pennylane auto-generated text.
 * Strips "(label généré)", "FACTURE " prefix, trailing reference codes.
 */
export function cleanThirdPartyName(name: string): string {
  let cleaned = name.trim()
  // Remove "(label généré)" / "(LABEL GÉNÉRÉ)" suffix
  cleaned = cleaned.replace(/\s*\(label\s+g[ée]n[ée]r[ée]\)\s*/gi, '').trim()
  // Remove "FACTURE " / "Facture " prefix
  cleaned = cleaned.replace(/^facture\s+/i, '').trim()
  // Remove trailing reference like " - ABC123" or " - JH1PWQ"
  cleaned = cleaned.replace(/\s+-\s+[A-Z0-9]+$/i, '').trim()
  // Remove "DIRIGEANT " prefix (e.g. "DIRIGEANT UTILISATEUR")
  cleaned = cleaned.replace(/^dirigeant\s+/i, '').trim()
  return cleaned || name.trim()
}

/**
 * Extract supplier name from Pennylane label like "Facture SNCF - JH1PWQ (label généré)"
 */
export function extractSupplierFromLabel(label: string | null): string | null {
  if (!label) return null
  // Try regex: "Facture SUPPLIER - REF..."
  const match = label.match(/^Facture\s+(.+?)\s+-\s+/)
  if (match) return match[1].trim()
  // If no "(label généré)", the label itself is usable
  if (!label.includes('(label généré)')) return label.trim()
  // Try cleaning the auto-generated label
  const cleaned = cleanThirdPartyName(label)
  if (cleaned && cleaned.length >= 2) return cleaned
  return null
}

export function normalizeSupplierName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ')
}

export function supplierNamesMatch(a: string, b: string): boolean {
  const na = normalizeSupplierName(a)
  const nb = normalizeSupplierName(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const firstA = na.split(' ')[0]
  const firstB = nb.split(' ')[0]
  if (firstA.length >= 3 && firstA === firstB) return true
  return false
}

/**
 * Create a timestamped log message
 */
export function logMessage(msg: string): string {
  return `[${new Date().toLocaleTimeString('fr-FR')}] ${msg}`
}
