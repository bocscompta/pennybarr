/**
 * Service de taux de change - API BCE (Banque Centrale Européenne)
 * Utilise l'API Frankfurter (gratuite, données BCE)
 */

// Cache en mémoire: clé = "FROM-TO-DATE", valeur = taux
const rateCache = new Map<string, number>()

/**
 * Récupère le taux de change depuis l'API BCE (via Frankfurter)
 * @param from Devise source (ex: 'USD')
 * @param to Devise cible (ex: 'EUR')
 * @param date Date au format YYYY-MM-DD
 * @returns Taux de change (ex: 0.8508 pour 1 USD = 0.8508 EUR)
 */
export async function getExchangeRate(
  from: string,
  to: string,
  date: string
): Promise<number> {
  if (from === to) return 1

  const cacheKey = `${from}-${to}-${date}`
  const cached = rateCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const url = `https://api.frankfurter.app/${date}?from=${from}&to=${to}`
  const response = await fetch(url)

  if (!response.ok) {
    const text = await response.text()
    console.error('Exchange rate API error:', response.status, text)
    throw new Error(`Erreur API taux de change BCE: ${response.status} - ${text}`)
  }

  const data = await response.json()

  if (!data.rates || data.rates[to] === undefined) {
    console.error('Exchange rate API: missing rate in response', data)
    throw new Error(`Taux de change ${from}→${to} non disponible pour le ${date}`)
  }

  const rate = data.rates[to] as number
  rateCache.set(cacheKey, rate)

  // Cache aussi l'inverse
  const inverseKey = `${to}-${from}-${date}`
  if (!rateCache.has(inverseKey)) {
    rateCache.set(inverseKey, 1 / rate)
  }

  console.log(`[ExchangeRate] ${from}→${to} au ${date}: ${rate}`)
  return rate
}

/**
 * Convertit un montant d'une devise à une autre
 * @param amount Montant à convertir
 * @param from Devise source
 * @param to Devise cible
 * @param date Date pour le taux
 * @returns Montant converti arrondi à 2 décimales
 */
export async function convertAmount(
  amount: number,
  from: string,
  to: string,
  date: string
): Promise<number> {
  if (from === to) return amount
  const rate = await getExchangeRate(from, to, date)
  return Math.round(amount * rate * 100) / 100
}

/**
 * Convertit un montant avec un taux donné (sans appel API)
 * @param amount Montant à convertir
 * @param rate Taux de change
 * @returns Montant converti arrondi à 2 décimales
 */
export function convertAmountWithRate(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100
}
