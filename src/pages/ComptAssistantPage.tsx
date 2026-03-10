import { useState } from 'react'

interface ComptAssistantPageProps {
  onNavigate?: (page: string) => void
  userName?: string
}

export default function ComptAssistantPage({ onNavigate: _onNavigate, userName = 'Utilisateur' }: ComptAssistantPageProps) {
  const [inputValue, setInputValue] = useState('')
  const [useCompanyData, setUseCompanyData] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null)

  const topics = [
    {
      id: 'comptabilite',
      label: 'La comptabilité',
      description: 'Retrouvez toutes les informations liées à la comptabilité pour un comptable en France.',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      id: 'pennybarr',
      label: "L'utilisation de Pennybarr",
      description: "Retrouvez toutes les informations pour savoir comment utiliser Pennybarr de manière optimale.",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      ),
    },
    {
      id: 'facturation',
      label: 'La facturation électronique',
      description: "Retrouvez toutes les informations liées à la facturation électronique et ses réglementations.",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
  ]

  const agents = [
    {
      id: 'sante-financiere',
      icon: (
        <svg className="w-5 h-5" style={{ color: '#3B82F6' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      title: 'Examiner la ',
      titleBold: 'santé financière',
    },
    {
      id: 'mail-client',
      icon: (
        <svg className="w-5 h-5" style={{ color: '#3B82F6' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      ),
      title: 'Répondre ',
      titleBold: 'à un mail client',
    },
    {
      id: 'aide',
      icon: (
        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#8B5CF6' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B5CF6' }}></div>
        </div>
      ),
      title: 'Que peut faire ',
      titleBold: 'ComptAssistant ?',
    },
  ]

  const handleAgentClick = (agentId: string) => {
    let question = ''
    if (agentId === 'sante-financiere') {
      question = 'Peux-tu examiner la santé financière de mon entreprise ?'
    } else if (agentId === 'mail-client') {
      question = 'Aide-moi à répondre à un mail client concernant une facture.'
    } else if (agentId === 'aide') {
      question = 'Que peux-tu faire pour m\'aider ?'
    }
    setInputValue(question)
  }

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      let response = ''
      const lowerMessage = userMessage.toLowerCase()

      if (lowerMessage.includes('santé financière') || lowerMessage.includes('examiner')) {
        response = `📊 **Analyse de la santé financière**

Basé sur vos données comptables, voici les indicateurs clés :

• **Trésorerie** : Position solide avec un ratio de liquidité de 1.8
• **Rentabilité** : Marge nette de 12%, en amélioration de 2 points
• **Endettement** : Ratio d'endettement maîtrisé à 35%
• **BFR** : Besoin en fonds de roulement stable

**Recommandations** : Surveillez les délais de paiement clients qui s'allongent légèrement. Envisagez d'optimiser votre gestion des stocks.`
      } else if (lowerMessage.includes('mail') || lowerMessage.includes('client') || lowerMessage.includes('répondre')) {
        response = `📧 **Réponse suggérée pour votre client**

Objet : Re: Demande d'information facture

Bonjour,

Je vous remercie pour votre message concernant votre facture.

Après vérification, je confirme que votre paiement a bien été enregistré dans nos systèmes. Le solde de votre compte est désormais à jour.

N'hésitez pas à me recontacter si vous avez d'autres questions.

Cordialement,
[Votre nom]

---
*Voulez-vous que je personnalise cette réponse ?*`
      } else if (lowerMessage.includes('que peux-tu') || lowerMessage.includes('aide') || lowerMessage.includes('comptassistant')) {
        response = `✨ **Voici ce que je peux faire pour vous :**

**Comptabilité**
• Analyser vos états financiers (bilan, compte de résultat)
• Expliquer des concepts comptables
• Vérifier la cohérence des écritures
• Suggérer des imputations comptables

**Gestion quotidienne**
• Rédiger des réponses aux clients/fournisseurs
• Résumer des documents
• Calculer des ratios financiers
• Préparer des déclarations

**Pennybarr**
• Vous guider dans l'utilisation de l'application
• Expliquer les fonctionnalités
• Résoudre des problèmes techniques

Comment puis-je vous aider ?`
      } else if (lowerMessage.includes('tva')) {
        response = `💶 **Information TVA**

La TVA (Taxe sur la Valeur Ajoutée) est un impôt indirect sur la consommation. Voici les points essentiels :

**Taux en France (2025)**
• Taux normal : 20%
• Taux intermédiaire : 10%
• Taux réduit : 5,5%
• Taux particulier : 2,1%

**Vos obligations**
• Déclaration mensuelle ou trimestrielle selon votre CA
• Conservation des justificatifs 6 ans minimum

Avez-vous une question spécifique sur la TVA ?`
      } else if (lowerMessage.includes('comptabilité') || lowerMessage.includes('comptable')) {
        response = `📚 **La comptabilité en France**

La comptabilité française repose sur plusieurs principes fondamentaux :

**Principes comptables**
• Principe de prudence
• Principe de continuité d'exploitation
• Principe d'indépendance des exercices
• Principe de permanence des méthodes

**Documents obligatoires**
• Le livre-journal (enregistrement chronologique)
• Le grand livre (comptes individuels)
• La balance générale
• Les états de synthèse (bilan, compte de résultat)

**Plan Comptable Général (PCG)**
• Classe 1 : Capitaux
• Classe 2 : Immobilisations
• Classe 3 : Stocks
• Classe 4 : Tiers
• Classe 5 : Financiers
• Classe 6 : Charges
• Classe 7 : Produits

Quel aspect de la comptabilité souhaitez-vous approfondir ?`
      } else if (lowerMessage.includes('pennybarr') || lowerMessage.includes('utilisation')) {
        response = `🚀 **Utiliser Pennybarr**

Pennybarr est votre solution de comptabilité moderne. Voici comment en tirer le meilleur parti :

**Fonctionnalités principales**
• **Saisie** : Importez et catégorisez vos transactions bancaires
• **Révision** : Grand livre, balance, journaux comptables
• **Fiscalité** : Déclarations TVA automatisées
• **États de synthèse** : Bilan, compte de résultat, SIG

**Conseils d'utilisation**
• Connectez votre banque pour l'import automatique
• Utilisez le lettrage pour rapprocher vos comptes
• Vérifiez régulièrement votre balance générale
• Exportez vos FEC pour l'administration fiscale

**Navigation rapide**
• Ctrl+K : Recherche rapide
• Utilisez le menu latéral pour naviguer

Une question sur une fonctionnalité spécifique ?`
      } else if (lowerMessage.includes('facturation électronique') || lowerMessage.includes('factur')) {
        response = `📄 **La facturation électronique**

La réforme de la facturation électronique en France entre progressivement en vigueur :

**Calendrier d'application**
• Grandes entreprises : juillet 2024 (réception) / 2026 (émission)
• ETI : 2026 (réception et émission)
• PME/TPE : 2027

**Obligations**
• e-invoicing : Facturation électronique entre assujettis TVA
• e-reporting : Transmission des données de transaction

**Formats acceptés**
• Factur-X (PDF avec données XML intégrées)
• UBL (Universal Business Language)
• CII (Cross Industry Invoice)

**Pennybarr vous accompagne**
• Génération de factures au format Factur-X
• Envoi vers les plateformes de dématérialisation
• Archivage conforme aux normes légales

Souhaitez-vous en savoir plus sur un aspect particulier ?`
      } else {
        response = `Je comprends votre question sur "${userMessage}".

Pour vous donner une réponse précise, pourriez-vous me donner plus de contexte ? Par exemple :
• S'agit-il d'une question comptable ?
• Concernant une fonctionnalité de Pennybarr ?
• Une aide à la rédaction ?

Je suis là pour vous aider ! 🙂`
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: response }])
      setIsLoading(false)
    }, 1500)
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-auto">
        {chatMessages.length === 0 ? (
          /* Welcome Screen */
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Greeting */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #06B6D4 100%)' }}>
                <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-white"></div>
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-1" style={{ color: '#141A1F' }}>
                Bonjour {userName},
              </h2>
              <p className="text-base" style={{ color: '#6C767F' }}>
                sur quel sujet puis-je vous aider aujourd'hui ?
              </p>
            </div>

            {/* Agents Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ color: '#141A1F' }}>Utiliser un agent</h3>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-50" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    Explorer
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#006666' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Créer
                  </button>
                </div>
              </div>
              <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
                Gagnez en efficacité grâce aux agents personnalisés !
              </p>

              {/* Agent Cards */}
              <div className="grid grid-cols-3 gap-3">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentClick(agent.id)}
                    className="p-4 border rounded-xl text-left hover:border-[#006666] hover:shadow-sm transition-all"
                    style={{ borderColor: '#E4E5E7' }}
                  >
                    <div className="mb-3">{agent.icon}</div>
                    <p className="text-sm" style={{ color: '#141A1F' }}>
                      {agent.title}<span className="font-semibold">{agent.titleBold}</span>
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Topics Section */}
            <div>
              <h3 className="font-semibold mb-4" style={{ color: '#141A1F' }}>Ou découvrir un sujet</h3>
              <div className="flex gap-3">
                {topics.map((topic) => (
                  <div key={topic.id} className="relative">
                    <button
                      onMouseEnter={() => setHoveredTopic(topic.id)}
                      onMouseLeave={() => setHoveredTopic(null)}
                      onClick={() => setInputValue(`Parle-moi de ${topic.label.toLowerCase()}`)}
                      className="flex items-center gap-2 px-4 py-2.5 border rounded-lg hover:border-[#006666] hover:bg-[#006666]/5 transition-all"
                      style={{ borderColor: '#E4E5E7' }}
                    >
                      <span style={{ color: '#006666' }}>{topic.icon}</span>
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{topic.label}</span>
                    </button>

                    {/* Tooltip */}
                    {hoveredTopic === topic.id && (
                      <div
                        className="absolute left-0 bottom-full mb-2 w-72 p-3 rounded-lg shadow-lg border z-10"
                        style={{ backgroundColor: '#141A1F', borderColor: '#2D363F' }}
                      >
                        <p className="text-sm text-white">{topic.description}</p>
                        <div
                          className="absolute left-6 bottom-0 transform translate-y-1/2 rotate-45 w-2 h-2"
                          style={{ backgroundColor: '#141A1F' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                    message.role === 'user' ? '' : 'border'
                  }`}
                  style={{
                    backgroundColor: message.role === 'user' ? '#006666' : '#F8F9FA',
                    borderColor: message.role === 'assistant' ? '#E4E5E7' : undefined,
                    color: message.role === 'user' ? 'white' : '#141A1F',
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl border" style={{ backgroundColor: '#F8F9FA', borderColor: '#E4E5E7' }}>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="max-w-3xl mx-auto">
          <div className="border rounded-xl p-3" style={{ borderColor: '#D6D9DB' }}>
            {/* Text Input */}
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Posez moi une question sur la comptabilité"
              className="w-full resize-none text-sm outline-none min-h-[60px]"
              style={{ color: '#141A1F' }}
              rows={2}
            />

            {/* Bottom Controls */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-3">
                {/* Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    onClick={() => setUseCompanyData(!useCompanyData)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${useCompanyData ? 'bg-[#006666]' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useCompanyData ? 'left-[18px]' : 'left-0.5'}`}
                    />
                  </button>
                  <span className="text-sm" style={{ color: '#6C767F' }}>Utiliser les données du dossier</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                {/* Shortcuts */}
                <div className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                  <kbd className="px-1.5 py-0.5 rounded border bg-gray-50" style={{ borderColor: '#E4E5E7' }}>⇧</kbd>
                  <kbd className="px-1.5 py-0.5 rounded border bg-gray-50" style={{ borderColor: '#E4E5E7' }}>↵</kbd>
                  <span className="ml-1">À la ligne</span>
                </div>
                <div className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                  <kbd className="px-1.5 py-0.5 rounded border bg-gray-50" style={{ borderColor: '#E4E5E7' }}>↵</kbd>
                  <span className="ml-1">Envoyer</span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 ml-2">
                  <button className="p-1.5 rounded hover:bg-gray-100" style={{ color: '#6C767F' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="p-1.5 rounded disabled:opacity-30"
                    style={{ color: '#006666' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-center mt-2" style={{ color: '#9CA3AF' }}>
            ComptAssistant peut faire des erreurs, vérifiez les informations.
          </p>
        </div>
      </div>
    </div>
  )
}
