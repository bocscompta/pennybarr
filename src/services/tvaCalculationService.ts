/**
 * Service de calcul TVA pour les déclarations fiscales
 * Calcule les montants TVA à partir des écritures comptables
 */

import { supabase, COMPANY_ID } from '../lib/supabase'

// Types pour les données TVA
export interface TVACalculationResult {
  // Identification
  companyName: string
  siren: string
  addressLine1: string
  addressLine2: string
  postalCode: string
  city: string

  // Période
  periodStart: Date
  periodEnd: Date

  // I - TVA BRUTE
  // Opérations non taxées
  ligne01AchatsEnFranchise: number      // Achats en franchise (0037)
  ligne02ExportationsHorsUE: number     // Exportations hors UE (0032)
  ligne03LivraisonsIntracom: number     // Livraisons intracommunautaires (0033)
  ligne04AutresNonImposables: number    // Autres opérations non imposables
  ligne4bVentesAssujettiNonFrance: number // Ventes par assujetti non établi France (0043)

  // Opérations taxables par taux
  ligne06Base20: number
  ligne06TVA20: number
  ligne07Base10: number
  ligne07TVA10: number
  ligne08Base5_5: number
  ligne08TVA5_5: number
  ligne09Base2_1: number
  ligne09TVA2_1: number

  // Acquisitions intracommunautaires
  ligne11AcquisitionsIntracom20: number
  ligne12AcquisitionsIntracom10: number

  // Total TVA brute
  totalTVABrute: number

  // II - TVA DÉDUCTIBLE
  ligne19Immobilisations: number        // TVA sur immobilisations
  ligne20AutresBiensServices: number    // TVA sur autres biens et services
  ligne21Regularisations: number        // Régularisations
  ligne22ReportCreditAnterieur: number  // Report crédit antérieur

  // Total TVA déductible
  totalTVADeductible: number

  // III - TVA NETTE
  tvaNetteDue: number
  creditTVA: number

  // Acomptes et montant final
  acomptesVerses: number
  montantAPayer: number
  remboursementDemande: number
  creditAReporter: number
}

// Comptes comptables TVA selon PCG
const COMPTES_TVA = {
  // TVA collectée (ventes)
  TVA_COLLECTEE_20: '445711',      // TVA collectée 20%
  TVA_COLLECTEE_10: '445712',      // TVA collectée 10%
  TVA_COLLECTEE_5_5: '445713',     // TVA collectée 5,5%
  TVA_COLLECTEE_2_1: '445714',     // TVA collectée 2,1%

  // TVA déductible
  TVA_DEDUCTIBLE_IMMO: '44562',    // TVA déductible sur immobilisations
  TVA_DEDUCTIBLE_ABS: '44566',     // TVA déductible sur autres biens et services
  TVA_DEDUCTIBLE_INTRACOM: '44567', // TVA déductible intracommunautaire

  // Crédit de TVA
  CREDIT_TVA: '44567',             // Crédit de TVA à reporter

  // Comptes de ventes pour calculer les bases
  VENTES_FRANCE_20: ['701', '706', '707'], // Ventes de produits/services France
  VENTES_EXPORT: ['7073'],         // Ventes export
  VENTES_INTRACOM: ['7074'],       // Ventes intracommunautaires

  // Comptes achats/charges pour bases déductibles
  ACHATS: ['60'],                  // Achats
  SERVICES_EXTERIEURS: ['61', '62'], // Services extérieurs
  IMMOBILISATIONS: ['20', '21'],   // Immobilisations
}

/**
 * Récupère les totaux par compte pour une période donnée
 */
async function getAccountTotals(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
  accountPrefixes: string[]
): Promise<{ debit: number; credit: number }> {
  let totalDebit = 0
  let totalCredit = 0

  for (const prefix of accountPrefixes) {
    const { data, error } = await supabase
      .from('accounting_entries')
      .select('debit, credit')
      .eq('company_id', companyId)
      .gte('date', periodStart.toISOString().split('T')[0])
      .lte('date', periodEnd.toISOString().split('T')[0])
      .like('account_code', `${prefix}%`)

    if (error) {
      console.error(`Erreur récupération compte ${prefix}:`, error)
      continue
    }

    if (data) {
      for (const entry of data) {
        totalDebit += Number(entry.debit) || 0
        totalCredit += Number(entry.credit) || 0
      }
    }
  }

  return { debit: totalDebit, credit: totalCredit }
}

/**
 * Récupère le solde d'un compte TVA (crédit - débit pour TVA collectée, débit - crédit pour TVA déductible)
 */
async function getTVAAccountBalance(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
  accountPrefix: string,
  isCollectee: boolean
): Promise<number> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('debit, credit')
    .eq('company_id', companyId)
    .gte('date', periodStart.toISOString().split('T')[0])
    .lte('date', periodEnd.toISOString().split('T')[0])
    .like('account_code', `${accountPrefix}%`)

  if (error) {
    console.error(`Erreur récupération TVA ${accountPrefix}:`, error)
    return 0
  }

  let total = 0
  if (data) {
    for (const entry of data) {
      if (isCollectee) {
        // TVA collectée: crédit - débit (car c'est un passif)
        total += (Number(entry.credit) || 0) - (Number(entry.debit) || 0)
      } else {
        // TVA déductible: débit - crédit (car c'est un actif)
        total += (Number(entry.debit) || 0) - (Number(entry.credit) || 0)
      }
    }
  }

  return Math.max(0, total)
}

/**
 * Calcule la base HT à partir du montant TTC et du taux TVA
 */
function calculateBaseHT(montantTVA: number, tauxTVA: number): number {
  if (tauxTVA === 0) return 0
  return Math.round((montantTVA / tauxTVA * 100) * 100) / 100
}

/**
 * Récupère les informations de l'entreprise
 */
async function getCompanyInfo(companyId: string): Promise<{
  name: string
  siren: string
  address: string
  postalCode: string
  city: string
}> {
  const { data, error } = await supabase
    .from('companies')
    .select('name, siren, address, postal_code, city')
    .eq('id', companyId)
    .single()

  if (error || !data) {
    console.error('Erreur récupération entreprise:', error)
    return {
      name: 'Mon Entreprise',
      siren: '000000000',
      address: '1 RUE EXEMPLE',
      postalCode: '75001',
      city: 'PARIS'
    }
  }

  return {
    name: data.name || 'Mon Entreprise',
    siren: data.siren || '000000000',
    address: data.address || '1 RUE EXEMPLE',
    postalCode: data.postal_code || '75001',
    city: data.city || 'PARIS'
  }
}

/**
 * Calcule les données TVA pour une déclaration CA12 (TVA annuelle simplifiée)
 */
export async function calculateTVACA12(
  companyId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<TVACalculationResult> {
  // Récupérer les infos entreprise
  const companyInfo = await getCompanyInfo(companyId)

  // Calculer TVA collectée par taux
  const tva20 = await getTVAAccountBalance(companyId, periodStart, periodEnd, '445711', true)
  const tva10 = await getTVAAccountBalance(companyId, periodStart, periodEnd, '445712', true)
  const tva5_5 = await getTVAAccountBalance(companyId, periodStart, periodEnd, '445713', true)
  const tva2_1 = await getTVAAccountBalance(companyId, periodStart, periodEnd, '445714', true)

  // Si pas de ventilation par taux, prendre le total 4457
  const tvaCollecteeTotale = await getTVAAccountBalance(companyId, periodStart, periodEnd, '4457', true)

  // Utiliser la TVA totale si pas de détail par taux
  const ligne06TVA20 = tva20 > 0 ? tva20 : tvaCollecteeTotale
  const ligne07TVA10 = tva10
  const ligne08TVA5_5 = tva5_5
  const ligne09TVA2_1 = tva2_1

  // Calculer les bases HT
  const ligne06Base20 = calculateBaseHT(ligne06TVA20, 20)
  const ligne07Base10 = calculateBaseHT(ligne07TVA10, 10)
  const ligne08Base5_5 = calculateBaseHT(ligne08TVA5_5, 5.5)
  const ligne09Base2_1 = calculateBaseHT(ligne09TVA2_1, 2.1)

  // Calculer TVA déductible
  const tvaDeductibleImmo = await getTVAAccountBalance(companyId, periodStart, periodEnd, '44562', false)
  const tvaDeductibleABS = await getTVAAccountBalance(companyId, periodStart, periodEnd, '44566', false)

  // Si pas de détail, prendre le total 4456
  const tvaDeductibleTotale = await getTVAAccountBalance(companyId, periodStart, periodEnd, '4456', false)

  const ligne19Immobilisations = tvaDeductibleImmo > 0 ? tvaDeductibleImmo : 0
  const ligne20AutresBiensServices = tvaDeductibleABS > 0 ? tvaDeductibleABS : (tvaDeductibleTotale - ligne19Immobilisations)

  // Opérations non taxées (exportations, etc.) - à partir des comptes 7073, 7074
  const exportations = await getAccountTotals(companyId, periodStart, periodEnd, ['7073'])
  const livraisons = await getAccountTotals(companyId, periodStart, periodEnd, ['7074'])

  const ligne02ExportationsHorsUE = exportations.credit
  const ligne03LivraisonsIntracom = livraisons.credit

  // Totaux
  const totalTVABrute = ligne06TVA20 + ligne07TVA10 + ligne08TVA5_5 + ligne09TVA2_1
  const totalTVADeductible = ligne19Immobilisations + ligne20AutresBiensServices

  // TVA nette
  const tvaNette = totalTVABrute - totalTVADeductible
  const tvaNetteDue = Math.max(0, tvaNette)
  const creditTVA = Math.max(0, -tvaNette)

  return {
    // Identification
    companyName: companyInfo.name,
    siren: companyInfo.siren,
    addressLine1: companyInfo.address,
    addressLine2: '',
    postalCode: companyInfo.postalCode,
    city: companyInfo.city,

    // Période
    periodStart,
    periodEnd,

    // I - TVA BRUTE - Opérations non taxées
    ligne01AchatsEnFranchise: 0,
    ligne02ExportationsHorsUE,
    ligne03LivraisonsIntracom,
    ligne04AutresNonImposables: 0,
    ligne4bVentesAssujettiNonFrance: 0,

    // Opérations taxables
    ligne06Base20,
    ligne06TVA20,
    ligne07Base10,
    ligne07TVA10,
    ligne08Base5_5,
    ligne08TVA5_5,
    ligne09Base2_1,
    ligne09TVA2_1,

    // Acquisitions intracommunautaires
    ligne11AcquisitionsIntracom20: 0,
    ligne12AcquisitionsIntracom10: 0,

    totalTVABrute,

    // II - TVA DÉDUCTIBLE
    ligne19Immobilisations,
    ligne20AutresBiensServices,
    ligne21Regularisations: 0,
    ligne22ReportCreditAnterieur: 0,

    totalTVADeductible,

    // III - TVA NETTE
    tvaNetteDue,
    creditTVA,

    // Montants finaux
    acomptesVerses: 0,
    montantAPayer: tvaNetteDue,
    remboursementDemande: 0,
    creditAReporter: creditTVA,
  }
}

/**
 * Sauvegarde les données CA12 dans Supabase
 */
export async function saveCA12Data(
  declarationId: string,
  data: TVACalculationResult
): Promise<boolean> {
  const { error } = await supabase
    .from('declaration_ca12_data')
    .upsert({
      declaration_id: declarationId,
      company_name: data.companyName,
      siren: data.siren,
      address_line1: data.addressLine1,
      address_line2: data.addressLine2,
      postal_code: data.postalCode,
      city: data.city,
      period_start: data.periodStart.toISOString().split('T')[0],
      period_end: data.periodEnd.toISOString().split('T')[0],
      ligne_01_achats_franchise: data.ligne01AchatsEnFranchise,
      ligne_02_exportations_hors_ue: data.ligne02ExportationsHorsUE,
      ligne_03_livraisons_intracommunautaires: data.ligne03LivraisonsIntracom,
      ligne_04_autres_operations_non_imposables: data.ligne04AutresNonImposables,
      ligne_4b_ventes_assujetti_non_france: data.ligne4bVentesAssujettiNonFrance,
      ligne_06_base_20: data.ligne06Base20,
      ligne_06_tva_20: data.ligne06TVA20,
      ligne_07_base_10: data.ligne07Base10,
      ligne_07_tva_10: data.ligne07TVA10,
      ligne_08_base_5_5: data.ligne08Base5_5,
      ligne_08_tva_5_5: data.ligne08TVA5_5,
      ligne_09_base_2_1: data.ligne09Base2_1,
      ligne_09_tva_2_1: data.ligne09TVA2_1,
      ligne_11_acquisitions_intracom_20: data.ligne11AcquisitionsIntracom20,
      ligne_12_acquisitions_intracom_10: data.ligne12AcquisitionsIntracom10,
      total_tva_brute: data.totalTVABrute,
      ligne_19_immobilisations: data.ligne19Immobilisations,
      ligne_20_autres_biens_services: data.ligne20AutresBiensServices,
      ligne_21_regularisations: data.ligne21Regularisations,
      ligne_22_report_credit_anterieur: data.ligne22ReportCreditAnterieur,
      total_tva_deductible: data.totalTVADeductible,
      tva_nette_due: data.tvaNetteDue,
      credit_tva: data.creditTVA,
      acomptes_verses: data.acomptesVerses,
      montant_a_payer: data.montantAPayer,
      remboursement_demande: data.remboursementDemande,
      credit_a_reporter: data.creditAReporter,
      calculated_at: new Date().toISOString(),
    }, {
      onConflict: 'declaration_id'
    })

  if (error) {
    console.error('Erreur sauvegarde CA12:', error)
    return false
  }

  return true
}

/**
 * Charge les données CA12 depuis Supabase
 */
export async function loadCA12Data(declarationId: string): Promise<TVACalculationResult | null> {
  const { data, error } = await supabase
    .from('declaration_ca12_data')
    .select('*')
    .eq('declaration_id', declarationId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    companyName: data.company_name,
    siren: data.siren,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2 || '',
    postalCode: data.postal_code,
    city: data.city,
    periodStart: new Date(data.period_start),
    periodEnd: new Date(data.period_end),
    ligne01AchatsEnFranchise: Number(data.ligne_01_achats_franchise) || 0,
    ligne02ExportationsHorsUE: Number(data.ligne_02_exportations_hors_ue) || 0,
    ligne03LivraisonsIntracom: Number(data.ligne_03_livraisons_intracommunautaires) || 0,
    ligne04AutresNonImposables: Number(data.ligne_04_autres_operations_non_imposables) || 0,
    ligne4bVentesAssujettiNonFrance: Number(data.ligne_4b_ventes_assujetti_non_france) || 0,
    ligne06Base20: Number(data.ligne_06_base_20) || 0,
    ligne06TVA20: Number(data.ligne_06_tva_20) || 0,
    ligne07Base10: Number(data.ligne_07_base_10) || 0,
    ligne07TVA10: Number(data.ligne_07_tva_10) || 0,
    ligne08Base5_5: Number(data.ligne_08_base_5_5) || 0,
    ligne08TVA5_5: Number(data.ligne_08_tva_5_5) || 0,
    ligne09Base2_1: Number(data.ligne_09_base_2_1) || 0,
    ligne09TVA2_1: Number(data.ligne_09_tva_2_1) || 0,
    ligne11AcquisitionsIntracom20: Number(data.ligne_11_acquisitions_intracom_20) || 0,
    ligne12AcquisitionsIntracom10: Number(data.ligne_12_acquisitions_intracom_10) || 0,
    totalTVABrute: Number(data.total_tva_brute) || 0,
    ligne19Immobilisations: Number(data.ligne_19_immobilisations) || 0,
    ligne20AutresBiensServices: Number(data.ligne_20_autres_biens_services) || 0,
    ligne21Regularisations: Number(data.ligne_21_regularisations) || 0,
    ligne22ReportCreditAnterieur: Number(data.ligne_22_report_credit_anterieur) || 0,
    totalTVADeductible: Number(data.total_tva_deductible) || 0,
    tvaNetteDue: Number(data.tva_nette_due) || 0,
    creditTVA: Number(data.credit_tva) || 0,
    acomptesVerses: Number(data.acomptes_verses) || 0,
    montantAPayer: Number(data.montant_a_payer) || 0,
    remboursementDemande: Number(data.remboursement_demande) || 0,
    creditAReporter: Number(data.credit_a_reporter) || 0,
  }
}
