/**
 * CFONB 120 Parser
 *
 * Parse le format CFONB 120 (Comite Francais d'Organisation et de
 * Normalisation Bancaires), standard francais pour les releves bancaires
 * electroniques. Enregistrements a longueur fixe de 120 caracteres.
 *
 * Record types:
 * - 01: Ancien solde (ouverture)
 * - 04: Detail operation
 * - 05: Complement d'information
 * - 07: Nouveau solde (cloture)
 */

// ============ Types ============

export interface CFONBStatement {
  bankCode: string
  branchCode: string
  accountNumber: string
  currency: string
  openingBalance: number
  openingDate: string
  closingBalance: number
  closingDate: string
  transactions: CFONBTransaction[]
}

export interface CFONBTransaction {
  date: string
  valueDate: string
  amount: number
  label: string
  reference: string
  operationCode: string
  complement?: string
}

// ============ CFONB Sign Decoding ============

/**
 * CFONB encode le signe du montant dans le dernier caractere.
 * Positif: { = 0, A = 1, B = 2, ... I = 9
 * Negatif: } = 0, J = 1, K = 2, ... R = 9
 */
const POSITIVE_SIGNS: Record<string, number> = {
  '{': 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
}

const NEGATIVE_SIGNS: Record<string, number> = {
  '}': 0, J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
}

function decodeCFONBAmount(raw: string): number {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('Montant CFONB vide')
  }

  const lastChar = trimmed[trimmed.length - 1]
  const digits = trimmed.slice(0, -1)

  // Try positive
  if (lastChar in POSITIVE_SIGNS) {
    const intPart = digits + POSITIVE_SIGNS[lastChar].toString()
    return parseInt(intPart, 10) / 100
  }

  // Try negative
  if (lastChar in NEGATIVE_SIGNS) {
    const intPart = digits + NEGATIVE_SIGNS[lastChar].toString()
    return -(parseInt(intPart, 10) / 100)
  }

  // Pure numeric (no sign encoding)
  const parsed = parseInt(trimmed, 10)
  if (isNaN(parsed)) {
    throw new Error(`Montant CFONB non valide: ${raw}`)
  }
  return parsed / 100
}

// ============ Date Parsing ============

function parseCFONBDate(ddmmyy: string): string {
  if (ddmmyy.length !== 6) {
    throw new Error(`Date CFONB invalide: ${ddmmyy}`)
  }
  const day = ddmmyy.slice(0, 2)
  const month = ddmmyy.slice(2, 4)
  const yearShort = ddmmyy.slice(4, 6)
  const year = parseInt(yearShort, 10) > 50 ? '19' + yearShort : '20' + yearShort
  return `${year}-${month}-${day}`
}

// ============ Detection ============

/**
 * Detecte si un contenu est au format CFONB 120.
 * Verifie que les lignes font 120 caracteres et commencent par 01, 04, 05 ou 07.
 */
export function isCFONB120(content: string): boolean {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) return false

  // Au moins 3 lignes de 120 caracteres
  let validLineCount = 0
  let hasRecord01or07 = false

  for (const line of lines) {
    if (line.length !== 120) continue
    const recordType = line.slice(0, 2)
    if (['01', '04', '05', '07'].includes(recordType)) {
      validLineCount++
      if (recordType === '01' || recordType === '07') {
        hasRecord01or07 = true
      }
    }
  }

  return validLineCount >= 2 && hasRecord01or07
}

// ============ Main Parser ============

/**
 * Parse un fichier CFONB 120.
 *
 * Structure des enregistrements (positions 1-based):
 * Record 01 (Ancien solde):
 *   1-2: Code enregistrement (01)
 *   3-6: Code banque
 *   7-11: Code guichet (branche)
 *   12-22: Numero de compte
 *   23-24: Code devise ISO (lettres)
 *   25-26: Nb decimales devise
 *   29-34: Date (DDMMYY)
 *   91-104: Montant (14 positions, signe sur dernier)
 *
 * Record 04 (Detail operation):
 *   1-2: Code enregistrement (04)
 *   3-6: Code banque
 *   7-11: Code guichet
 *   12-22: Numero de compte
 *   23-24: Code operation
 *   25-28: Interne
 *   29-34: Date operation (DDMMYY)
 *   35-36: Code rejet
 *   37-40: Date valeur (?? ou DDMM)
 *   49-79: Libelle (31 chars)
 *   82-88: Numero reference
 *   91-104: Montant
 *   105-110: Date valeur complete (DDMMYY)
 *
 * Record 05 (Complement):
 *   1-2: Code enregistrement (05)
 *   49-118: Complement d'information
 *
 * Record 07 (Nouveau solde):
 *   Meme structure que 01, mais solde de cloture
 */
export function parseCFONB120(content: string): CFONBStatement {
  const lines = content.split(/\r?\n/).filter((l) => l.length === 120)

  if (lines.length === 0) {
    throw new Error('Aucune ligne CFONB 120 valide trouvee (lignes de 120 caracteres attendues)')
  }

  const statement: CFONBStatement = {
    bankCode: '',
    branchCode: '',
    accountNumber: '',
    currency: '',
    openingBalance: 0,
    openingDate: '',
    closingBalance: 0,
    closingDate: '',
    transactions: [],
  }

  let currentTransaction: CFONBTransaction | null = null

  for (const line of lines) {
    const recordType = line.slice(0, 2)

    switch (recordType) {
      case '01': {
        // Ancien solde (ouverture)
        statement.bankCode = line.slice(2, 7).trim()
        statement.branchCode = line.slice(7, 12).trim()
        statement.accountNumber = line.slice(12, 23).trim()
        statement.currency = line.slice(23, 26).trim()
        statement.openingDate = parseCFONBDate(line.slice(34, 40))
        statement.openingBalance = decodeCFONBAmount(line.slice(90, 104))
        break
      }

      case '04': {
        // Flush previous transaction
        if (currentTransaction) {
          statement.transactions.push(currentTransaction)
        }

        const operationCode = line.slice(22, 24).trim()
        const dateOp = parseCFONBDate(line.slice(28, 34))
        const label = line.slice(48, 79).trim()
        const reference = line.slice(81, 88).trim()
        const amount = decodeCFONBAmount(line.slice(90, 104))

        // Value date: try full date at positions 105-110, else use operation date
        let valueDate = dateOp
        const valueDateStr = line.slice(104, 110).trim()
        if (valueDateStr.length === 6 && /^\d{6}$/.test(valueDateStr)) {
          valueDate = parseCFONBDate(valueDateStr)
        }

        currentTransaction = {
          date: dateOp,
          valueDate,
          amount,
          label,
          reference,
          operationCode,
        }
        break
      }

      case '05': {
        // Complement d'information - attach to current transaction
        if (currentTransaction) {
          const complement = line.slice(48, 118).trim()
          if (complement) {
            currentTransaction.complement = currentTransaction.complement
              ? currentTransaction.complement + ' ' + complement
              : complement
          }
        }
        break
      }

      case '07': {
        // Nouveau solde (cloture) - flush last transaction
        if (currentTransaction) {
          statement.transactions.push(currentTransaction)
          currentTransaction = null
        }
        statement.closingDate = parseCFONBDate(line.slice(34, 40))
        statement.closingBalance = decodeCFONBAmount(line.slice(90, 104))
        break
      }
    }
  }

  // Flush trailing transaction if no record 07 was found
  if (currentTransaction) {
    statement.transactions.push(currentTransaction)
  }

  if (statement.transactions.length === 0) {
    throw new Error('Aucune transaction trouvee dans le fichier CFONB')
  }

  return statement
}
