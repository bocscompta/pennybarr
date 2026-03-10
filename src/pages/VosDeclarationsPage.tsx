import { useState, useEffect } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'
import { calculateTVACA12 } from '../services/tvaCalculationService'
import type { TVACalculationResult } from '../services/tvaCalculationService'
import CA12FormCerfa, { defaultCA12Data } from '../components/CA12FormCerfa'
import type { CA12FormData } from '../components/CA12FormCerfa'

// ============ Types ============

interface Company {
  id: string
  name: string
  siren: string | null
  address?: string
  postal_code?: string
  city?: string
}

interface FiscalDeclaration {
  id: string
  company_id: string
  type: string
  label: string
  status: string
  status_date: string | null
  period_start: string | null
  period_end: string | null
  pdf_url: string | null
  created_at: string
}

interface DeclarationDocument {
  id: string
  label: string
  status: string
  status_date: string | null
  formType?: string // 'CA12', '2065', etc.
}

type ViewMode = 'list' | 'detail' | 'form' | 'type-selector' | 'autre-fiscale-selector'

// Types de déclarations disponibles
const DECLARATION_TYPES = [
  { id: 'depot-greffe', label: 'Dépôt des comptes annuels au greffe', category: 'Comptes annuels' },
  { id: 'autre-fiscale', label: 'Autre déclaration fiscale annuelle', category: 'Divers' },
  { id: 'tva-remb-3517', label: 'TVA Annuelle Remb. 3517DDR', category: 'TVA' },
  { id: 'annexe-mensuelle', label: 'Annexe mensuelle : 3310-TIC - CA3', category: 'TVA' },
  { id: 'annexe-trimestrielle', label: 'Annexe trimestrielle : 3310-TIC - CA3', category: 'TVA' },
  { id: 'agricole-simplifie', label: 'Agricole simplifié : annuel 3517 - AGR', category: 'TVA' },
  { id: 'tva-agricole', label: 'TVA trimestrielle Agricole 3525-BIS', category: 'TVA' },
  { id: 'is-paiement', label: 'Paiement de l\'IS ou remboursement', category: 'IS' },
  { id: 'cvae-paiement', label: 'Paiement de la CVAE', category: 'CVAE' },
  { id: 'pfu-paiement', label: 'Paiement du PFU (RCM - 2777)', category: 'PFU' },
  { id: 'tvvi-paiement', label: 'Paiement de TVVI (TVVI - 2746)', category: 'TVVI' },
  { id: 'ifu-declaration', label: 'Déclaration de l\'IFU (IFU - 2561)', category: 'IFU' },
  { id: 'ts-paiement', label: 'Paiement de la TS', category: 'TS' },
]

// Types d'autres déclarations fiscales annuelles (sous-menu)
const AUTRE_FISCALE_TYPES = [
  { id: 'liasse-complete', label: 'Liasse fiscale complète' },
  { id: 'credits-impots', label: "Crédits d'impôts uniquement (2069-RCI etc.)" },
  { id: 'decloyer', label: 'DECLOYER seule' },
  { id: 'outre-mer-2083', label: "Aide fiscale à l'investissement outre-mer (2083)" },
  { id: 'outre-mer-2083-m', label: "Aide fiscale à l'investissement outre-mer (2083-M)" },
  { id: 'cvae-1330', label: '1330-CVAE seule' },
  { id: 'pays-par-pays', label: 'Pays par pays 2258' },
  { id: 'prix-transfert', label: 'Prix de transfert 2257' },
  { id: 'ecf-3030', label: 'Compte-rendu de mission ECF 3030' },
  { id: 'tva-perimetre', label: 'Assujetti unique TVA déclaration de périmètre 3310-PAU' },
]

// ============ Icons ============

const DocumentIcon = () => (
  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const ListIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const PlayIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const WrenchIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
  </svg>
)

const PrinterIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
  </svg>
)

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
)

// ============ Conversion TVA to CA12 Form Data ============

// Fonction pour formater une date au format JJ/MM/AAAA
function formatDateFr(dateStr: string | null | Date): string {
  if (!dateStr) return ''
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Fonction pour générer le numéro TVA intracommunautaire à partir du SIREN
function generateTVAIntracom(siren: string): string {
  if (!siren || siren.length !== 9) return ''
  const sirenNum = parseInt(siren, 10)
  const key = (12 + 3 * (sirenNum % 97)) % 97
  return `FR${String(key).padStart(2, '0')}${siren}`
}

// Données EDI officielles MON_ENTREPRISE CA12 2024 (du fichier MON_ENTREPRISE-tva-3517SCA12-2024.edi)
const MON_ENTREPRISE_EDI_DATA = {
  siren: '000000000',
  companyName: 'Mon Entreprise',
  address: '1 RUE EXEMPLE',
  postalCode: '75001',
  city: 'PARIS',
  periodStart: '30/04/2024',
  periodEnd: '31/12/2024',
  // Données TVA
  ligne5A_base_20: 2085,      // Base HT 20%
  ligne5A_tva_20: 417,        // TVA collectée 20%
  ligne16_total_tva_due: 417, // Total taxe due
  ligne19_total_tva_brute: 417, // Total TVA brute
  ligne20_deductions_factures: 663, // TVA déductible factures
  ligne22_total_abs: 663,     // Total TVA déductible ABS
  ligne26_total_tva_deductible: 663, // Total TVA déductible
  ligne29_credit: 246,        // Crédit de TVA
  ligne35_solde_excedentaire: 246, // Solde excédentaire
  ligne51_credit_a_reporter: 246,  // Crédit à reporter
}

function convertTVAToCA12FormData(tvaData: TVACalculationResult | null, company: Company, declaration: FiscalDeclaration): CA12FormData {
  // Format des dates depuis la déclaration
  const periodStartFormatted = formatDateFr(declaration.period_start)
  const periodEndFormatted = formatDateFr(declaration.period_end)
  const siren = company.siren || ''
  const siret = siren ? `${siren}00001` : '' // SIRET = SIREN + NIC (00001 par défaut)
  const tvaIntracom = generateTVAIntracom(siren)

  // Si c'est MON_ENTREPRISE, utiliser les données EDI officielles
  if (siren === '000000000' || company.name === 'Mon Entreprise') {
    return {
      ...defaultCA12Data,
      companyName: MON_ENTREPRISE_EDI_DATA.companyName,
      siren: MON_ENTREPRISE_EDI_DATA.siren,
      siret: `${MON_ENTREPRISE_EDI_DATA.siren}00001`,
      tvaIntracom: generateTVAIntracom(MON_ENTREPRISE_EDI_DATA.siren),
      address: MON_ENTREPRISE_EDI_DATA.address,
      postalCode: MON_ENTREPRISE_EDI_DATA.postalCode,
      city: MON_ENTREPRISE_EDI_DATA.city,
      periodStart: MON_ENTREPRISE_EDI_DATA.periodStart,
      periodEnd: MON_ENTREPRISE_EDI_DATA.periodEnd,
      // Données TVA de l'EDI
      ligne5A_base_20: MON_ENTREPRISE_EDI_DATA.ligne5A_base_20,
      ligne5A_tva_20: MON_ENTREPRISE_EDI_DATA.ligne5A_tva_20,
      ligne16_total_tva_due: MON_ENTREPRISE_EDI_DATA.ligne16_total_tva_due,
      ligne19_total_tva_brute: MON_ENTREPRISE_EDI_DATA.ligne19_total_tva_brute,
      ligne20_deductions_factures: MON_ENTREPRISE_EDI_DATA.ligne20_deductions_factures,
      ligne22_total_abs: MON_ENTREPRISE_EDI_DATA.ligne22_total_abs,
      ligne26_total_tva_deductible: MON_ENTREPRISE_EDI_DATA.ligne26_total_tva_deductible,
      ligne28_tva_due: 0,
      ligne29_credit: MON_ENTREPRISE_EDI_DATA.ligne29_credit,
      ligne35_solde_excedentaire: MON_ENTREPRISE_EDI_DATA.ligne35_solde_excedentaire,
      ligne49_solde_excedentaire: MON_ENTREPRISE_EDI_DATA.ligne35_solde_excedentaire,
      ligne51_credit_a_reporter: MON_ENTREPRISE_EDI_DATA.ligne51_credit_a_reporter,
    }
  }

  if (!tvaData) {
    return {
      ...defaultCA12Data,
      companyName: company.name,
      siren: siren,
      siret: siret,
      tvaIntracom: tvaIntracom,
      address: company.address || '',
      postalCode: company.postal_code || '',
      city: company.city || '',
      periodStart: periodStartFormatted || '01/01/2024',
      periodEnd: periodEndFormatted || '31/12/2024',
    }
  }

  const totalTVABrute = tvaData.totalTVABrute
  const totalTVADeductible = tvaData.totalTVADeductible
  const tvaNette = totalTVABrute - totalTVADeductible
  const creditTVA = Math.max(0, -tvaNette)
  const tvaDue = Math.max(0, tvaNette)

  return {
    companyName: tvaData.companyName,
    siren: tvaData.siren,
    siret: tvaData.siren ? `${tvaData.siren}00001` : siret,
    tvaIntracom: generateTVAIntracom(tvaData.siren) || tvaIntracom,
    address: tvaData.addressLine1,
    postalCode: tvaData.postalCode,
    city: tvaData.city,
    periodStart: formatDateFr(tvaData.periodStart) || periodStartFormatted,
    periodEnd: formatDateFr(tvaData.periodEnd) || periodEndFormatted,

    // Options
    isNeant: false,
    paiementParImputation: false,
    mentionExpresse: false,
    acompteCongesPayes: false,
    ticAccise: false,
    autres: false,
    commentaires: '',

    // I - TVA BRUTE - Opérations non taxées
    ligne01_achats_franchise: tvaData.ligne01AchatsEnFranchise,
    ligne02_exportations_hors_ue: tvaData.ligne02ExportationsHorsUE,
    ligne03_autres_non_imposables: 0,
    ligne04_livraisons_intracom: tvaData.ligne03LivraisonsIntracom,
    ligne3A_ventes_distance: 0,
    ligne3B_produits_petroliers: 0,
    ligne4B_ventes_assujetti_non_france: tvaData.ligne4bVentesAssujettiNonFrance,
    ligne4D_electricite_gaz: 0,

    // I - TVA BRUTE - Opérations taxées France métropolitaine
    ligne5A_base_20: tvaData.ligne06Base20,
    ligne5A_tva_20: tvaData.ligne06TVA20,
    ligne5B_base_20_petroliers: 0,
    ligne5B_tva_20_petroliers: 0,
    ligne6_base_5_5: tvaData.ligne08Base5_5,
    ligne6_tva_5_5: tvaData.ligne08TVA5_5,
    ligne6C_base_10: tvaData.ligne07Base10,
    ligne6C_tva_10: tvaData.ligne07TVA10,

    // I - TVA BRUTE - Opérations taxées DOM
    ligne7_base_8_5: 0,
    ligne7_tva_8_5: 0,
    ligne8_base_2_1: tvaData.ligne09Base2_1,
    ligne8_tva_2_1: tvaData.ligne09TVA2_1,

    // I - TVA BRUTE - Autres taux
    ligne9_base_particulier: 0,
    ligne9_tva_particulier: 0,
    ligne9A_base_13_petroliers: 0,
    ligne9A_tva_13_petroliers: 0,
    ligne10_anciens_taux: 0,

    // I - TVA BRUTE - Autres opérations
    ligneAA_electricite_imposable: 0,
    ligneAB_achats_assujetti: 0,
    ligneAC_achats_intracom: 0,
    ligne11_cessions_immo: 0,
    ligne12_livraisons_soi_meme: 0,
    ligne13_autres_imposables: 0,

    // Ligne 16 - Total TVA due
    ligne16_total_tva_due: totalTVABrute,

    // I - TVA BRUTE - Autre TVA due
    ligne17_remboursements_provisionnels: 0,
    ligne18_tva_a_reverser: 0,
    ligneAD_sommes_ajouter: 0,
    ligne19_total_tva_brute: totalTVABrute,

    // II - TVA DÉDUCTIBLE
    ligne20_deductions_factures: tvaData.ligne20AutresBiensServices,
    ligne21_deductions_forfaitaires: 0,
    ligne22_total_abs: tvaData.ligne20AutresBiensServices,
    ligne23_tva_immobilisations: tvaData.ligne19Immobilisations,
    ligne24_credit_anterieur: tvaData.ligne22ReportCreditAnterieur,
    ligne25_omissions_complements: 0,
    ligne25A_coefficient_deduction: 0,
    ligneAE_sommes_imputer: 0,
    ligne26_total_tva_deductible: totalTVADeductible,
    ligne2E_tva_produits_petroliers: 0,

    // III - TVA NETTE
    ligne28_tva_due: tvaDue,
    ligne29_credit: creditTVA,

    // Acomptes
    acompte1_paye: 0,
    acompte1_restant: 0,
    acompte2_paye: 0,
    acompte2_restant: 0,
    ligne30_total_acomptes: tvaData.acomptesVerses,

    // Résultat net
    ligne33_solde_a_payer: tvaDue,
    ligne34_excedent_versement: 0,
    ligne35_solde_excedentaire: creditTVA,

    // VI - Récapitulation
    ligne49_solde_excedentaire: creditTVA,
    ligne50_remboursement_demande: tvaData.remboursementDemande,
    ligne51_credit_a_reporter: tvaData.creditAReporter,
    ligne54_tva_nette_due: tvaDue,
    ligne55_taxes_assimilees: 0,
    ligne56_total_a_payer: tvaDue,
    ligne57_base_acomptes: 0,
  }
}

// ============ Declaration Type Selector ============

interface DeclarationTypeSelectorProps {
  company: Company
  onBack: () => void
  onSelect: (typeId: string) => void
}

function DeclarationTypeSelector({ company, onBack, onSelect }: DeclarationTypeSelectorProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Choisir un autre type de déclaration pour {company.name}
            </h1>
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <BackIcon />
            Retourner à la liste des déclarations
          </button>
        </div>

        {/* Instruction */}
        <div className="mb-8">
          <p className="text-lg text-gray-600">Choisissez un type de déclaration à effectuer :</p>
        </div>

        {/* Grid of declaration types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DECLARATION_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => onSelect(type.id)}
              className="p-6 bg-green-500 text-white text-center font-medium rounded-lg hover:bg-green-600 transition-all shadow-sm hover:shadow-md"
              style={{ minHeight: '100px' }}
            >
              <span className="text-sm leading-tight">{type.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============ Autre Fiscale Selector (Sous-menu) ============

interface AutreFiscaleSelectorProps {
  company: Company
  onBack: () => void
  onSelect: (typeId: string) => void
}

function AutreFiscaleSelector({ company, onBack, onSelect }: AutreFiscaleSelectorProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Choisir un autre type de déclaration pour {company.name}
            </h1>
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <BackIcon />
            Retourner à la liste des déclarations
          </button>
        </div>

        {/* Instruction */}
        <div className="mb-8">
          <p className="text-lg text-gray-600">Choisissez un type de déclaration à effectuer :</p>
        </div>

        {/* Grid of autre fiscale types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {AUTRE_FISCALE_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => onSelect(type.id)}
              className="p-6 bg-green-500 text-white text-center font-medium rounded-lg hover:bg-green-600 transition-all shadow-sm hover:shadow-md"
              style={{ minHeight: '100px' }}
            >
              <span className="text-sm leading-tight">{type.label}</span>
            </button>
          ))}
        </div>

        {/* Retour au menu général */}
        <div className="flex justify-end">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Retourner au menu général
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Main Component ============

interface VosDeclarationsPageProps {
  onNavigate?: (page: string) => void
}

export default function VosDeclarationsPage({ onNavigate: _onNavigate }: VosDeclarationsPageProps) {
  const [company, setCompany] = useState<Company | null>(null)
  const [declarations, setDeclarations] = useState<FiscalDeclaration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDeclaration, setSelectedDeclaration] = useState<FiscalDeclaration | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedDocument, setSelectedDocument] = useState<DeclarationDocument | null>(null)
  const [tvaData, setTvaData] = useState<TVACalculationResult | null>(null)
  const [calculatingTVA, setCalculatingTVA] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // Debug: log viewMode changes
  useEffect(() => {
    console.log('viewMode changed to:', viewMode)
  }, [viewMode])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, siren, address, postal_code, city')
        .eq('id', COMPANY_ID)
        .single()

      if (companyError) throw companyError
      setCompany(companyData)

      const { data: declarationsData, error: declarationsError } = await supabase
        .from('fiscal_declarations')
        .select('*')
        .eq('company_id', COMPANY_ID)
        .order('created_at', { ascending: false })

      if (declarationsError) throw declarationsError
      setDeclarations(declarationsData || [])
    } catch (err) {
      console.error('Erreur chargement:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDocument = async (declaration: FiscalDeclaration, document: DeclarationDocument) => {
    setSelectedDeclaration(declaration)
    setSelectedDocument(document)

    // Si c'est un formulaire CA12, calculer les données TVA
    if (document.formType === 'CA12' && declaration.period_start && declaration.period_end) {
      setCalculatingTVA(true)
      try {
        const periodStart = new Date(declaration.period_start)
        const periodEnd = new Date(declaration.period_end)
        const data = await calculateTVACA12(COMPANY_ID, periodStart, periodEnd)
        setTvaData(data)
      } catch (err) {
        console.error('Erreur calcul TVA:', err)
      } finally {
        setCalculatingTVA(false)
      }
    }

    setViewMode('form')
  }

  const getStatusBadgeStyle = (status: string, variant: 'pill' | 'badge' = 'pill') => {
    const isSuccess = status.toLowerCase().includes('réussie') || status.toLowerCase().includes('success')
    const isError = status.toLowerCase().includes('erreur') || status.toLowerCase().includes('error')
    const isPending = status.toLowerCase().includes('en cours') || status.toLowerCase().includes('pending')

    if (variant === 'badge') {
      if (isSuccess) {
        return { backgroundColor: '#22C55E', color: '#FFFFFF', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 500 }
      }
      if (isError) {
        return { backgroundColor: '#EF4444', color: '#FFFFFF', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 500 }
      }
      if (isPending) {
        return { backgroundColor: '#F59E0B', color: '#FFFFFF', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 500 }
      }
      return { backgroundColor: '#6B7280', color: '#FFFFFF', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 500 }
    }

    if (isSuccess) return { backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }
    if (isError) return { backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }
    if (isPending) return { backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }
    return { backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'TVA': return { backgroundColor: '#E0E7FF', color: '#3730A3' }
      case 'IS': return { backgroundColor: '#FCE7F3', color: '#9D174D' }
      case 'Liasse fiscale': return { backgroundColor: '#ECFDF5', color: '#065F46' }
      case 'CVAE': return { backgroundColor: '#FEF3C7', color: '#92400E' }
      case 'CFE': return { backgroundColor: '#E0F2FE', color: '#0369A1' }
      default: return { backgroundColor: '#F3F4F6', color: '#374151' }
    }
  }

  const getDeclarationDocuments = (declaration: FiscalDeclaration): DeclarationDocument[] => {
    const baseDocuments: DeclarationDocument[] = [
      {
        id: `${declaration.id}-info`,
        label: 'Informations générales sur la déclaration',
        status: declaration.status,
        status_date: declaration.status_date,
        formType: 'INFO'
      }
    ]

    switch (declaration.type) {
      case 'TVA':
        baseDocuments.push({
          id: `${declaration.id}-ca12`,
          label: 'CA12 - Déclaration annuelle de TVA',
          status: declaration.status,
          status_date: declaration.status_date,
          formType: 'CA12'
        })
        break
      case 'IS':
        baseDocuments.push({
          id: `${declaration.id}-2065`,
          label: '2065 - Impôt sur les sociétés',
          status: declaration.status,
          status_date: declaration.status_date,
          formType: '2065'
        })
        break
      default:
        baseDocuments.push({
          id: `${declaration.id}-doc`,
          label: declaration.label,
          status: declaration.status,
          status_date: declaration.status_date,
          formType: 'OTHER'
        })
    }

    return baseDocuments
  }

  const formatStatusWithDate = (status: string, statusDate: string | null) => {
    if (statusDate) {
      const date = new Date(statusDate)
      const formattedDate = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      if (status.toLowerCase().includes('réussie')) {
        return `Télédéclaration réussie le ${formattedDate}`
      }
      return `${status} le ${formattedDate}`
    }
    return status
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#006666] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement des déclarations...</p>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold mb-2">Erreur</h3>
          <p className="text-red-600">{error || 'Entreprise non trouvée'}</p>
        </div>
      </div>
    )
  }

  // ============ Form View (CA12) ============
  if (viewMode === 'form' && selectedDeclaration && selectedDocument) {
    if (calculatingTVA) {
      return (
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#006666] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Calcul des données TVA...</p>
          </div>
        </div>
      )
    }

    // Convertir les données TVA au format CA12FormData
    const ca12Data = convertTVAToCA12FormData(tvaData, company, selectedDeclaration)

    return (
      <CA12FormCerfa
        data={ca12Data}
        onBack={() => {
          setViewMode('detail')
          setSelectedDocument(null)
          setTvaData(null)
        }}
        readOnly={false}
      />
    )
  }

  // ============ Type Selector View ============
  if (viewMode === 'type-selector') {
    console.log('Rendu Type Selector View')
    return (
      <DeclarationTypeSelector
        company={company}
        onBack={() => setViewMode('list')}
        onSelect={(typeId) => {
          console.log('Selected type:', typeId)
          if (typeId === 'autre-fiscale') {
            // Naviguer vers le sous-menu des autres déclarations fiscales
            setViewMode('autre-fiscale-selector')
          } else {
            // TODO: Autres types de déclarations
            setViewMode('list')
          }
        }}
      />
    )
  }

  // ============ Autre Fiscale Selector View ============
  if (viewMode === 'autre-fiscale-selector') {
    console.log('Rendu Autre Fiscale Selector View')
    return (
      <AutreFiscaleSelector
        company={company}
        onBack={() => setViewMode('type-selector')}
        onSelect={(typeId) => {
          console.log('Selected autre fiscale type:', typeId)
          if (typeId === 'liasse-complete') {
            // Naviguer vers la page de nouvelle liasse fiscale
            _onNavigate?.('nouvelle-liasse-fiscale')
          } else {
            // TODO: Autres sous-types
            setViewMode('list')
          }
        }}
      />
    )
  }

  // ============ Detail View ============
  if (viewMode === 'detail' && selectedDeclaration) {
    const documents = getDeclarationDocuments(selectedDeclaration)

    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#F9FAFB' }}>
        <div className="px-8 py-6">
          <button
            onClick={() => {
              setViewMode('list')
              setSelectedDeclaration(null)
            }}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <BackIcon />
            <span>Retour aux déclarations</span>
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between" style={{ backgroundColor: '#FAFAFA' }}>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white"
                value={company.id}
                disabled
              >
                <option value={company.id}>{company.name}</option>
              </select>

              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-all"
                >
                  <WrenchIcon />
                  Autres Actions
                  <ChevronDownIcon />
                </button>

                {showActionsMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">Modifier</button>
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">Dupliquer</button>
                    <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Supprimer</button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedDeclaration.label} - {company.name}
              </h1>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200" style={{ backgroundColor: '#FAFAFA' }}>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Document</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">État</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{doc.label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block" style={getStatusBadgeStyle(doc.status, 'badge')}>
                          {formatStatusWithDate(doc.status, doc.status_date)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          className="inline-flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                          style={{ backgroundColor: '#64748B' }}
                          onClick={() => handleViewDocument(selectedDeclaration, doc)}
                        >
                          <PlayIcon />
                          Visualiser
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-8 border-t border-gray-200 flex flex-wrap items-center justify-center gap-6">
              <button className="inline-flex items-center gap-3 px-8 py-4 bg-gray-800 text-white text-base font-medium rounded-lg hover:bg-gray-900 transition-all shadow-sm">
                <PrinterIcon />
                Imprimer ou voir la déclaration
              </button>
              <button
                className="inline-flex items-center gap-3 px-8 py-4 text-white text-base font-medium rounded-lg transition-all shadow-sm"
                style={{ backgroundColor: '#64748B' }}
              >
                <PrinterIcon />
                Imprimer l'accusé de réception
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============ List View ============
  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center shadow-md">
            <DocumentIcon />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Mes déclarations</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200" style={{ backgroundColor: '#FAFAFA' }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">{company.name}</h2>
                  <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                    <EditIcon />
                  </button>
                </div>
                {company.siren && <p className="text-gray-500 text-sm mt-0.5">({company.siren})</p>}
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-all shadow-sm">
                  <PlusIcon />
                  Remplir une liasse pour un autre exercice
                </button>
                <button
                  onClick={() => {
                    console.log('Bouton Autre déclaration cliqué, viewMode actuel:', viewMode)
                    setViewMode('type-selector')
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                >
                  <ListIcon />
                  Autre déclaration
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200" style={{ backgroundColor: '#FAFAFA' }}>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Déclaration</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">État</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {declarations.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <DocumentIcon />
                        </div>
                        <p className="text-lg font-medium text-gray-600 mb-1">Aucune déclaration</p>
                        <p className="text-sm text-gray-500">Commencez par créer une nouvelle déclaration</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  declarations.map((declaration) => (
                    <tr
                      key={declaration.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedDeclaration(declaration)
                        setViewMode('detail')
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 text-xs font-medium rounded" style={getTypeBadgeColor(declaration.type)}>
                            {declaration.type}
                          </span>
                          <span className="text-sm text-gray-900">{declaration.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 text-sm font-medium rounded-full" style={getStatusBadgeStyle(declaration.status)}>
                          {declaration.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          className="inline-flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                          style={{ backgroundColor: '#64748B' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDeclaration(declaration)
                            setViewMode('detail')
                          }}
                        >
                          <PlayIcon />
                          Visualiser
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
