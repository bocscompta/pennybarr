import { useState } from 'react'

interface DeclarationsPageProps {
  onNavigate?: (page: string) => void
}

type DeclarationView = 'main' | 'autre-declaration'

export default function DeclarationsPage({ onNavigate }: DeclarationsPageProps) {
  const [currentView, setCurrentView] = useState<DeclarationView>('main')

  // Main declaration types
  const mainDeclarationTypes = [
    { id: 'depot-greffe', label: 'Dépôt des comptes annuels au greffe', color: '#5B8C5A' },
    { id: 'autre-declaration', label: 'Autre déclaration fiscale annuelle', color: '#6B9E6A' },
    { id: 'tva-annuelle', label: 'TVA Annuelle Remb. 3517DDR', color: '#7BAE7A' },
    { id: 'annexe-trimestrielle', label: 'Annexe trimestrielle : 3310-TIC - CA3', color: '#5B8C5A' },
    { id: 'agricole-simplifie', label: 'Agricole simplifié : annuel 3517 - AGR', color: '#6B9E6A' },
    { id: 'tva-agricole', label: 'TVA trimestrielle Agricole 3525-BIS', color: '#7BAE7A' },
  ]

  // Other declaration types (sous-menu)
  const autreDeclarationTypes = [
    { id: 'liasse-complete', label: 'Liasse fiscale complète', color: '#5B8C5A' },
    { id: 'credits-impots', label: "Crédits d'impôts uniquement (2069-RCI etc.)", color: '#6B9E6A' },
    { id: 'decloyer', label: 'DECLOYER seule', color: '#7BAE7A' },
    { id: 'outre-mer-2083', label: "Aide fiscale à l'investissement outre-mer (2083)", color: '#5B8C5A' },
    { id: 'outre-mer-2083-m', label: "Aide fiscale à l'investissement outre-mer (2083-M)", color: '#6B9E6A' },
    { id: 'cvae-1330', label: '1330-CVAE seule', color: '#5B8C5A' },
    { id: 'pays-par-pays', label: 'Pays par pays 2258', color: '#6B9E6A' },
    { id: 'prix-transfert', label: 'Prix de transfert 2257', color: '#7BAE7A' },
    { id: 'ecf-3030', label: 'Compte-rendu de mission ECF 3030', color: '#5B8C5A' },
    { id: 'tva-perimetre', label: 'Assujetti unique TVA déclaration de périmètre 3310-PAU', color: '#6B9E6A' },
  ]

  const handleDeclarationClick = (id: string) => {
    if (id === 'autre-declaration') {
      setCurrentView('autre-declaration')
    } else if (id === 'liasse-complete') {
      // Navigate to the new liasse fiscale page
      onNavigate?.('nouvelle-liasse-fiscale')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#141A1F' }}>
              {currentView === 'main'
                ? 'Vos déclarations'
                : 'Choisir un autre type de déclaration pour MON_ENTREPRISE'}
            </h1>
          </div>

          {currentView === 'autre-declaration' && (
            <button
              onClick={() => setCurrentView('main')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: '#3D3D3D' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Retourner à la liste des déclarations
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-medium mb-6" style={{ color: '#6B7280' }}>
            Choisissez un type de déclaration à effectuer :
          </h2>

          {currentView === 'main' ? (
            /* Main declaration types grid */
            <div className="grid grid-cols-3 gap-4">
              {mainDeclarationTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleDeclarationClick(type.id)}
                  className="p-6 rounded-xl text-white text-center font-medium text-lg transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${type.color} 0%, ${type.color}dd 100%)`,
                    minHeight: '120px'
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          ) : (
            /* Autre déclaration types grid */
            <>
              <div className="grid grid-cols-3 gap-4">
                {autreDeclarationTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleDeclarationClick(type.id)}
                    className="p-6 rounded-xl text-white text-center font-medium transition-all hover:scale-[1.02] hover:shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${type.color} 0%, ${type.color}dd 100%)`,
                      minHeight: '100px'
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setCurrentView('main')}
                  className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                >
                  Retourner au menu général
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
