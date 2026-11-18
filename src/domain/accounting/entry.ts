/**
 * Écritures comptables en partie double — couche domaine pure.
 *
 * Ces règles sont volontairement indépendantes de Supabase : elles doivent
 * pouvoir être exécutées côté serveur (RPC/Edge Function) comme dans les tests,
 * sans base de données.
 */

import { cents, sumCents, type Cents } from '../money.ts'

export interface EntryLineInput {
  /** Compte du plan comptable général, ex. « 401000 ». */
  accountCode: string
  /** Débit en centimes (0 si la ligne est au crédit). */
  debit: Cents
  /** Crédit en centimes (0 si la ligne est au débit). */
  credit: Cents
}

export interface EntryInput {
  /** Date d'écriture au format ISO `AAAA-MM-JJ`. */
  date: string
  /** Code journal : « VE », « AC », « BQ », « OD »… */
  journal: string
  /** Numéro de pièce, unique par journal et exercice. */
  pieceNumber: string
  /** Libellé de l'écriture. */
  label: string
  lines: readonly EntryLineInput[]
}

export type EntryValidation =
  | { ok: true; totalDebit: Cents; totalCredit: Cents }
  | { ok: false; errors: readonly string[] }

const ACCOUNT_PATTERN = /^[1-8][0-9]{1,7}$/
const JOURNAL_PATTERN = /^[A-Z0-9]{1,8}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Vérifie qu'une date ISO existe réellement (refuse le 30 février). */
export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Vrai si le total des débits égale exactement le total des crédits. */
export function isBalanced(lines: readonly EntryLineInput[]): boolean {
  const debit = sumCents(lines.map((line) => line.debit))
  const credit = sumCents(lines.map((line) => line.credit))
  return debit === credit
}

/**
 * Valide une écriture avant enregistrement.
 *
 * Règles : au moins deux lignes, comptes PCG valides, chaque ligne sur un seul
 * côté, montants entiers strictement positifs, et équilibre débit = crédit.
 */
export function validateEntry(entry: EntryInput): EntryValidation {
  const errors: string[] = []

  if (!isValidIsoDate(entry.date)) {
    errors.push(`Date invalide : « ${entry.date} » (format AAAA-MM-JJ attendu)`)
  }
  if (!JOURNAL_PATTERN.test(entry.journal)) {
    errors.push(`Journal invalide : « ${entry.journal} » (2 à 8 caractères A-Z/0-9)`)
  }
  if (entry.pieceNumber.trim() === '') {
    errors.push('Numéro de pièce manquant')
  }
  if (entry.label.trim() === '') {
    errors.push('Libellé manquant')
  }
  if (entry.lines.length < 2) {
    errors.push('Une écriture doit comporter au moins deux lignes')
  }

  entry.lines.forEach((line, index) => {
    const position = `Ligne ${index + 1}`
    if (!ACCOUNT_PATTERN.test(line.accountCode)) {
      errors.push(`${position} : compte PCG invalide « ${line.accountCode} »`)
    }
    if (!Number.isSafeInteger(line.debit) || !Number.isSafeInteger(line.credit)) {
      errors.push(`${position} : les montants doivent être des centimes entiers`)
      return
    }
    if (line.debit < 0 || line.credit < 0) {
      errors.push(`${position} : les montants ne peuvent pas être négatifs`)
    }
    if (line.debit > 0 && line.credit > 0) {
      errors.push(`${position} : une ligne ne peut pas être à la fois débit et crédit`)
    }
    if (line.debit === 0 && line.credit === 0) {
      errors.push(`${position} : montant nul`)
    }
  })

  if (errors.length === 0 && !isBalanced(entry.lines)) {
    const debit = sumCents(entry.lines.map((line) => line.debit))
    const credit = sumCents(entry.lines.map((line) => line.credit))
    errors.push(
      `Écriture déséquilibrée : débit ${debit} ≠ crédit ${credit} (centimes)`,
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    totalDebit: sumCents(entry.lines.map((line) => line.debit)),
    totalCredit: sumCents(entry.lines.map((line) => line.credit)),
  }
}

/** Construit une ligne équilibrée à partir d'un montant et d'un sens. */
export function line(
  accountCode: string,
  side: 'debit' | 'credit',
  amount: number,
): EntryLineInput {
  const value = cents(amount)
  return {
    accountCode,
    debit: side === 'debit' ? value : cents(0),
    credit: side === 'credit' ? value : cents(0),
  }
}
