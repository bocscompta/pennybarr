/**
 * Montants monétaires — couche domaine pure, sans dépendance.
 *
 * Règle du projet : aucun montant en euros flottants. Tout est exprimé en
 * centimes entiers (type `Cents`), et les calculs restent entiers autant que
 * possible. Le seul passage en flottant autorisé est l'affichage
 * (`formatCents`), pour un montant très inférieur à 2^52 centimes.
 */

const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER

/**
 * Montant en centimes entiers. Type nominal : impossible de confondre un
 * montant en centimes avec un montant en euros ou un nombre quelconque.
 */
export type Cents = number & { readonly __cents: unique symbol }

/** Convertit un entier de centimes en `Cents`, en refusant tout non-entier. */
export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Montant en centimes invalide : ${value} (entier attendu)`)
  }
  return value as Cents
}

/** Somme de montants en centimes (entiers, résultat exact). */
export function sumCents(values: readonly Cents[]): Cents {
  return cents(values.reduce((total, value) => total + value, 0))
}

/**
 * Parse un montant saisi par l'utilisateur vers des centimes.
 *
 * Formats acceptés : « 1234,56 », « 1 234,56 », « 1 234.56 », « -12,5 ».
 * Refusé : plus de deux décimales, séparateurs de milliers mélangés à la
 * virgule, texte, notation exponentielle.
 */
export function parseAmountToCents(input: string): Cents {
  const trimmed = input.trim()
  if (trimmed === '') {
    throw new Error('Montant vide')
  }

  const pattern = /^-?\d[\d\u00A0\u202F ]*(?:[.,]\d{1,2})?$/
  if (!pattern.test(trimmed)) {
    throw new Error(`Montant invalide : « ${input} » (ex. attendu : 1 234,56)`)
  }

  const negative = trimmed.startsWith('-')
  const body = negative ? trimmed.slice(1) : trimmed
  const normalized = body.replace(/[\u00A0\u202F ]/g, '').replace(',', '.')
  const [unitsPart, decimalsPart = ''] = normalized.split('.')
  const units = Number(unitsPart)
  const decimals = Number((decimalsPart + '00').slice(0, 2))
  const value = units * 100 + decimals

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Montant hors limites : « ${input} »`)
  }

  return cents(negative ? -value : value)
}

const eurosFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formate un montant en centimes au format français, ex. « 1 234,56 € ». */
export function formatCents(value: Cents): string {
  return `${eurosFormatter.format(value / 100)} €`
}

/**
 * Applique un taux exprimé en points de base (2000 = 20 %) avec arrondi
 * commercial (demi vers le haut) et retourne des centimes.
 *
 * Le produit `montant × points de base` doit rester inférieur à 2^53, ce qui
 * couvre très largement les montants d'une comptabilité d'entreprise.
 */
export function applyBasisPoints(amount: Cents, basisPoints: number): Cents {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new Error(`Taux invalide : ${basisPoints} (points de base entiers attendus)`)
  }

  const product = amount * basisPoints
  if (!Number.isSafeInteger(product)) {
    throw new Error('Montant trop élevé pour un calcul de taux exact')
  }

  const sign = Math.sign(product)
  const rounded = sign * Math.round(Math.abs(product) / 10_000)
  return cents(rounded)
}

/**
 * Répartit un montant au prorata de poids entiers, sans perte d'arrondi.
 *
 * Méthode des plus forts restes : la somme des parts est toujours exactement
 * égale au montant réparti, et aucune part ne diffère de plus d'un centime de
 * sa valeur théorique.
 */
export function allocateProportionally(
  total: Cents,
  weights: readonly number[],
): Cents[] {
  if (weights.length === 0) {
    throw new Error('Au moins un poids est requis pour une répartition')
  }
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 0)) {
    throw new Error('Les poids doivent être des entiers positifs ou nuls')
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight <= 0) {
    throw new Error('La somme des poids doit être strictement positive')
  }

  const exactParts = weights.map((weight) => (total * weight) / totalWeight)
  const floored = exactParts.map((part) => Math.floor(part))
  const allocated = floored.reduce((sum, part) => sum + part, 0)
  let remaining = total - allocated

  const byRemainder = exactParts
    .map((part, index) => ({ index, remainder: part - floored[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  const result = [...floored]
  let cursor = 0
  while (remaining > 0) {
    result[byRemainder[cursor % byRemainder.length].index] += 1
    remaining -= 1
    cursor += 1
  }

  return result.map((part) => cents(part))
}

/** Vrai si les centimes tiennent dans les limites sûres de JavaScript. */
export function isSafeCents(value: number): boolean {
  return Number.isSafeInteger(value) && Math.abs(value) <= MAX_SAFE_CENTS
}
