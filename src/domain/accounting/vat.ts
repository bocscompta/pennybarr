/**
 * TVA française — couche domaine pure.
 *
 * Les taux sont exprimés en points de base (2000 = 20 %) pour rester en
 * arithmétique entière. L'arrondi est commercial (demi vers le haut) et
 * appliqué ligne par ligne : le total du document est la somme des lignes,
 * comme l'exige une facture détaillée.
 */

import { applyBasisPoints, cents, sumCents, type Cents } from '../money.ts'

/** Taux de TVA français en points de base. */
export const TAUX_TVA_FR = {
  /** Taux normal 20 % */
  NORMAL: 2000,
  /** Taux intermédiaire 10 % */
  INTERMEDIAIRE: 1000,
  /** Taux réduit 5,5 % */
  REDUIT: 550,
  /** Taux particulier 2,1 % */
  PARTICULIER: 210,
} as const

export type TauxTvaFr = (typeof TAUX_TVA_FR)[keyof typeof TAUX_TVA_FR]

const TAUX_CONNUS: readonly number[] = Object.values(TAUX_TVA_FR)

/** Vrai si le taux est un entier de points de base entre 0 et 100 %. */
export function estTauxValide(tauxBp: number): boolean {
  return Number.isInteger(tauxBp) && tauxBp >= 0 && tauxBp <= 10_000
}

/** Vrai si le taux correspond à un taux français usuel. */
export function estTauxFrancais(tauxBp: number): boolean {
  return TAUX_CONNUS.includes(tauxBp)
}

export interface LigneTvaInput {
  /** Base hors taxes de la ligne, en centimes. */
  baseHt: Cents
  /** Taux de TVA en points de base. */
  tauxBp: number
}

export interface DetailParTaux {
  tauxBp: number
  baseHt: Cents
  tva: Cents
}

export interface TotauxTva {
  totalHt: Cents
  totalTva: Cents
  totalTtc: Cents
  /** Ventilation par taux, du taux le plus élevé au plus faible. */
  details: DetailParTaux[]
}

function verifierTauxEtBase(baseHt: Cents, tauxBp: number): void {
  if (!estTauxValide(tauxBp)) {
    throw new Error(
      `Taux de TVA invalide : ${tauxBp} (points de base entiers entre 0 et 10000 attendus)`,
    )
  }
  if (!Number.isSafeInteger(baseHt)) {
    throw new Error('La base hors taxes doit être un entier de centimes')
  }
  if (baseHt < 0) {
    throw new Error('La base hors taxes ne peut pas être négative')
  }
}

/** Calcule la TVA d'une ligne à partir de sa base hors taxes. */
export function calculerTva(baseHt: Cents, tauxBp: number): Cents {
  verifierTauxEtBase(baseHt, tauxBp)
  return applyBasisPoints(baseHt, tauxBp)
}

/**
 * Calcule les totaux d'un document : TVA par ligne, ventilation par taux,
 * totaux HT/TVA/TTC. Le TTC est toujours la somme exacte HT + TVA.
 */
export function calculerTotaux(lignes: readonly LigneTvaInput[]): TotauxTva {
  const parTaux = new Map<number, { baseHt: number; tva: number }>()
  let totalHt = 0
  let totalTva = 0

  for (const ligne of lignes) {
    verifierTauxEtBase(ligne.baseHt, ligne.tauxBp)
    const tva = applyBasisPoints(ligne.baseHt, ligne.tauxBp)

    const cumul = parTaux.get(ligne.tauxBp) ?? { baseHt: 0, tva: 0 }
    cumul.baseHt += ligne.baseHt
    cumul.tva += tva
    parTaux.set(ligne.tauxBp, cumul)

    totalHt += ligne.baseHt
    totalTva += tva
  }

  const details = [...parTaux.entries()]
    .map(([tauxBp, cumul]) => ({
      tauxBp,
      baseHt: cents(cumul.baseHt),
      tva: cents(cumul.tva),
    }))
    .sort((a, b) => b.tauxBp - a.tauxBp)

  return {
    totalHt: cents(totalHt),
    totalTva: cents(totalTva),
    totalTtc: cents(totalHt + totalTva),
    details,
  }
}

/**
 * Retrouve la base hors taxes à partir d'un montant TTC (cas d'une facture
 * dont seul le TTC est connu), avec arrondi commercial.
 */
export function htDepuisTtc(ttc: Cents, tauxBp: number): Cents {
  if (!estTauxValide(tauxBp)) {
    throw new Error(
      `Taux de TVA invalide : ${tauxBp} (points de base entiers entre 0 et 10000 attendus)`,
    )
  }
  if (!Number.isSafeInteger(ttc) || ttc < 0) {
    throw new Error('Le montant TTC doit être un entier de centimes positif')
  }

  const numerateur = ttc * 10_000
  if (!Number.isSafeInteger(numerateur)) {
    throw new Error('Montant trop élevé pour un calcul de TVA exact')
  }

  return cents(Math.round(numerateur / (10_000 + tauxBp)))
}

/** Calcule la TVA contenue dans un montant TTC. */
export function tvaDepuisTtc(ttc: Cents, tauxBp: number): Cents {
  return cents(ttc - htDepuisTtc(ttc, tauxBp))
}
