import { test } from 'node:test'
import assert from 'node:assert/strict'

import { cents } from '../money.ts'
import {
  isBalanced,
  isValidIsoDate,
  line,
  validateEntry,
  type EntryInput,
} from './entry.ts'

function factureValide(): EntryInput {
  return {
    date: '2026-03-10',
    journal: 'VE',
    pieceNumber: 'VE2026000001',
    label: 'Facture F2026-001 — Boulangerie Dupont',
    lines: [
      line('411000', 'debit', 120000),
      line('701000', 'credit', 100000),
      line('445710', 'credit', 20000),
    ],
  }
}

test('accepte une facture de vente équilibrée', () => {
  const result = validateEntry(factureValide())
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.totalDebit, 120000)
    assert.equal(result.totalCredit, 120000)
  }
})

test('refuse une écriture déséquilibrée', () => {
  const entry = factureValide()
  entry.lines = [line('411000', 'debit', 120000), line('701000', 'credit', 100000)]
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /déséquilibrée/)
  }
})

test('refuse une écriture à une seule ligne', () => {
  const entry = factureValide()
  entry.lines = [line('411000', 'debit', 120000)]
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /au moins deux lignes/)
  }
})

test('refuse une ligne à la fois débit et crédit', () => {
  const entry = factureValide()
  entry.lines = [
    { accountCode: '411000', debit: cents(100), credit: cents(100) },
    line('701000', 'credit', 100),
  ]
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /à la fois débit et crédit/)
  }
})

test('refuse une ligne à montant nul', () => {
  const entry = factureValide()
  entry.lines = [
    { accountCode: '411000', debit: cents(0), credit: cents(0) },
    line('701000', 'credit', 0),
  ]
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /montant nul/)
  }
})

test('refuse un compte hors plan comptable', () => {
  const entry = factureValide()
  entry.lines = [line('ABC', 'debit', 100), line('701000', 'credit', 100)]
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /compte PCG invalide/)
  }
})

test('refuse des centimes non entiers', () => {
  const entry = factureValide()
  entry.lines = [
    { accountCode: '411000', debit: 100.5 as never, credit: cents(0) },
    line('701000', 'credit', 100),
  ]
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /centimes entiers/)
  }
})

test('refuse une date inexistante', () => {
  assert.equal(isValidIsoDate('2026-02-30'), false)
  const entry = factureValide()
  entry.date = '2026-02-30'
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /Date invalide/)
  }
})

test('refuse un journal invalide', () => {
  const entry = factureValide()
  entry.journal = 'ventes'
  const result = validateEntry(entry)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join(' '), /Journal invalide/)
  }
})

test('détecte l’équilibre exact, sans tolérance flottante', () => {
  assert.equal(isBalanced([line('411000', 'debit', 100), line('701000', 'credit', 100)]), true)
  assert.equal(isBalanced([line('411000', 'debit', 100), line('701000', 'credit', 99)]), false)
})
