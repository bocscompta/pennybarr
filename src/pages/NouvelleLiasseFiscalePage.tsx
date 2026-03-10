import { useState } from 'react'

interface NouvelleLiasseFiscalePageProps {
  onNavigate?: (page: string) => void
}

export default function NouvelleLiasseFiscalePage({ onNavigate }: NouvelleLiasseFiscalePageProps) {
  const currentYear = new Date().getFullYear()

  // Form state
  const [dateDebut, setDateDebut] = useState(`01/01/${currentYear}`)
  const [dateFin, setDateFin] = useState(`31/12/${currentYear}`)
  const [rof, setRof] = useState('IS1 - ROF par défaut')
  const [premierExercice, setPremierExercice] = useState(false)
  const [dureeExercicePrecedent, setDureeExercicePrecedent] = useState(12)
  const [situationParticuliere, setSituationParticuliere] = useState('pas-applicable')
  const [saving, setSaving] = useState(false)

  const situationOptions = [
    { value: 'pas-applicable', label: 'Pas applicable' },
    { value: 'cession-totale', label: 'Cession totale' },
    { value: 'cession-partielle', label: 'Cession partielle' },
    { value: 'cessation', label: 'Cessation d\'activité' },
    { value: 'liquidation', label: 'Liquidation' },
    { value: 'redressement', label: 'Redressement judiciaire' },
    { value: 'fusion', label: 'Fusion' },
    { value: 'apport-partiel', label: 'Apport partiel d\'actif' },
  ]

  const handleSave = async () => {
    setSaving(true)
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 500))
    setSaving(false)
    // Navigate to liasse fiscale details page
    onNavigate?.('liasse-fiscale-details')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: '#141A1F' }}>
            Nouvelle liasse fiscale - MON_ENTREPRISE
          </h1>

          <button
            onClick={() => onNavigate?.('vos-declarations')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#3D3D3D' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Retourner aux déclarations
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Section title */}
          <h2 className="text-xl font-medium mb-8" style={{ color: '#9CA3AF' }}>
            Informations générales sur l'exercice déclaré
          </h2>

          {/* Exercice déclaré section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b" style={{ color: '#6B7280', borderColor: '#E4E5E7' }}>
              Exercice déclaré
            </h3>

            <div className="bg-white border rounded-xl p-6" style={{ borderColor: '#E4E5E7' }}>
              {/* Dates de l'exercice */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3" style={{ color: '#141A1F' }}>
                  Date de début et de clôture de l'exercice déclaré (exercice N)
                </label>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>Exercice du :</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dateDebut}
                        onChange={(e) => setDateDebut(e.target.value)}
                        className="w-40 px-3 py-2 text-sm border rounded-lg pr-10"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>Au :</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dateFin}
                        onChange={(e) => setDateFin(e.target.value)}
                        className="w-40 px-3 py-2 text-sm border rounded-lg pr-10"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROF */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#141A1F' }}>
                  ROF (Référence d'Obligation Fiscale) de la liasse fiscale
                </label>
                <input
                  type="text"
                  value={rof}
                  onChange={(e) => setRof(e.target.value)}
                  className="w-64 px-3 py-2 text-sm border rounded-lg bg-gray-50"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              {/* Premier exercice checkbox */}
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={premierExercice}
                    onChange={(e) => setPremierExercice(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ accentColor: '#006666' }}
                  />
                  <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                    Il s'agit du premier exercice de l'entreprise
                  </span>
                </label>
              </div>

              {/* Durée exercice précédent */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#141A1F' }}>
                  Durée en mois de l'exercice précédent (exercice N-1)
                </label>
                <input
                  type="number"
                  value={dureeExercicePrecedent}
                  onChange={(e) => setDureeExercicePrecedent(parseInt(e.target.value) || 0)}
                  min={1}
                  max={24}
                  className="w-20 px-3 py-2 text-sm border rounded-lg"
                  style={{ borderColor: '#D6D9DB' }}
                  disabled={premierExercice}
                />
              </div>

              {/* Situation particulière */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#141A1F' }}>
                  Cession/cessation d'activité ou situation particulière
                </label>
                <div className="relative w-80">
                  <select
                    value={situationParticuliere}
                    onChange={(e) => setSituationParticuliere(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg appearance-none bg-white pr-10"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    {situationOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 text-white font-medium rounded-lg transition-all hover:shadow-lg disabled:opacity-50"
              style={{ backgroundColor: '#5B8C5A' }}
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                </svg>
              )}
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
