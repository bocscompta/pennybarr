/**
 * Formulaire CERFA CA12 (N°3517-S-SD)
 * Déclaration annuelle de TVA - Régime simplifié
 * Reproduction fidèle du formulaire officiel
 */

import { useState, useEffect } from 'react'

// Types pour les données du formulaire
export interface CA12FormData {
  // Identification
  companyName: string
  siren: string
  siret: string
  tvaIntracom: string
  address: string
  postalCode: string
  city: string

  // Période
  periodStart: string
  periodEnd: string

  // Options
  isNeant: boolean
  paiementParImputation: boolean
  mentionExpresse: boolean
  acompteCongesPayes: boolean
  ticAccise: boolean
  autres: boolean
  commentaires: string

  // I - TVA BRUTE - Opérations non taxées
  ligne01_achats_franchise: number        // 0037
  ligne02_exportations_hors_ue: number    // 0032
  ligne03_autres_non_imposables: number   // 0033
  ligne04_livraisons_intracom: number     // 0034
  ligne3A_ventes_distance: number         // 0047
  ligne3B_produits_petroliers: number     // 0049
  ligne4B_ventes_assujetti_non_france: number // 0043
  ligne4D_electricite_gaz: number         // 0029

  // I - TVA BRUTE - Opérations taxées France métropolitaine
  ligne5A_base_20: number                 // Base HT taux 20%
  ligne5A_tva_20: number                  // 0207
  ligne5B_base_20_petroliers: number      // Base HT taux 20% produits pétroliers
  ligne5B_tva_20_petroliers: number       // 0208
  ligne6_base_5_5: number                 // Base HT taux 5.5%
  ligne6_tva_5_5: number                  // 0105
  ligne6C_base_10: number                 // Base HT taux 10%
  ligne6C_tva_10: number                  // 0151

  // I - TVA BRUTE - Opérations taxées DOM
  ligne7_base_8_5: number                 // Base HT taux 8.5%
  ligne7_tva_8_5: number                  // 0201
  ligne8_base_2_1: number                 // Base HT taux 2.1%
  ligne8_tva_2_1: number                  // 0100

  // I - TVA BRUTE - Autres taux
  ligne9_base_particulier: number         // Taux particulier
  ligne9_tva_particulier: number          // 0950
  ligne9A_base_13_petroliers: number      // Taux 13% produits pétroliers
  ligne9A_tva_13_petroliers: number       // 0152
  ligne10_anciens_taux: number            // 0900

  // I - TVA BRUTE - Autres opérations
  ligneAA_electricite_imposable: number   // 0030
  ligneAB_achats_assujetti: number        // 0040
  ligneAC_achats_intracom: number         // 0044
  ligne11_cessions_immo: number           // 0970
  ligne12_livraisons_soi_meme: number     // 0980
  ligne13_autres_imposables: number       // 0981

  // Ligne 16 - Total TVA due (calculé)
  ligne16_total_tva_due: number

  // I - TVA BRUTE - Autre TVA due
  ligne17_remboursements_provisionnels: number // 0983
  ligne18_tva_a_reverser: number          // 0600
  ligneAD_sommes_ajouter: number          // 0602
  ligne19_total_tva_brute: number         // Total calculé

  // II - TVA DÉDUCTIBLE - Autres biens et services
  ligne20_deductions_factures: number     // 0702
  ligne21_deductions_forfaitaires: number // 0704
  ligne22_total_abs: number               // Total calculé

  // II - TVA DÉDUCTIBLE - Immobilisations
  ligne23_tva_immobilisations: number     // 0703

  // II - TVA DÉDUCTIBLE - Autre TVA à déduire
  ligne24_credit_anterieur: number        // 0058
  ligne25_omissions_complements: number   // 0059
  ligne25A_coefficient_deduction: number
  ligneAE_sommes_imputer: number          // 0603
  ligne26_total_tva_deductible: number    // Total calculé
  ligne2E_tva_produits_petroliers: number // 0711

  // III - TVA NETTE
  ligne28_tva_due: number                 // 8900 - TVA due
  ligne29_credit: number                  // 0705 - Crédit

  // Acomptes
  acompte1_paye: number
  acompte1_restant: number
  acompte2_paye: number
  acompte2_restant: number
  ligne30_total_acomptes: number          // 0018

  // Résultat net
  ligne33_solde_a_payer: number
  ligne34_excedent_versement: number
  ligne35_solde_excedentaire: number      // 0020

  // VI - Récapitulation
  ligne49_solde_excedentaire: number
  ligne50_remboursement_demande: number   // 8002
  ligne51_credit_a_reporter: number       // 8003
  ligne54_tva_nette_due: number           // 8901
  ligne55_taxes_assimilees: number
  ligne56_total_a_payer: number           // 9992
  ligne57_base_acomptes: number
}

// Valeurs par défaut
export const defaultCA12Data: CA12FormData = {
  companyName: '',
  siren: '',
  siret: '',
  tvaIntracom: '',
  address: '',
  postalCode: '',
  city: '',
  periodStart: '',
  periodEnd: '',
  isNeant: false,
  paiementParImputation: false,
  mentionExpresse: false,
  acompteCongesPayes: false,
  ticAccise: false,
  autres: false,
  commentaires: '',
  ligne01_achats_franchise: 0,
  ligne02_exportations_hors_ue: 0,
  ligne03_autres_non_imposables: 0,
  ligne04_livraisons_intracom: 0,
  ligne3A_ventes_distance: 0,
  ligne3B_produits_petroliers: 0,
  ligne4B_ventes_assujetti_non_france: 0,
  ligne4D_electricite_gaz: 0,
  ligne5A_base_20: 0,
  ligne5A_tva_20: 0,
  ligne5B_base_20_petroliers: 0,
  ligne5B_tva_20_petroliers: 0,
  ligne6_base_5_5: 0,
  ligne6_tva_5_5: 0,
  ligne6C_base_10: 0,
  ligne6C_tva_10: 0,
  ligne7_base_8_5: 0,
  ligne7_tva_8_5: 0,
  ligne8_base_2_1: 0,
  ligne8_tva_2_1: 0,
  ligne9_base_particulier: 0,
  ligne9_tva_particulier: 0,
  ligne9A_base_13_petroliers: 0,
  ligne9A_tva_13_petroliers: 0,
  ligne10_anciens_taux: 0,
  ligneAA_electricite_imposable: 0,
  ligneAB_achats_assujetti: 0,
  ligneAC_achats_intracom: 0,
  ligne11_cessions_immo: 0,
  ligne12_livraisons_soi_meme: 0,
  ligne13_autres_imposables: 0,
  ligne16_total_tva_due: 0,
  ligne17_remboursements_provisionnels: 0,
  ligne18_tva_a_reverser: 0,
  ligneAD_sommes_ajouter: 0,
  ligne19_total_tva_brute: 0,
  ligne20_deductions_factures: 0,
  ligne21_deductions_forfaitaires: 0,
  ligne22_total_abs: 0,
  ligne23_tva_immobilisations: 0,
  ligne24_credit_anterieur: 0,
  ligne25_omissions_complements: 0,
  ligne25A_coefficient_deduction: 0,
  ligneAE_sommes_imputer: 0,
  ligne26_total_tva_deductible: 0,
  ligne2E_tva_produits_petroliers: 0,
  ligne28_tva_due: 0,
  ligne29_credit: 0,
  acompte1_paye: 0,
  acompte1_restant: 0,
  acompte2_paye: 0,
  acompte2_restant: 0,
  ligne30_total_acomptes: 0,
  ligne33_solde_a_payer: 0,
  ligne34_excedent_versement: 0,
  ligne35_solde_excedentaire: 0,
  ligne49_solde_excedentaire: 0,
  ligne50_remboursement_demande: 0,
  ligne51_credit_a_reporter: 0,
  ligne54_tva_nette_due: 0,
  ligne55_taxes_assimilees: 0,
  ligne56_total_a_payer: 0,
  ligne57_base_acomptes: 0,
}

interface CA12FormCerfaProps {
  data: CA12FormData
  onBack: () => void
  onSave?: (data: CA12FormData) => void
}

export default function CA12FormCerfa({ data, onBack, onSave }: CA12FormCerfaProps) {
  const [formData, setFormData] = useState<CA12FormData>(data)

  // Recalculer les totaux quand les données changent
  useEffect(() => {
    // Total TVA due (ligne 16)
    const totalTvaDue =
      formData.ligne5A_tva_20 +
      formData.ligne5B_tva_20_petroliers +
      formData.ligne6_tva_5_5 +
      formData.ligne6C_tva_10 +
      formData.ligne7_tva_8_5 +
      formData.ligne8_tva_2_1 +
      formData.ligne9_tva_particulier +
      formData.ligne9A_tva_13_petroliers +
      formData.ligne10_anciens_taux

    // Total TVA brute (ligne 19)
    const totalTvaBrute = totalTvaDue +
      formData.ligne17_remboursements_provisionnels +
      formData.ligne18_tva_a_reverser +
      formData.ligneAD_sommes_ajouter

    // Total ABS (ligne 22)
    const totalAbs = formData.ligne20_deductions_factures + formData.ligne21_deductions_forfaitaires

    // Total TVA déductible (ligne 26)
    const totalTvaDeductible = totalAbs +
      formData.ligne23_tva_immobilisations +
      formData.ligne24_credit_anterieur +
      formData.ligne25_omissions_complements +
      formData.ligneAE_sommes_imputer

    // TVA nette
    const tvaNette = totalTvaBrute - totalTvaDeductible
    const tvaDue = tvaNette > 0 ? tvaNette : 0
    const creditTva = tvaNette < 0 ? Math.abs(tvaNette) : 0

    // Acomptes
    const totalAcomptes = formData.acompte1_paye + formData.acompte1_restant +
                          formData.acompte2_paye + formData.acompte2_restant

    // Résultat net
    const soldeAPayer = tvaDue - creditTva - totalAcomptes
    const excedentVersement = totalAcomptes > tvaDue ? totalAcomptes - tvaDue : 0
    const soldeExcedentaire = creditTva + excedentVersement

    setFormData(prev => ({
      ...prev,
      ligne16_total_tva_due: totalTvaDue,
      ligne19_total_tva_brute: totalTvaBrute,
      ligne22_total_abs: totalAbs,
      ligne26_total_tva_deductible: totalTvaDeductible,
      ligne28_tva_due: tvaDue,
      ligne29_credit: creditTva,
      ligne30_total_acomptes: totalAcomptes,
      ligne33_solde_a_payer: soldeAPayer > 0 ? soldeAPayer : 0,
      ligne34_excedent_versement: excedentVersement,
      ligne35_solde_excedentaire: soldeExcedentaire,
      ligne49_solde_excedentaire: soldeExcedentaire,
      ligne51_credit_a_reporter: soldeExcedentaire - formData.ligne50_remboursement_demande,
      ligne54_tva_nette_due: soldeAPayer > 0 ? soldeAPayer : 0,
      ligne56_total_a_payer: (soldeAPayer > 0 ? soldeAPayer : 0) + formData.ligne55_taxes_assimilees,
    }))
  }, [
    formData.ligne5A_tva_20, formData.ligne5B_tva_20_petroliers, formData.ligne6_tva_5_5,
    formData.ligne6C_tva_10, formData.ligne7_tva_8_5, formData.ligne8_tva_2_1,
    formData.ligne9_tva_particulier, formData.ligne9A_tva_13_petroliers, formData.ligne10_anciens_taux,
    formData.ligne17_remboursements_provisionnels, formData.ligne18_tva_a_reverser, formData.ligneAD_sommes_ajouter,
    formData.ligne20_deductions_factures, formData.ligne21_deductions_forfaitaires,
    formData.ligne23_tva_immobilisations, formData.ligne24_credit_anterieur,
    formData.ligne25_omissions_complements, formData.ligneAE_sommes_imputer,
    formData.acompte1_paye, formData.acompte1_restant, formData.acompte2_paye, formData.acompte2_restant,
    formData.ligne50_remboursement_demande, formData.ligne55_taxes_assimilees
  ])

  const handleNumberChange = (field: keyof CA12FormData, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value.replace(/\s/g, ''), 10) || 0
    setFormData(prev => ({ ...prev, [field]: numValue }))
  }

  const handleCheckboxChange = (field: keyof CA12FormData, checked: boolean) => {
    setFormData(prev => ({ ...prev, [field]: checked }))
  }

  const handleTextChange = (field: keyof CA12FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const formatNumber = (value: number) => {
    if (value === 0) return ''
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(value))
  }

  // Composant pour les cellules de saisie numérique
  const InputCell = ({
    field,
    code,
    highlight = false,
    bold = false,
    readOnly = false
  }: {
    field: keyof CA12FormData
    code?: string
    highlight?: boolean
    bold?: boolean
    readOnly?: boolean
  }) => (
    <td className={`border border-gray-400 p-1 ${highlight ? 'bg-yellow-100' : ''}`}>
      <div className="flex items-center gap-1">
        {code && <span className="text-xs text-blue-800 font-mono w-10">{code}</span>}
        <input
          type="text"
          value={formatNumber(formData[field] as number)}
          onChange={(e) => !readOnly && handleNumberChange(field, e.target.value)}
          readOnly={readOnly}
          className={`w-full text-right px-1 py-0.5 text-sm ${bold ? 'font-bold' : ''} ${readOnly ? 'bg-gray-100' : 'bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
        />
      </div>
    </td>
  )

  // Composant pour les cases à cocher
  const Checkbox = ({ field, label }: { field: keyof CA12FormData; label?: string }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      {label && <span className="text-sm">{label}</span>}
      <input
        type="checkbox"
        checked={formData[field] as boolean}
        onChange={(e) => handleCheckboxChange(field, e.target.checked)}
        className="w-5 h-5 border-gray-400 rounded cursor-pointer accent-blue-600"
      />
    </label>
  )

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-gray-100">
      <div className="max-w-5xl mx-auto p-4">
        {/* Boutons d'action */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
          >
            ← Retourner à la déclaration
          </button>
          {onSave && (
            <button
              onClick={() => onSave(formData)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
            >
              💾 Enregistrer
            </button>
          )}
        </div>

        {/* Titre de la page */}
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Déclaration annuelle de TVA (exercice clos au {formData.periodEnd}) - {formData.companyName}
        </h1>

        {/* Formulaire CERFA */}
        <div className="bg-white border-2 border-gray-800 shadow-lg">
          {/* ===== PAGE 1 - EN-TÊTE ===== */}
          <div className="border-b-4 border-blue-800 p-4">
            <div className="flex justify-between items-start">
              {/* Logo République */}
              <div className="flex items-start gap-3">
                <div className="text-center">
                  <div className="text-3xl">🇫🇷</div>
                  <div className="text-[10px] font-bold text-blue-900">RÉPUBLIQUE</div>
                  <div className="text-[10px] font-bold text-blue-900">FRANÇAISE</div>
                  <div className="text-[8px] text-gray-500 italic">Liberté</div>
                  <div className="text-[8px] text-gray-500 italic">Égalité</div>
                  <div className="text-[8px] text-gray-500 italic">Fraternité</div>
                </div>
              </div>

              {/* Titre central */}
              <div className="flex-1 text-center mx-4">
                <h2 className="text-lg font-bold text-blue-800 uppercase">
                  TAXE SUR LA VALEUR AJOUTÉE ET TAXES ASSIMILÉES
                </h2>
                <div className="mt-2 bg-blue-800 text-white py-1.5 px-4 inline-block text-sm">
                  DÉCLARATION RELATIVE À L'EXERCICE OU À LA PÉRIODE DU {formData.periodStart} AU {formData.periodEnd}
                </div>
              </div>

              {/* Référence CERFA */}
              <div className="text-right text-xs">
                <div className="font-bold">N°3517-S-SD</div>
                <div className="text-gray-600">CA12 (1)</div>
                <div className="text-gray-600">CA12E (2)</div>
                <div className="mt-1 border border-gray-400 px-2 py-0.5 inline-block">
                  <span className="font-bold text-red-600">cerfa</span>
                </div>
                <div className="text-[9px] text-gray-500 mt-1">N°11417*25</div>
                <div className="text-[8px] text-gray-500">FORMULAIRE OBLIGATOIRE</div>
              </div>
            </div>
          </div>

          {/* Identification du destinataire */}
          <div className="p-4 border-b border-gray-300">
            <div className="flex gap-4">
              <div className="text-[10px] text-gray-600 w-64">
                Cette déclaration doit obligatoirement être renvoyée <strong>au plus tard le 3 mai 2024</strong> (clôture au 31/12/2023) ou dans les trois mois de la clôture de l'exercice (clôture en cours d'année) (CGI, ann II, art. 242 septies A)
              </div>
              <div className="flex-1">
                <table className="w-full border-2 border-gray-800 text-sm">
                  <tbody>
                    <tr>
                      <td className="border border-gray-400 p-2 bg-gray-50 w-40">
                        <strong>Identification<br/>du<br/>destinataire</strong>
                      </td>
                      <td className="border border-gray-400 p-2">
                        <div className="mb-2">
                          <label className="text-xs text-gray-500">Nom ou dénomination</label>
                          <input
                            type="text"
                            value={formData.companyName}
                            onChange={(e) => handleTextChange('companyName', e.target.value)}
                            className="w-full border border-gray-300 px-2 py-1 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Adresse</label>
                          <input
                            type="text"
                            value={`${formData.address} ${formData.postalCode} ${formData.city}`}
                            onChange={(e) => handleTextChange('address', e.target.value)}
                            className="w-full border border-gray-300 px-2 py-1"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* SIRET et TVA Intracom */}
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span>N° SIRET</span>
                    <input
                      type="text"
                      value={formData.siret || formData.siren}
                      onChange={(e) => handleTextChange('siret', e.target.value)}
                      className="flex-1 border border-gray-300 px-2 py-1 font-mono"
                      placeholder="_ _ _ _ _ _ _ _ _ _ _ _ _ _"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>N° TVA intracommunautaire</span>
                    <input
                      type="text"
                      value={formData.tvaIntracom}
                      onChange={(e) => handleTextChange('tvaIntracom', e.target.value)}
                      className="flex-1 border border-gray-300 px-2 py-1 font-mono"
                      placeholder="FR _ _ _ _ _ _ _ _ _ _ _"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Case néant */}
          <div className="px-4 py-2 border-b border-gray-300 flex items-center justify-between text-sm bg-gray-50">
            <span>Si vous n'avez à remplir aucune ligne de ce formulaire (déclaration « néant »), veuillez cocher la case à droite</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-800 font-mono">0010</span>
              <Checkbox field="isNeant" />
            </div>
          </div>

          {/* Modalité de paiement */}
          <div className="border-b border-gray-300">
            <div className="bg-blue-800 text-white text-sm font-bold py-1 px-2">
              MODALITÉS DE DÉCLARATION ET DE PAIEMENT
            </div>
            <div className="p-3 text-sm bg-red-50">
              <p className="text-red-700 font-medium mb-2">
                <strong>ATTENTION :</strong> ne portez pas de centimes d'euro (l'arrondissement s'effectue à l'unité la plus proche)
              </p>
              <div className="flex items-center justify-between mt-2">
                <span>Paiement par imputation * :</span>
                <Checkbox field="paiementParImputation" />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">
                * (joindre l'imprimé n° 3516 disponible sur www.impots.gouv.fr ou auprès de votre service des impôts).
              </p>
            </div>
          </div>

          {/* Cadre correspondance */}
          <div className="border-b border-gray-300">
            <div className="bg-blue-800 text-white text-sm font-bold py-1 px-2">
              CADRE RÉSERVÉ À LA CORRESPONDANCE
            </div>
            <div className="p-3 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Commentaires :</label>
                <textarea
                  className="w-full mt-1 border border-gray-300 p-2 text-sm h-20"
                  value={formData.commentaires}
                  onChange={(e) => handleTextChange('commentaires', e.target.value)}
                />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Mention expresse</span>
                  <Checkbox field="mentionExpresse" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Acompte congés payés</span>
                  <Checkbox field="acompteCongesPayes" />
                </div>
                <div className="flex items-center justify-between">
                  <span>TIC (Accise sur les énergies)</span>
                  <Checkbox field="ticAccise" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Autres</span>
                  <Checkbox field="autres" />
                </div>
              </div>
            </div>
          </div>

          {/* ===== I - TVA BRUTE ===== */}
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr>
                <td colSpan={6} className="bg-blue-800 text-white font-bold text-sm py-1 px-2">
                  I – TVA BRUTE
                </td>
              </tr>

              {/* Opérations non taxées - en-tête */}
              <tr className="bg-blue-100">
                <td colSpan={3} className="border border-gray-400 p-1 font-bold text-center">OPÉRATIONS NON TAXÉES</td>
                <td colSpan={3} className="border border-gray-400 p-1 font-bold text-center">OPÉRATIONS NON TAXÉES</td>
              </tr>

              {/* Lignes opérations non taxées */}
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100 w-8">01</td>
                <td className="border border-gray-400 p-1">Achats en franchise</td>
                <InputCell field="ligne01_achats_franchise" code="0037" />
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100 w-8">04</td>
                <td className="border border-gray-400 p-1 text-[10px]">Livraisons intracommunautaires à destination d'une personne assujettie</td>
                <InputCell field="ligne04_livraisons_intracom" code="0034" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">02</td>
                <td className="border border-gray-400 p-1">Exportations hors UE</td>
                <InputCell field="ligne02_exportations_hors_ue" code="0032" />
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">4B</td>
                <td className="border border-gray-400 p-1 text-[10px]">Ventes de biens ou prestations de services réalisées par un assujetti non établi en France (art 283-1 CGI)</td>
                <InputCell field="ligne4B_ventes_assujetti_non_france" code="0043" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">03</td>
                <td className="border border-gray-400 p-1">Autres opérations non imposables</td>
                <InputCell field="ligne03_autres_non_imposables" code="0033" />
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">3A</td>
                <td className="border border-gray-400 p-1 text-[10px]">Ventes à distance taxables dans un autre État membre</td>
                <InputCell field="ligne3A_ventes_distance" code="0047" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">3B</td>
                <td className="border border-gray-400 p-1">Mises à la consommation de produits pétroliers</td>
                <InputCell field="ligne3B_produits_petroliers" code="0049" />
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">4D</td>
                <td className="border border-gray-400 p-1 text-[10px]">Livraisons d'électricité, de gaz naturel non imposables en France</td>
                <InputCell field="ligne4D_electricite_gaz" code="0029" />
              </tr>

              {/* Opérations taxées */}
              <tr className="bg-blue-100">
                <td colSpan={2} className="border border-gray-400 p-1 font-bold">OPÉRATIONS TAXÉES</td>
                <td className="border border-gray-400 p-1 font-bold text-center">Base hors taxe</td>
                <td colSpan={2} className="border border-gray-400 p-1 font-bold text-center"></td>
                <td className="border border-gray-400 p-1 font-bold text-center">Taxe due</td>
              </tr>

              <tr>
                <td colSpan={6} className="bg-blue-700 text-white text-xs py-0.5 px-2">– réalisées en France métropolitaine</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">5A</td>
                <td className="border border-gray-400 p-1">Taux normal 20 %</td>
                <InputCell field="ligne5A_base_20" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0207</td>
                <InputCell field="ligne5A_tva_20" highlight />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">5B</td>
                <td className="border border-gray-400 p-1">Taux normal 20 % sur les produits pétroliers</td>
                <InputCell field="ligne5B_base_20_petroliers" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0208</td>
                <InputCell field="ligne5B_tva_20_petroliers" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">06</td>
                <td className="border border-gray-400 p-1">Taux réduit 5,5 %</td>
                <InputCell field="ligne6_base_5_5" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0105</td>
                <InputCell field="ligne6_tva_5_5" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">6C</td>
                <td className="border border-gray-400 p-1">Taux réduit 10 %</td>
                <InputCell field="ligne6C_base_10" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0151</td>
                <InputCell field="ligne6C_tva_10" />
              </tr>

              <tr>
                <td colSpan={6} className="bg-blue-700 text-white text-xs py-0.5 px-2">– réalisées dans les DOM</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">07</td>
                <td className="border border-gray-400 p-1">Taux normal 8,5 %</td>
                <InputCell field="ligne7_base_8_5" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0201</td>
                <InputCell field="ligne7_tva_8_5" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">08</td>
                <td className="border border-gray-400 p-1">Taux réduit 2,1 %</td>
                <InputCell field="ligne8_base_2_1" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0100</td>
                <InputCell field="ligne8_tva_2_1" />
              </tr>

              <tr>
                <td colSpan={6} className="bg-blue-700 text-white text-xs py-0.5 px-2">– à un autre taux (France métropolitaine ou DOM)</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">09</td>
                <td className="border border-gray-400 p-1">Opérations imposables à un taux particulier</td>
                <InputCell field="ligne9_base_particulier" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0950</td>
                <InputCell field="ligne9_tva_particulier" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">9A</td>
                <td className="border border-gray-400 p-1">Taux réduit 13 % sur les produits pétroliers</td>
                <InputCell field="ligne9A_base_13_petroliers" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0152</td>
                <InputCell field="ligne9A_tva_13_petroliers" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">10</td>
                <td className="border border-gray-400 p-1">Anciens taux</td>
                <InputCell field="ligne10_anciens_taux" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0900</td>
                <td className="border border-gray-400 p-1"></td>
              </tr>

              <tr>
                <td colSpan={6} className="bg-blue-700 text-white text-xs py-0.5 px-2">– autres opérations</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">AA</td>
                <td className="border border-gray-400 p-1 text-[10px]">Achats d'électricité, de gaz naturel, de chaleur ou de froid imposables en France</td>
                <InputCell field="ligneAA_electricite_imposable" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0030</td>
                <td className="border border-gray-400 p-1"></td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">AB</td>
                <td className="border border-gray-400 p-1 text-[10px]">Achats de biens ou de prestations de services auprès d'un assujetti non établi en France (art 283-1 CGI)</td>
                <InputCell field="ligneAB_achats_assujetti" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0040</td>
                <td className="border border-gray-400 p-1"></td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">AC</td>
                <td className="border border-gray-400 p-1 text-[10px]">Achats de prestations de services auprès d'un assujetti non établi en France (art 283-2 CGI)</td>
                <InputCell field="ligneAC_achats_intracom" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0044</td>
                <td className="border border-gray-400 p-1"></td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">11</td>
                <td className="border border-gray-400 p-1">Cessions d'immobilisations</td>
                <InputCell field="ligne11_cessions_immo" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0970</td>
                <td className="border border-gray-400 p-1"></td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">12</td>
                <td className="border border-gray-400 p-1">Livraisons à soi-même</td>
                <InputCell field="ligne12_livraisons_soi_meme" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0980</td>
                <td className="border border-gray-400 p-1"></td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">13</td>
                <td className="border border-gray-400 p-1">Autres opérations imposables</td>
                <InputCell field="ligne13_autres_imposables" />
                <td colSpan={2} className="border border-gray-400 p-1 text-center text-blue-800 font-mono">0981</td>
                <td className="border border-gray-400 p-1"></td>
              </tr>

              {/* Total ligne 16 */}
              <tr className="bg-blue-200">
                <td className="border border-gray-400 p-1 font-bold text-center">16</td>
                <td colSpan={4} className="border border-gray-400 p-1 font-bold text-right">TOTAL DE LA TAXE DUE (lignes 5A à 13)</td>
                <td className="border border-gray-400 p-1 bg-yellow-200">
                  <input type="text" value={formatNumber(formData.ligne16_total_tva_due)} readOnly className="w-full text-right font-bold bg-transparent" />
                </td>
              </tr>

              {/* Autre TVA due */}
              <tr className="bg-blue-100">
                <td colSpan={6} className="border border-gray-400 p-1 font-bold">Autre TVA DUE</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">17</td>
                <td colSpan={4} className="border border-gray-400 p-1">Remboursements provisionnels obtenus en cours d'année ou d'exercice</td>
                <InputCell field="ligne17_remboursements_provisionnels" code="0983" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">18</td>
                <td colSpan={4} className="border border-gray-400 p-1">TVA antérieurement déduite à reverser</td>
                <InputCell field="ligne18_tva_a_reverser" code="0600" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">AD</td>
                <td colSpan={4} className="border border-gray-400 p-1">Sommes à ajouter</td>
                <InputCell field="ligneAD_sommes_ajouter" code="0602" />
              </tr>
              <tr className="bg-blue-200">
                <td className="border border-gray-400 p-1 font-bold text-center">19</td>
                <td colSpan={4} className="border border-gray-400 p-1 font-bold text-right">TOTAL DE LA TVA BRUTE DUE (lignes 16 + 17 + 18 + AD)</td>
                <td className="border border-gray-400 p-1 bg-yellow-200">
                  <input type="text" value={formatNumber(formData.ligne19_total_tva_brute)} readOnly className="w-full text-right font-bold bg-transparent" />
                </td>
              </tr>

              {/* ===== II - TVA DÉDUCTIBLE ===== */}
              <tr>
                <td colSpan={6} className="bg-blue-800 text-white font-bold text-sm py-1 px-2">
                  II – TVA DÉDUCTIBLE
                </td>
              </tr>

              <tr className="bg-blue-100">
                <td colSpan={5} className="border border-gray-400 p-1 font-bold">AUTRES BIENS ET SERVICES</td>
                <td className="border border-gray-400 p-1 font-bold text-center">Taxe déductible</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">20</td>
                <td colSpan={4} className="border border-gray-400 p-1">Déductions sur factures (1)</td>
                <InputCell field="ligne20_deductions_factures" code="0702" highlight />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">21</td>
                <td colSpan={4} className="border border-gray-400 p-1">Déductions forfaitaires (1)</td>
                <InputCell field="ligne21_deductions_forfaitaires" code="0704" />
              </tr>
              <tr className="bg-blue-200">
                <td className="border border-gray-400 p-1 font-bold text-center">22</td>
                <td colSpan={4} className="border border-gray-400 p-1 font-bold text-right">TOTAL (lignes 20 + 21)</td>
                <td className="border border-gray-400 p-1 bg-yellow-200">
                  <input type="text" value={formatNumber(formData.ligne22_total_abs)} readOnly className="w-full text-right font-bold bg-transparent" />
                </td>
              </tr>

              <tr className="bg-blue-100">
                <td colSpan={6} className="border border-gray-400 p-1 font-bold">IMMOBILISATIONS</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">23</td>
                <td colSpan={4} className="border border-gray-400 p-1">TVA déductible sur immobilisations (1)</td>
                <InputCell field="ligne23_tva_immobilisations" code="0703" />
              </tr>

              <tr className="bg-blue-100">
                <td colSpan={6} className="border border-gray-400 p-1 font-bold">AUTRE TVA À DÉDUIRE</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">24</td>
                <td colSpan={4} className="border border-gray-400 p-1">Crédit antérieur non imputé et non remboursé</td>
                <InputCell field="ligne24_credit_anterieur" code="0058" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">25</td>
                <td colSpan={4} className="border border-gray-400 p-1">Omissions ou compléments de déductions</td>
                <InputCell field="ligne25_omissions_complements" code="0059" />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">AE</td>
                <td colSpan={4} className="border border-gray-400 p-1">Sommes à imputer</td>
                <InputCell field="ligneAE_sommes_imputer" code="0603" />
              </tr>
              <tr className="bg-blue-200">
                <td className="border border-gray-400 p-1 font-bold text-center">26</td>
                <td colSpan={4} className="border border-gray-400 p-1 font-bold text-right">TOTAL DE LA TVA DÉDUCTIBLE (lignes 22 + 23 + 24 + 25 + AE)</td>
                <td className="border border-gray-400 p-1 bg-yellow-200">
                  <input type="text" value={formatNumber(formData.ligne26_total_tva_deductible)} readOnly className="w-full text-right font-bold bg-transparent" />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">2E</td>
                <td colSpan={4} className="border border-gray-400 p-1">Dont TVA déductible sur les produits pétroliers</td>
                <InputCell field="ligne2E_tva_produits_petroliers" code="0711" />
              </tr>

              {/* ===== III - TVA NETTE ===== */}
              <tr>
                <td colSpan={6} className="bg-blue-800 text-white font-bold text-sm py-1 px-2">
                  III – TVA NETTE
                </td>
              </tr>

              <tr className="bg-blue-100">
                <td colSpan={5} className="border border-gray-400 p-1 font-bold">RÉSULTAT DE LA LIQUIDATION</td>
                <td className="border border-gray-400 p-1 font-bold text-center">Taxe</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">28</td>
                <td colSpan={4} className="border border-gray-400 p-1">TVA due : (Ligne 19 – ligne 26) ou</td>
                <InputCell field="ligne28_tva_due" code="8900" readOnly />
              </tr>
              <tr className="bg-green-100">
                <td className="border border-gray-400 p-1 font-bold text-center bg-green-200">29</td>
                <td colSpan={4} className="border border-gray-400 p-1 font-bold">CRÉDIT : (Ligne 26 – ligne 19)</td>
                <td className="border border-gray-400 p-1 bg-green-200">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-800 font-mono w-10">0705</span>
                    <input type="text" value={formatNumber(formData.ligne29_credit)} readOnly className="w-full text-right font-bold bg-transparent" />
                  </div>
                </td>
              </tr>

              {/* Acomptes */}
              <tr className="bg-blue-100">
                <td colSpan={6} className="border border-gray-400 p-1 font-bold">IMPUTATIONS/RÉGULARISATIONS DES ACOMPTES</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">30</td>
                <td colSpan={4} className="border border-gray-400 p-1">Acomptes payés et/ou restant dus (Tot. 1 + Tot. 2)</td>
                <InputCell field="ligne30_total_acomptes" code="0018" />
              </tr>

              {/* Résultat net */}
              <tr className="bg-blue-100">
                <td colSpan={5} className="border border-gray-400 p-1 font-bold">RÉSULTAT NET</td>
                <td className="border border-gray-400 p-1 font-bold text-center">Taxe</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">33</td>
                <td colSpan={4} className="border border-gray-400 p-1">SOLDE DÛ si ligne 28 – (lignes 29 + 30) ≥ 0</td>
                <InputCell field="ligne33_solde_a_payer" readOnly />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">34</td>
                <td colSpan={4} className="border border-gray-400 p-1">EXCÉDENT DE VERSEMENT : si ligne 30 – ligne 28 ≥ 0</td>
                <InputCell field="ligne34_excedent_versement" readOnly />
              </tr>
              <tr className="bg-green-200">
                <td className="border border-gray-400 p-1 font-bold text-center">35</td>
                <td colSpan={4} className="border border-gray-400 p-1 font-bold">SOLDE EXCÉDENTAIRE : (lignes 29 + 34)</td>
                <td className="border border-gray-400 p-1 bg-green-300">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-800 font-mono w-10">0020</span>
                    <input type="text" value={formatNumber(formData.ligne35_solde_excedentaire)} readOnly className="w-full text-right font-bold bg-transparent" />
                  </div>
                </td>
              </tr>

              {/* ===== VI - RÉCAPITULATION ===== */}
              <tr>
                <td colSpan={6} className="bg-blue-800 text-white font-bold text-sm py-1 px-2">
                  VI – RÉCAPITULATION
                </td>
              </tr>

              <tr className="bg-blue-100">
                <td colSpan={3} className="border border-gray-400 p-1 font-bold text-center">CRÉDIT OU EXCÉDENT</td>
                <td colSpan={3} className="border border-gray-400 p-1 font-bold text-center">SOLDE À PAYER</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">49</td>
                <td className="border border-gray-400 p-1">Solde excédentaire (report ligne 35)</td>
                <td className="border border-gray-400 p-1 bg-green-100">
                  <input type="text" value={formatNumber(formData.ligne49_solde_excedentaire)} readOnly className="w-full text-right font-bold bg-transparent" />
                </td>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">54</td>
                <td className="border border-gray-400 p-1">TVA nette due (ligne 33)</td>
                <InputCell field="ligne54_tva_nette_due" code="8901" readOnly />
              </tr>
              <tr>
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">50</td>
                <td className="border border-gray-400 p-1">Remboursement demandé (form. 3517DDR)</td>
                <InputCell field="ligne50_remboursement_demande" code="8002" />
                <td className="border border-gray-400 p-1 font-bold text-center bg-gray-100">55</td>
                <td className="border border-gray-400 p-1">Taxes assimilées (total lignes 36 à 94)</td>
                <InputCell field="ligne55_taxes_assimilees" />
              </tr>
              <tr className="bg-green-100">
                <td className="border border-gray-400 p-1 font-bold text-center bg-green-200">51</td>
                <td className="border border-gray-400 p-1 font-bold">Crédit à reporter (prochaine CA12)</td>
                <td className="border border-gray-400 p-1 bg-green-200">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-800 font-mono w-10">8003</span>
                    <input type="text" value={formatNumber(formData.ligne51_credit_a_reporter)} readOnly className="w-full text-right font-bold bg-transparent" />
                  </div>
                </td>
                <td className="border border-gray-400 p-1 font-bold text-center bg-yellow-200">56</td>
                <td className="border border-gray-400 p-1 font-bold">TOTAL À PAYER (54 + 55)</td>
                <td className="border border-gray-400 p-1 bg-yellow-200">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-800 font-mono w-10">9992</span>
                    <input type="text" value={formatNumber(formData.ligne56_total_a_payer)} readOnly className="w-full text-right font-bold bg-transparent" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Pied de page */}
          <div className="p-2 border-t border-gray-400 text-[10px] text-red-600 bg-red-50">
            <strong>ATTENTION !</strong> UNE SITUATION DE TVA CRÉDITRICE (LIGNE 49 SERVIE) NE DISPENSE PAS DU PAIEMENT DES TAXES ASSIMILÉES DÉCLARÉES LIGNE 55.
          </div>
        </div>
      </div>
    </div>
  )
}
