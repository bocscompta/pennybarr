import { test } from 'node:test'
import assert from 'node:assert/strict'

import { cents } from '../money.ts'
import {
  TAUX_TVA_FR,
  calculerTotaux,
  calculerTva,
  estTauxFrancais,
  estTauxValide,
  htDepuisTtc,
  tvaDepuisTtc,
} from './vat.ts'

test('calcule la TVA au taux normal sur 100,00 €', () => {
  assert.equal(calculerTva(cents(10000), TAUX_TVA_FR.NORMAL), 2000)
})

test('calcule la TVA aux taux réduits', () => {
  assert.equal(calculerTva(cents(10000), TAUX_TVA_FR.INTERMEDIAIRE), 1000)
  assert.equal(calculerTva(cents(10000), TAUX_TVA_FR.REDUIT), 550)
  assert.equal(calculerTva(cents(10000), TAUX_TVA_FR.PARTICULIER), 210)
})

test('arrondit la TVA au centime, demi vers le haut', () => {
  // 33,33 € × 20 % = 6,666 € → 6,67 € ; TTC = 40,00 €
  const base = cents(3333)
  const tva = calculerTva(base, TAUX_TVA_FR.NORMAL)
  assert.equal(tva, 667)
  assert.equal(base + tva, 4000)
})

test('ventile les totaux par taux', () => {
  const totaux = calculerTotaux([
    { baseHt: cents(10000), tauxBp: 2000 },
    { baseHt: cents(5000), tauxBp: 1000 },
    { baseHt: cents(2000), tauxBp: 550 },
  ])

  assert.equal(totaux.totalHt, 17000)
  assert.equal(totaux.totalTva, 2610)
  assert.equal(totaux.totalTtc, 19610)
  assert.deepEqual(
    totaux.details.map((detail) => detail.tauxBp),
    [2000, 1000, 550],
  )
  assert.deepEqual(totaux.details[0], { tauxBp: 2000, baseHt: 10000, tva: 2000 })
})

test('regroupe les lignes de même taux', () => {
  const totaux = calculerTotaux([
    { baseHt: cents(1000), tauxBp: 2000 },
    { baseHt: cents(2000), tauxBp: 2000 },
  ])
  assert.equal(totaux.details.length, 1)
  assert.deepEqual(totaux.details[0], { tauxBp: 2000, baseHt: 3000, tva: 600 })
})

test('le TTC est toujours égal à HT + TVA', () => {
  const totaux = calculerTotaux([
    { baseHt: cents(1234), tauxBp: 550 },
    { baseHt: cents(987), tauxBp: 2000 },
  ])
  assert.equal(totaux.totalTtc, totaux.totalHt + totaux.totalTva)
})

test('gère un document vide', () => {
  const totaux = calculerTotaux([])
  assert.equal(totaux.totalHt, 0)
  assert.equal(totaux.totalTva, 0)
  assert.equal(totaux.totalTtc, 0)
  assert.deepEqual(totaux.details, [])
})

test('refuse un taux hors bornes ou non entier', () => {
  assert.throws(() => calculerTva(cents(100), -1), /Taux de TVA invalide/)
  assert.throws(() => calculerTva(cents(100), 10001), /Taux de TVA invalide/)
  assert.throws(() => calculerTva(cents(100), 12.5), /Taux de TVA invalide/)
})

test('refuse une base négative ou non entière', () => {
  assert.throws(() => calculerTva(cents(-100), 2000), /négative/)
  assert.throws(() => calculerTva(100.5 as never, 2000), /entier de centimes/)
})

test('retrouve le HT depuis un TTC', () => {
  assert.equal(htDepuisTtc(cents(12000), 2000), 10000)
  assert.equal(tvaDepuisTtc(cents(12000), 2000), 2000)
})

test('arrondit correctement la conversion TTC → HT', () => {
  // 39,99 € TTC à 20 % → 33,325 € HT → 33,33 €
  assert.equal(htDepuisTtc(cents(3999), 2000), 3333)
  assert.equal(tvaDepuisTtc(cents(3999), 2000), 666)
})

test('identifie les taux français usuels', () => {
  assert.equal(estTauxFrancais(2000), true)
  assert.equal(estTauxFrancais(550), true)
  assert.equal(estTauxFrancais(1234), false)
  assert.equal(estTauxValide(0), true)
  assert.equal(estTauxValide(10000), true)
})
