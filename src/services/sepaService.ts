// SEPA Service - Generation de fichiers SEPA XML ISO 20022
// pain.001.003.03 (virements) et pain.008.003.02 (prelevements)
import { supabase, COMPANY_ID } from '../lib/supabase'

// ============ Types ============

export interface SEPAPayment {
  creditorName: string
  creditorIBAN: string
  creditorBIC: string
  amount: number
  currency: 'EUR'
  reference: string           // Reference facture
  endToEndId: string          // Identifiant unique
  executionDate: string       // Date d'execution souhaitee (YYYY-MM-DD)
}

export interface SEPADirectDebit {
  debtorName: string
  debtorIBAN: string
  debtorBIC: string
  amount: number
  mandateId: string           // Reference du mandat SEPA
  mandateDate: string         // Date de signature du mandat (YYYY-MM-DD)
  reference: string
  executionDate: string
}

export interface SEPABatch {
  id: string
  type: 'transfer' | 'direct_debit'
  createdAt: string
  executionDate: string
  totalAmount: number
  paymentCount: number
  status: 'pending' | 'generated' | 'sent' | 'executed'
  filename: string
  payments: SEPABatchPayment[]
}

export interface SEPABatchPayment {
  invoiceId: string
  invoiceNumber: string
  thirdPartyName: string
  iban: string
  bic: string
  amount: number
  reference: string
}

export interface CompanyBankInfo {
  name: string
  iban: string
  bic: string
  creditorId?: string  // ICS pour les prelevements
}

// ============ Validation IBAN/BIC ============

/**
 * Valider un code IBAN
 * Algorithme: deplacer les 4 premiers caracteres a la fin, convertir lettres en chiffres, modulo 97
 */
export function validateIBAN(iban: string): boolean {
  if (!iban) return false

  // Normaliser: retirer espaces et mettre en majuscules
  const normalized = iban.replace(/\s/g, '').toUpperCase()

  // Verifier la longueur minimale et format (lettres puis chiffres)
  if (normalized.length < 15 || normalized.length > 34) return false
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(normalized)) return false

  // Deplacer les 4 premiers caracteres a la fin
  const rearranged = normalized.slice(4) + normalized.slice(0, 4)

  // Convertir les lettres en chiffres (A=10, B=11, etc.)
  let numericString = ''
  for (const char of rearranged) {
    if (/[A-Z]/.test(char)) {
      numericString += (char.charCodeAt(0) - 55).toString()
    } else {
      numericString += char
    }
  }

  // Calculer modulo 97 (par segments pour eviter overflow)
  let remainder = 0
  for (let i = 0; i < numericString.length; i += 7) {
    const segment = remainder.toString() + numericString.slice(i, i + 7)
    remainder = parseInt(segment, 10) % 97
  }

  return remainder === 1
}

/**
 * Valider un code BIC/SWIFT
 * Format: 8 ou 11 caracteres (AAAABBCC[DDD])
 */
export function validateBIC(bic: string): boolean {
  if (!bic) return false

  const normalized = bic.replace(/\s/g, '').toUpperCase()

  // BIC doit faire 8 ou 11 caracteres
  if (normalized.length !== 8 && normalized.length !== 11) return false

  // Format: 4 lettres (banque) + 2 lettres (pays) + 2 alphanum (ville) + 3 alphanum optionnel (agence)
  const bicRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/
  return bicRegex.test(normalized)
}

/**
 * Formater un IBAN avec espaces (groupes de 4)
 */
export function formatIBAN(iban: string): string {
  if (!iban) return ''
  const normalized = iban.replace(/\s/g, '').toUpperCase()
  return normalized.match(/.{1,4}/g)?.join(' ') || normalized
}

/**
 * Normaliser un IBAN (retirer espaces, majuscules)
 */
export function normalizeIBAN(iban: string): string {
  if (!iban) return ''
  return iban.replace(/\s/g, '').toUpperCase()
}

// ============ Generation XML SEPA ============

/**
 * Generer un identifiant unique de message
 */
function generateMessageId(): string {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `MSG-${timestamp}-${random}`
}

/**
 * Generer un identifiant EndToEnd unique
 */
export function generateEndToEndId(invoiceNumber: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const cleanRef = invoiceNumber.replace(/[^A-Z0-9]/gi, '').substring(0, 20)
  return `${cleanRef}-${timestamp}`.substring(0, 35)
}

/**
 * Formater une date-heure au format ISO avec timezone
 */
function formatDateTimeISO(date: Date): string {
  return date.toISOString()
}

/**
 * Nettoyer une chaine pour XML SEPA (caracteres autorises)
 * Supprime les caracteres non autorises et limite la longueur
 */
function cleanSEPAString(str: string, maxLength: number): string {
  if (!str) return ''
  // Caracteres autorises: a-z A-Z 0-9 / - ? : ( ) . , ' + espace
  const cleaned = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
    .replace(/[^a-zA-Z0-9\/\-?:().,'+\s]/g, '')
    .trim()
  return cleaned.substring(0, maxLength)
}

/**
 * Generer un fichier XML de virement SEPA (pain.001.003.03)
 * Credit Transfer Initiation
 */
export function generateSEPATransferXML(
  payments: SEPAPayment[],
  debtorName: string,
  debtorIBAN: string,
  debtorBIC: string,
  batchBooking: boolean = true
): string {
  if (payments.length === 0) {
    throw new Error('Aucun paiement a inclure dans le fichier SEPA')
  }

  // Validation IBAN/BIC emetteur
  if (!validateIBAN(debtorIBAN)) {
    throw new Error(`IBAN emetteur invalide: ${debtorIBAN}`)
  }
  if (!validateBIC(debtorBIC)) {
    throw new Error(`BIC emetteur invalide: ${debtorBIC}`)
  }

  const messageId = generateMessageId()
  const creationDateTime = formatDateTimeISO(new Date())
  const numberOfTransactions = payments.length
  const controlSum = payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)

  // Grouper les paiements par date d'execution
  const executionDate = payments[0].executionDate

  // Construire le XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <InitgPty>
        <Nm>${cleanSEPAString(debtorName, 70)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${messageId}-PMT</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>${batchBooking ? 'true' : 'false'}</BtchBookg>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${executionDate}</ReqdExctnDt>
      <Dbtr>
        <Nm>${cleanSEPAString(debtorName, 70)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${normalizeIBAN(debtorIBAN)}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${debtorBIC.replace(/\s/g, '').toUpperCase()}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>`

  // Ajouter chaque transaction
  for (const payment of payments) {
    // Valider IBAN/BIC beneficiaire
    if (!validateIBAN(payment.creditorIBAN)) {
      throw new Error(`IBAN beneficiaire invalide pour ${payment.creditorName}: ${payment.creditorIBAN}`)
    }
    if (!validateBIC(payment.creditorBIC)) {
      throw new Error(`BIC beneficiaire invalide pour ${payment.creditorName}: ${payment.creditorBIC}`)
    }

    xml += `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${cleanSEPAString(payment.endToEndId, 35)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${payment.currency}">${payment.amount.toFixed(2)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <BIC>${payment.creditorBIC.replace(/\s/g, '').toUpperCase()}</BIC>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${cleanSEPAString(payment.creditorName, 70)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${normalizeIBAN(payment.creditorIBAN)}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${cleanSEPAString(payment.reference, 140)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`
  }

  xml += `
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`

  return xml
}

/**
 * Generer un fichier XML de prelevement SEPA (pain.008.003.02)
 * Direct Debit Initiation
 */
export function generateSEPADirectDebitXML(
  directDebits: SEPADirectDebit[],
  creditorName: string,
  creditorIBAN: string,
  creditorBIC: string,
  creditorId: string,         // ICS (Identifiant Creancier SEPA)
  sequenceType: 'FRST' | 'RCUR' | 'FNAL' | 'OOFF' = 'RCUR'
): string {
  if (directDebits.length === 0) {
    throw new Error('Aucun prelevement a inclure dans le fichier SEPA')
  }

  // Validation IBAN/BIC creancier
  if (!validateIBAN(creditorIBAN)) {
    throw new Error(`IBAN creancier invalide: ${creditorIBAN}`)
  }
  if (!validateBIC(creditorBIC)) {
    throw new Error(`BIC creancier invalide: ${creditorBIC}`)
  }
  if (!creditorId) {
    throw new Error('Identifiant Creancier SEPA (ICS) requis')
  }

  const messageId = generateMessageId()
  const creationDateTime = formatDateTimeISO(new Date())
  const numberOfTransactions = directDebits.length
  const controlSum = directDebits.reduce((sum, d) => sum + d.amount, 0).toFixed(2)
  const executionDate = directDebits[0].executionDate

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.003.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <InitgPty>
        <Nm>${cleanSEPAString(creditorName, 70)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${messageId}-PMT</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>${sequenceType}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${executionDate}</ReqdColltnDt>
      <Cdtr>
        <Nm>${cleanSEPAString(creditorName, 70)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${normalizeIBAN(creditorIBAN)}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <BIC>${creditorBIC.replace(/\s/g, '').toUpperCase()}</BIC>
        </FinInstnId>
      </CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${creditorId}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>`

  // Ajouter chaque transaction de prelevement
  for (const dd of directDebits) {
    if (!validateIBAN(dd.debtorIBAN)) {
      throw new Error(`IBAN debiteur invalide pour ${dd.debtorName}: ${dd.debtorIBAN}`)
    }
    if (!validateBIC(dd.debtorBIC)) {
      throw new Error(`BIC debiteur invalide pour ${dd.debtorName}: ${dd.debtorBIC}`)
    }

    xml += `
      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${cleanSEPAString(dd.reference, 35)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${dd.amount.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${cleanSEPAString(dd.mandateId, 35)}</MndtId>
            <DtOfSgntr>${dd.mandateDate}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <BIC>${dd.debtorBIC.replace(/\s/g, '').toUpperCase()}</BIC>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${cleanSEPAString(dd.debtorName, 70)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${normalizeIBAN(dd.debtorIBAN)}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${cleanSEPAString(dd.reference, 140)}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`
  }

  xml += `
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`

  return xml
}

// ============ Integration avec les factures fournisseurs ============

/**
 * Recuperer les factures fournisseurs a payer (non payees avec IBAN)
 */
export async function getPayableSupplierInvoices(): Promise<{
  id: string
  number: string
  date: string
  dueDate: string | null
  totalTTC: number
  thirdParty: {
    id: string
    name: string
    iban: string | null
    bic: string | null
  }
}[]> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      id,
      number,
      date,
      due_date,
      total_ttc,
      third_party:third_parties(id, name, iban, bic)
    `)
    .eq('company_id', COMPANY_ID)
    .eq('type', 'supplier')
    .in('status', ['sent', 'draft'])  // Non payees
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching payable invoices:', error)
    throw new Error(`Erreur chargement factures: ${error.message}`)
  }

  return (invoices || []).map(inv => {
    // Supabase peut retourner un tableau ou un objet pour la relation
    const tp = Array.isArray(inv.third_party) ? inv.third_party[0] : inv.third_party
    return {
      id: inv.id,
      number: inv.number,
      date: inv.date,
      dueDate: inv.due_date,
      totalTTC: inv.total_ttc,
      thirdParty: {
        id: tp?.id || '',
        name: tp?.name || 'Inconnu',
        iban: tp?.iban || null,
        bic: tp?.bic || null,
      }
    }
  })
}

/**
 * Generer un lot de paiements SEPA depuis une selection de factures
 */
export async function generatePaymentBatchFromInvoices(
  invoiceIds: string[],
  executionDate: string
): Promise<{ xml: string; payments: SEPAPayment[] }> {
  if (invoiceIds.length === 0) {
    throw new Error('Aucune facture selectionnee')
  }

  // Recuperer les factures selectionnees avec IBAN/BIC des fournisseurs
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select(`
      id,
      number,
      total_ttc,
      third_party:third_parties(id, name, iban, bic)
    `)
    .in('id', invoiceIds)
    .eq('company_id', COMPANY_ID)

  if (invError) {
    console.error('Error fetching invoices:', invError)
    throw new Error(`Erreur chargement factures: ${invError.message}`)
  }

  if (!invoices || invoices.length === 0) {
    throw new Error('Aucune facture trouvee')
  }

  // Recuperer les coordonnees bancaires de l'entreprise
  const { data: companyBank, error: companyError } = await supabase
    .from('bank_accounts')
    .select('name, iban, bic')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .not('iban', 'is', null)
    .limit(1)
    .single()

  if (companyError || !companyBank) {
    console.error('Error fetching company bank:', companyError)
    throw new Error('Aucun compte bancaire avec IBAN configure pour cette entreprise')
  }

  // Recuperer le nom de l'entreprise
  const { data: company, error: coError } = await supabase
    .from('companies')
    .select('name')
    .eq('id', COMPANY_ID)
    .single()

  if (coError) {
    console.error('Error fetching company:', coError)
    throw new Error(`Erreur chargement entreprise: ${coError.message}`)
  }

  // Construire les paiements
  const payments: SEPAPayment[] = []
  const errors: string[] = []

  for (const inv of invoices) {
    // Supabase peut retourner un tableau ou un objet pour la relation
    const tp = Array.isArray(inv.third_party) ? inv.third_party[0] : inv.third_party

    if (!tp?.iban || !tp?.bic) {
      errors.push(`${tp?.name || 'Inconnu'} (${inv.number}): IBAN/BIC manquant`)
      continue
    }

    payments.push({
      creditorName: tp.name || 'Inconnu',
      creditorIBAN: tp.iban,
      creditorBIC: tp.bic,
      amount: inv.total_ttc,
      currency: 'EUR',
      reference: `Paiement facture ${inv.number}`,
      endToEndId: generateEndToEndId(inv.number),
      executionDate,
    })
  }

  if (errors.length > 0) {
    throw new Error(`Coordonnees bancaires manquantes:\n${errors.join('\n')}`)
  }

  if (payments.length === 0) {
    throw new Error('Aucun paiement valide a generer')
  }

  // Generer le XML
  const xml = generateSEPATransferXML(
    payments,
    company.name,
    companyBank.iban,
    companyBank.bic
  )

  return { xml, payments }
}

// ============ Historique des lots ============

/**
 * Sauvegarder un lot SEPA genere
 */
export async function saveSEPABatch(
  type: 'transfer' | 'direct_debit',
  executionDate: string,
  payments: SEPABatchPayment[],
  filename: string
): Promise<string> {
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

  const { data, error } = await supabase
    .from('sepa_batches')
    .insert({
      company_id: COMPANY_ID,
      type,
      execution_date: executionDate,
      total_amount: totalAmount,
      payment_count: payments.length,
      status: 'generated',
      filename,
      payments: payments,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving SEPA batch:', error)
    throw new Error(`Erreur sauvegarde lot SEPA: ${error.message}`)
  }

  return data.id
}

/**
 * Recuperer l'historique des lots SEPA
 */
export async function getSEPABatchHistory(limit: number = 50): Promise<SEPABatch[]> {
  const { data, error } = await supabase
    .from('sepa_batches')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching SEPA batch history:', error)
    throw new Error(`Erreur chargement historique SEPA: ${error.message}`)
  }

  return (data || []).map(b => ({
    id: b.id,
    type: b.type,
    createdAt: b.created_at,
    executionDate: b.execution_date,
    totalAmount: b.total_amount,
    paymentCount: b.payment_count,
    status: b.status,
    filename: b.filename,
    payments: b.payments || [],
  }))
}

/**
 * Mettre a jour le statut d'un lot SEPA
 */
export async function updateSEPABatchStatus(
  batchId: string,
  status: SEPABatch['status']
): Promise<void> {
  const { error } = await supabase
    .from('sepa_batches')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error updating SEPA batch status:', error)
    throw new Error(`Erreur mise a jour statut: ${error.message}`)
  }
}

// ============ Telechargement ============

/**
 * Telecharger un fichier SEPA XML
 */
export function downloadSEPAFile(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xml') ? filename : `${filename}.xml`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Generer un nom de fichier SEPA standard
 */
export function generateSEPAFilename(type: 'transfer' | 'direct_debit', executionDate: string): string {
  const prefix = type === 'transfer' ? 'VIR' : 'PREL'
  const dateStr = executionDate.replace(/-/g, '')
  const timestamp = Date.now().toString(36).toUpperCase()
  return `SEPA_${prefix}_${dateStr}_${timestamp}.xml`
}
