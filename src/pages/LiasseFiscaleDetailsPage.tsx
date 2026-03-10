import { useState, useEffect, useMemo } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

interface LiasseFiscaleDetailsPageProps {
  onNavigate?: (page: string) => void
}

interface FeuilletData {
  id: string
  name: string
  code: string
  description: string
  status: 'empty' | 'partial' | 'complete'
}

interface BilanLine {
  code: string
  label: string
  brut: number
  amortissements: number
  net: number
  netN1: number
}

export default function LiasseFiscaleDetailsPage({ onNavigate }: LiasseFiscaleDetailsPageProps) {
  const [selectedFeuillet, setSelectedFeuillet] = useState('2050')
  const [loading, setLoading] = useState(true)
  const [bilanActifData, setBilanActifData] = useState<BilanLine[]>([])
  const [bilanPassifData, setBilanPassifData] = useState<BilanLine[]>([])

  // Feuillets list
  const feuillets: FeuilletData[] = [
    { id: '2050', name: 'Bilan - Actif', code: '2050', description: 'Actif immobilisé et circulant', status: 'complete' },
    { id: '2051', name: 'Bilan - Passif', code: '2051', description: 'Capitaux propres et dettes', status: 'complete' },
    { id: '2052', name: 'Compte de résultat (1)', code: '2052', description: 'Produits d\'exploitation', status: 'partial' },
    { id: '2053', name: 'Compte de résultat (2)', code: '2053', description: 'Charges d\'exploitation', status: 'partial' },
    { id: '2054', name: 'Immobilisations', code: '2054', description: 'État des immobilisations', status: 'empty' },
    { id: '2055', name: 'Amortissements', code: '2055', description: 'État des amortissements', status: 'empty' },
    { id: '2056', name: 'Provisions', code: '2056', description: 'État des provisions', status: 'empty' },
    { id: '2057', name: 'Échéances créances/dettes', code: '2057', description: 'État des échéances', status: 'empty' },
    { id: '2058-A', name: 'Résultat fiscal', code: '2058-A', description: 'Détermination du résultat fiscal', status: 'empty' },
    { id: '2058-B', name: 'Déficits/Provisions', code: '2058-B', description: 'Déficits et provisions non déductibles', status: 'empty' },
    { id: '2058-C', name: 'Affectation résultat', code: '2058-C', description: 'Tableau d\'affectation du résultat', status: 'empty' },
    { id: '2059-A', name: 'Plus/moins-values', code: '2059-A', description: 'Détermination des plus et moins-values', status: 'empty' },
    { id: '2059-B', name: 'Affectation plus-values', code: '2059-B', description: 'Affectation des plus-values', status: 'empty' },
    { id: '2059-C', name: 'Réintégrations', code: '2059-C', description: 'Suivi des réintégrations', status: 'empty' },
    { id: '2059-D', name: 'Réserve spéciale', code: '2059-D', description: 'Réserve spéciale des plus-values', status: 'empty' },
    { id: '2059-E', name: 'Valeurs mobilières', code: '2059-E', description: 'Détermination des valeurs mobilières', status: 'empty' },
    { id: '2059-F', name: 'Composition capital', code: '2059-F', description: 'Composition du capital social', status: 'empty' },
    { id: '2059-G', name: 'Filiales/Participations', code: '2059-G', description: 'Filiales et participations', status: 'empty' },
  ]

  // Bilan Actif structure (2050)
  const bilanActifStructure = [
    { category: 'ACTIF IMMOBILISÉ', lines: [
      { code: 'AA', label: 'Capital souscrit non appelé' },
      { code: 'AB', label: 'Frais d\'établissement' },
      { code: 'CX', label: 'Frais de développement' },
      { code: 'AF', label: 'Concessions, brevets et droits similaires' },
      { code: 'AH', label: 'Fonds commercial' },
      { code: 'AJ', label: 'Autres immobilisations incorporelles' },
      { code: 'AL', label: 'Avances et acomptes sur immobilisations incorporelles' },
      { code: 'AN', label: 'Terrains' },
      { code: 'AP', label: 'Constructions' },
      { code: 'AR', label: 'Installations techniques, matériel et outillage industriels' },
      { code: 'AT', label: 'Autres immobilisations corporelles' },
      { code: 'AV', label: 'Immobilisations en cours' },
      { code: 'AX', label: 'Avances et acomptes' },
      { code: 'CS', label: 'Participations évaluées selon mise en équivalence' },
      { code: 'CU', label: 'Autres participations' },
      { code: 'BB', label: 'Créances rattachées à des participations' },
      { code: 'BD', label: 'Autres titres immobilisés' },
      { code: 'BF', label: 'Prêts' },
      { code: 'BH', label: 'Autres immobilisations financières' },
    ]},
    { category: 'ACTIF CIRCULANT', lines: [
      { code: 'BJ', label: 'Matières premières et autres approvisionnements' },
      { code: 'BL', label: 'En-cours de production de biens' },
      { code: 'BN', label: 'En-cours de production de services' },
      { code: 'BP', label: 'Produits intermédiaires et finis' },
      { code: 'BR', label: 'Marchandises' },
      { code: 'BT', label: 'Avances et acomptes versés sur commandes' },
      { code: 'BV', label: 'Clients et comptes rattachés' },
      { code: 'BX', label: 'Autres créances' },
      { code: 'BZ', label: 'Capital souscrit et appelé, non versé' },
      { code: 'CB', label: 'Valeurs mobilières de placement' },
      { code: 'CD', label: 'Disponibilités' },
    ]},
    { category: 'COMPTES DE RÉGULARISATION', lines: [
      { code: 'CH', label: 'Charges constatées d\'avance' },
    ]},
  ]

  // Bilan Passif structure (2051)
  const bilanPassifStructure = [
    { category: 'CAPITAUX PROPRES', lines: [
      { code: 'DA', label: 'Capital social ou individuel' },
      { code: 'DB', label: 'Primes d\'émission, de fusion, d\'apport' },
      { code: 'DC', label: 'Écarts de réévaluation' },
      { code: 'DD', label: 'Réserve légale' },
      { code: 'DE', label: 'Réserves statutaires ou contractuelles' },
      { code: 'DF', label: 'Réserves réglementées' },
      { code: 'DG', label: 'Autres réserves' },
      { code: 'DH', label: 'Report à nouveau' },
      { code: 'DI', label: 'Résultat de l\'exercice' },
      { code: 'DJ', label: 'Subventions d\'investissement' },
      { code: 'DK', label: 'Provisions réglementées' },
    ]},
    { category: 'PROVISIONS', lines: [
      { code: 'DM', label: 'Provisions pour risques' },
      { code: 'DN', label: 'Provisions pour charges' },
    ]},
    { category: 'DETTES', lines: [
      { code: 'DP', label: 'Emprunts obligataires convertibles' },
      { code: 'DQ', label: 'Autres emprunts obligataires' },
      { code: 'DR', label: 'Emprunts et dettes auprès des établissements de crédit' },
      { code: 'DS', label: 'Emprunts et dettes financières diverses' },
      { code: 'DT', label: 'Avances et acomptes reçus sur commandes en cours' },
      { code: 'DU', label: 'Dettes fournisseurs et comptes rattachés' },
      { code: 'DV', label: 'Dettes fiscales et sociales' },
      { code: 'DW', label: 'Dettes sur immobilisations et comptes rattachés' },
      { code: 'DX', label: 'Autres dettes' },
    ]},
    { category: 'COMPTES DE RÉGULARISATION', lines: [
      { code: 'DY', label: 'Produits constatés d\'avance' },
    ]},
  ]

  // Fetch accounting data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Get all accounting entries for the period
        const { data: entries } = await supabase
          .from('accounting_entries')
          .select('account_code, debit, credit')
          .eq('company_id', COMPANY_ID)
          .gte('date', '2024-04-30')
          .lte('date', '2025-12-31')

        if (entries) {
          // Aggregate by account
          const accountTotals = new Map<string, { debit: number; credit: number }>()
          entries.forEach(e => {
            const existing = accountTotals.get(e.account_code) || { debit: 0, credit: 0 }
            accountTotals.set(e.account_code, {
              debit: existing.debit + (Number(e.debit) || 0),
              credit: existing.credit + (Number(e.credit) || 0)
            })
          })

          // Map accounts to bilan lines
          // This is a simplified mapping - in real implementation, you'd have a proper mapping table
          const mapAccountToBilanActif = (code: string): number => {
            let total = 0
            accountTotals.forEach((val, accountCode) => {
              // Map account ranges to bilan codes
              if (code === 'CD' && accountCode.startsWith('512')) {
                // Disponibilités = Bank accounts
                total += val.debit - val.credit
              }
              if (code === 'BV' && accountCode.startsWith('411')) {
                // Clients
                total += val.debit - val.credit
              }
              if (code === 'AR' && (accountCode.startsWith('215') || accountCode.startsWith('218'))) {
                // Installations techniques
                total += val.debit - val.credit
              }
            })
            return total
          }

          const mapAccountToBilanPassif = (code: string): number => {
            let total = 0
            accountTotals.forEach((val, accountCode) => {
              if (code === 'DA' && accountCode.startsWith('101')) {
                // Capital
                total += val.credit - val.debit
              }
              if (code === 'DU' && accountCode.startsWith('401')) {
                // Fournisseurs
                total += val.credit - val.debit
              }
              if (code === 'DV' && (accountCode.startsWith('43') || accountCode.startsWith('44'))) {
                // Dettes fiscales et sociales
                total += val.credit - val.debit
              }
              if (code === 'DI') {
                // Résultat = Produits - Charges
                if (accountCode.startsWith('7')) {
                  total += val.credit - val.debit
                } else if (accountCode.startsWith('6')) {
                  total -= val.debit - val.credit
                }
              }
            })
            return total
          }

          // Build actif data
          const actifData: BilanLine[] = []
          bilanActifStructure.forEach(cat => {
            cat.lines.forEach(line => {
              const net = mapAccountToBilanActif(line.code)
              actifData.push({
                code: line.code,
                label: line.label,
                brut: net > 0 ? net : 0,
                amortissements: 0,
                net: net,
                netN1: 0
              })
            })
          })
          setBilanActifData(actifData)

          // Build passif data
          const passifData: BilanLine[] = []
          bilanPassifStructure.forEach(cat => {
            cat.lines.forEach(line => {
              const net = mapAccountToBilanPassif(line.code)
              passifData.push({
                code: line.code,
                label: line.label,
                brut: 0,
                amortissements: 0,
                net: net,
                netN1: 0
              })
            })
          })
          setBilanPassifData(passifData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Totals
  const totalActif = useMemo(() => bilanActifData.reduce((sum, row) => sum + row.net, 0), [bilanActifData])
  const totalPassif = useMemo(() => bilanPassifData.reduce((sum, row) => sum + row.net, 0), [bilanPassifData])

  const formatNumber = (value: number): string => {
    if (value === 0) return ''
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return '#059669'
      case 'partial': return '#F59E0B'
      default: return '#9CA3AF'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete': return 'Complet'
      case 'partial': return 'Partiel'
      default: return 'Vide'
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Left sidebar - Feuillets list */}
      <div className="w-72 bg-white border-r flex flex-col" style={{ borderColor: '#E4E5E7' }}>
        <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Liasse fiscale 2025</h2>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>MON_ENTREPRISE</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>01/01/2025 - 31/12/2025</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {feuillets.map(feuillet => (
            <button
              key={feuillet.id}
              onClick={() => setSelectedFeuillet(feuillet.id)}
              className={`w-full text-left px-4 py-3 border-b transition-colors ${
                selectedFeuillet === feuillet.id ? 'bg-[#E6F2F2]' : 'hover:bg-gray-50'
              }`}
              style={{ borderColor: '#F2F2F3' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                    {feuillet.code}
                  </div>
                  <div className="text-xs" style={{ color: '#6B7280' }}>
                    {feuillet.name}
                  </div>
                </div>
                <span
                  className="px-2 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: `${getStatusColor(feuillet.status)}20`,
                    color: getStatusColor(feuillet.status)
                  }}
                >
                  {getStatusLabel(feuillet.status)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => onNavigate?.('vos-declarations')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Retour aux déclarations
          </button>
        </div>
      </div>

      {/* Main content - Selected feuillet */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
                {feuillets.find(f => f.id === selectedFeuillet)?.name || 'Feuillet'}
              </h1>
              <p className="text-sm" style={{ color: '#6B7280' }}>
                Formulaire {selectedFeuillet} - {feuillets.find(f => f.id === selectedFeuillet)?.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Imprimer
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#006666' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Exporter PDF
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
            </div>
          ) : (
            <>
              {selectedFeuillet === '2050' && (
                <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b" style={{ borderColor: '#E4E5E7' }}>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: '#6B7280', width: '50px' }}>Code</th>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: '#6B7280' }}>Libellé</th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: '#6B7280', width: '120px' }}>Brut</th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: '#6B7280', width: '120px' }}>Amort./Prov.</th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: '#6B7280', width: '120px' }}>Net N</th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: '#6B7280', width: '120px' }}>Net N-1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bilanActifStructure.map((category, catIdx) => (
                        <>
                          <tr key={`cat-${catIdx}`} className="bg-[#F8F9FA]">
                            <td colSpan={6} className="px-4 py-2 font-semibold text-xs uppercase" style={{ color: '#006666' }}>
                              {category.category}
                            </td>
                          </tr>
                          {category.lines.map((line, lineIdx) => {
                            const data = bilanActifData.find(d => d.code === line.code)
                            return (
                              <tr key={`${catIdx}-${lineIdx}`} className="border-b hover:bg-gray-50" style={{ borderColor: '#F2F2F3' }}>
                                <td className="px-4 py-2 font-mono text-xs" style={{ color: '#6B7280' }}>{line.code}</td>
                                <td className="px-4 py-2" style={{ color: '#141A1F' }}>{line.label}</td>
                                <td className="px-4 py-2 text-right font-mono" style={{ color: '#141A1F' }}>{formatNumber(data?.brut || 0)}</td>
                                <td className="px-4 py-2 text-right font-mono" style={{ color: '#141A1F' }}>{formatNumber(data?.amortissements || 0)}</td>
                                <td className="px-4 py-2 text-right font-mono font-medium" style={{ color: data?.net && data.net !== 0 ? '#006666' : '#9CA3AF' }}>
                                  {formatNumber(data?.net || 0)}
                                </td>
                                <td className="px-4 py-2 text-right font-mono" style={{ color: '#9CA3AF' }}>{formatNumber(data?.netN1 || 0)}</td>
                              </tr>
                            )
                          })}
                        </>
                      ))}
                      <tr className="bg-[#006666] text-white font-semibold">
                        <td colSpan={4} className="px-4 py-3">TOTAL ACTIF</td>
                        <td className="px-4 py-3 text-right font-mono">{formatNumber(totalActif)}</td>
                        <td className="px-4 py-3 text-right font-mono">0</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {selectedFeuillet === '2051' && (
                <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b" style={{ borderColor: '#E4E5E7' }}>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: '#6B7280', width: '50px' }}>Code</th>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: '#6B7280' }}>Libellé</th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: '#6B7280', width: '150px' }}>Montant N</th>
                        <th className="text-right px-4 py-3 font-medium" style={{ color: '#6B7280', width: '150px' }}>Montant N-1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bilanPassifStructure.map((category, catIdx) => (
                        <>
                          <tr key={`cat-${catIdx}`} className="bg-[#F8F9FA]">
                            <td colSpan={4} className="px-4 py-2 font-semibold text-xs uppercase" style={{ color: '#006666' }}>
                              {category.category}
                            </td>
                          </tr>
                          {category.lines.map((line, lineIdx) => {
                            const data = bilanPassifData.find(d => d.code === line.code)
                            return (
                              <tr key={`${catIdx}-${lineIdx}`} className="border-b hover:bg-gray-50" style={{ borderColor: '#F2F2F3' }}>
                                <td className="px-4 py-2 font-mono text-xs" style={{ color: '#6B7280' }}>{line.code}</td>
                                <td className="px-4 py-2" style={{ color: '#141A1F' }}>{line.label}</td>
                                <td className="px-4 py-2 text-right font-mono font-medium" style={{ color: data?.net && data.net !== 0 ? '#006666' : '#9CA3AF' }}>
                                  {formatNumber(data?.net || 0)}
                                </td>
                                <td className="px-4 py-2 text-right font-mono" style={{ color: '#9CA3AF' }}>{formatNumber(data?.netN1 || 0)}</td>
                              </tr>
                            )
                          })}
                        </>
                      ))}
                      <tr className="bg-[#006666] text-white font-semibold">
                        <td colSpan={2} className="px-4 py-3">TOTAL PASSIF</td>
                        <td className="px-4 py-3 text-right font-mono">{formatNumber(totalPassif)}</td>
                        <td className="px-4 py-3 text-right font-mono">0</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {!['2050', '2051'].includes(selectedFeuillet) && (
                <div className="bg-white border rounded-lg p-12 text-center" style={{ borderColor: '#E4E5E7' }}>
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <h3 className="text-lg font-medium mb-2" style={{ color: '#141A1F' }}>
                    Feuillet {selectedFeuillet}
                  </h3>
                  <p className="text-sm" style={{ color: '#6B7280' }}>
                    Ce feuillet sera implémenté prochainement avec les calculs automatiques.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
