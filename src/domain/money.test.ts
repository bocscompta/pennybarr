import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  allocateProportionally,
  applyBasisPoints,
  cents,
  formatCents,
  parseAmountToCents,
  sumCents,
} from './money.ts'

test('parse un montant français avec virgule', () => {
  assert.equal(parseAmountToCents('1234,56'), 123456)
})

test('parse un montant avec espaces insécables de milliers', () => {
  assert.equal(parseAmountToCents('1 234,56'), 123456)
  assert.equal(parseAmountToCents('1\u00A0234,56'), 123456)
  assert.equal(parseAmountToCents('1\u202F234,56'), 123456)
})

test('parse un montant avec point décimal', () => {
  assert.equal(parseAmountToCents('1234.56'), 123456)
})

test('parse un montant négatif et un montant sans décimales', () => {
  assert.equal(parseAmountToCents('-12,5'), -1250)
  assert.equal(parseAmountToCents('7'), 700)
})

test('refuse plus de deux décimales', () => {
  assert.throws(() => parseAmountToCents('12,345'), /invalide/)
})

test('refuse un format ambigu ou non numérique', () => {
  assert.throws(() => parseAmountToCents('1.234,56'), /invalide/)
  assert.throws(() => parseAmountToCents('abc'), /invalide/)
  assert.throws(() => parseAmountToCents(''), /vide/)
})

test('formate en euros français', () => {
  const formatted = formatCents(cents(123456)).replace(/[\u00A0\u202F]/g, ' ')
  assert.equal(formatted, '1 234,56 €')
})

test('somme les centimes sans perte', () => {
  assert.equal(sumCents([cents(1), cents(2), cents(3)]), 6)
})

test('applique un taux en points de base', () => {
  assert.equal(applyBasisPoints(cents(100000), 2000), 20000)
  assert.equal(applyBasisPoints(cents(100000), 550), 5500)
})

test('arrondit au centime supérieur (demi vers le haut)', () => {
  // 33,33 € × 20 % = 666,6 centimes → 667
  assert.equal(applyBasisPoints(cents(3333), 2000), 667)
})

test('répartit un montant au prorata des tantièmes', () => {
  const parts = allocateProportionally(cents(45000), [450, 300, 250])
  assert.deepEqual(parts, [20250, 13500, 11250])
  assert.equal(sumCents(parts), 45000)
})

test('répartit sans perdre de centime quand le prorata ne tombe pas juste', () => {
  const parts = allocateProportionally(cents(100), [1, 1, 1])
  assert.equal(sumCents(parts), 100)
  assert.deepEqual([...parts].sort((a, b) => b - a), [34, 33, 33])
})

test('refuse une répartition avec des poids invalides', () => {
  assert.throws(() => allocateProportionally(cents(100), []), /poids/)
  assert.throws(() => allocateProportionally(cents(100), [0, 0]), /strictement positive/)
})
