import { useState } from 'react'

interface FacturationElectroniquPageProps {
  onNavigate?: (page: string) => void
}

export default function FacturationElectroniquePage({ onNavigate: _onNavigate }: FacturationElectroniquPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleDownloadGuide = () => {
    const link = document.createElement('a')
    link.href = '/Guide-Facture-Electronique-Pennybarr.pdf'
    link.download = 'Guide-Facture-Electronique-Pennybarr.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const faqs = [
    {
      question: 'Qui est concerné ?',
      answer: "Toutes les entreprises françaises assujetties à TVA sont concernées. Ce qui signifie que les auto-entreprises en franchise en base, bien que non redevables, restent assujetties.\n\nVotre entreprise est-elle concernée ?\nQuelles seront vos obligations d'émission, réception et transmission de données ?"
    },
    {
      question: "Qu'est-ce qu'une PA ?",
      answer: "Une PA est un intermédiaire certifié par l'État qui assure la transmission sécurisée de factures électroniques entre un fournisseur et son client. Une PA veille aussi à la conformité des factures, s'assure qu'elles arrivent à bon port chez vos clients et garantit la bonne circulation des informations entre tous les acteurs.\n\nVous souhaitez en savoir plus sur la facture Électronique ?\nSuivez notre cours dédié pour tout comprendre à la réforme et ses impacts sur votre activité !"
    },
    {
      question: "Qu'est-ce que l'annuaire du gouvernement ?",
      answer: "Pour mener à bien la réforme, et permettre un routage électronique des factures, l'administration met en place un annuaire gouvernemental, autrement appelé Annuaire PPF permettant de :\n\n• Lister toutes les entreprises assujetties à la TVA connue de l'administration\n• Identifier les PA en réception mandatées par les entreprises, en charge de recevoir les factures électroniques fournisseurs"
    },
    {
      question: 'Qui peut désigner une PA ?',
      answer: "Désigner une plateforme comme PA réception, émission ou les deux, relève d'une démarche administrative et fiscale : c'est très important ! C'est la raison pour laquelle la PA doit être désignée, via le formulaire dédié, par un représentant légal de l'entreprise, ou toute personne ayant le pouvoir de l'engager. L'administration précise en effet que le représentant légal peut, par un mandat régulier, désigner une personne qui a qualité pour agir en son nom et signer le formulaire."
    },
    {
      question: 'Comment changer de PA ?',
      answer: "Vous restez libre de changer de PA à tout moment. Il vous faudra donner un mandat explicite à votre nouvelle PA, qui se chargera de la mise à jour dans l'annuaire. Cependant, cela impliquera de revoir vos processus de facturation, potentiellement gérer plusieurs interfaces et engendrer des coûts additionnels."
    },
  ]

  const timeline = [
    {
      date: 'Printemps 2025',
      description: "Possibilité de désigner Pennybarr en qualité de PA à partir de votre espace client en conformité avec les exigences de l'administration",
      done: true,
    },
    {
      date: 'Été 2025',
      description: "Ouverture de l'annuaire du gouvernement, et début de la phase pilote avec la DGFiP, phase pendant laquelle vous pourrez vous familiariser avec Pennybarr comme PA",
      done: false,
    },
    {
      date: 'Septembre 2026',
      description: "Obligation d'émission et réception des factures électroniques pour toutes les grandes entreprises et les ETI et obligation de réception pour toutes les TPE/PME et indépendants",
      done: false,
    },
    {
      date: 'Septembre 2027',
      description: "Obligation d'émission des factures électroniques pour toutes les TPE/PME et indépendants",
      done: false,
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* Hero Section */}
      <section className="py-16 px-8" style={{ backgroundColor: '#E6F2F2' }}>
        <div className="max-w-4xl mx-auto text-center">
          {/* Illustration */}
          <div className="mb-8 flex justify-center">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              {/* Document base */}
              <rect x="25" y="30" width="70" height="80" rx="4" fill="white" stroke="#141A1F" strokeWidth="2" />
              {/* Lines */}
              <line x1="35" y1="50" x2="85" y2="50" stroke="#E4E5E7" strokeWidth="2" />
              <line x1="35" y1="62" x2="75" y2="62" stroke="#E4E5E7" strokeWidth="2" />
              <line x1="35" y1="74" x2="70" y2="74" stroke="#E4E5E7" strokeWidth="2" />
              {/* Checkmark circle */}
              <circle cx="75" cy="85" r="15" fill="#006666" />
              <path d="M68 85 L73 90 L82 81" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {/* Sparkles */}
              <path d="M95 25 L97 30 L102 32 L97 34 L95 39 L93 34 L88 32 L93 30 Z" fill="#141A1F" />
              <path d="M20 45 L21 48 L24 49 L21 50 L20 53 L19 50 L16 49 L19 48 Z" fill="#141A1F" />
            </svg>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ backgroundColor: '#141A1F' }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-white text-sm font-medium">Déjà activé</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold mb-4" style={{ color: '#141A1F' }}>
            Simplifiez votre <span style={{ color: '#006666' }}>transition</span> vers la{' '}
            <span style={{ color: '#006666' }}>facturation électronique</span>
            <br />avec <span style={{ color: '#006666' }}>Pennybarr</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base mb-8 max-w-2xl mx-auto" style={{ color: '#141A1F' }}>
            La facturation électronique devient obligatoire en septembre 2026 pour toutes les entreprises assujetties à la TVA, mais{' '}
            <strong>vous pouvez dès à présent choisir votre PA (plateforme agréée, ex-PDP) et vous inscrire dans l'annuaire du gouvernement.</strong>
          </p>

          {/* Features */}
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="text-sm" style={{ color: '#141A1F' }}>Inclus dans votre abonnement</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <span className="text-sm" style={{ color: '#141A1F' }}>Certification ISO 27001</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: '#006666' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-sm" style={{ color: '#141A1F' }}>4,6 sur Trustpilot</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why choose section */}
      <section className="py-16 px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12" style={{ color: '#141A1F' }}>
            Pourquoi choisir la PA Pennybarr ?
          </h2>

          <div className="grid grid-cols-3 gap-8">
            {/* Card 1 */}
            <div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#E6F2F2' }}>
                <svg className="w-6 h-6" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Déjà prête et opérationnelle</h3>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Soyez prêts dès aujourd'hui. Vous n'aurez plus à vous en préoccuper.
              </p>
            </div>

            {/* Card 2 */}
            <div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#E6F2F2' }}>
                <svg className="w-6 h-6" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Seule solution tout-en-un du marché</h3>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                qui rassemble votre comptabilité, votre gestion financière, votre compte pro et votre PA
              </p>
            </div>

            {/* Card 3 */}
            <div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#E6F2F2' }}>
                <svg className="w-6 h-6" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Centralisation des factures</h3>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Toutes vos factures fournisseurs apparaîtront dans votre boîte de réception
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Reform section */}
      <section className="py-16 px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#141A1F' }}>
            Comprendre la réforme et se préparer
          </h2>

          <p className="text-center mb-4 max-w-3xl mx-auto" style={{ color: '#141A1F' }}>
            La réforme qui introduit l'obligation de facturation électronique est un projet de l'administration fiscale française visant à moderniser les échanges de factures entre les entreprises assujetties à la TVA, grâce à des flux dématérialisés de bout en bout.
          </p>

          <p className="text-center mb-12 max-w-3xl mx-auto" style={{ color: '#141A1F' }}>
            Avec l'obligation d'émettre et de recevoir des factures électroniques, tous les flux de facture passeront par des plateformes numériques.
          </p>

          <div className="flex gap-12 items-start">
            {/* Illustration */}
            <div className="flex-shrink-0">
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                {/* Platform base */}
                <ellipse cx="100" cy="160" rx="80" ry="20" fill="#141A1F" />
                <ellipse cx="100" cy="155" rx="70" ry="15" fill="#2D363F" />
                {/* Document */}
                <rect x="55" y="60" width="90" height="100" rx="4" fill="white" stroke="#141A1F" strokeWidth="2" />
                <line x1="70" y1="85" x2="130" y2="85" stroke="#E4E5E7" strokeWidth="2" />
                <line x1="70" y1="100" x2="120" y2="100" stroke="#E4E5E7" strokeWidth="2" />
                <line x1="70" y1="115" x2="110" y2="115" stroke="#E4E5E7" strokeWidth="2" />
                {/* Checkmark */}
                <circle cx="115" cy="135" r="18" fill="#006666" />
                <path d="M105 135 L112 142 L125 129" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {/* Sparkles */}
                <path d="M160 50 L162 56 L168 58 L162 60 L160 66 L158 60 L152 58 L158 56 Z" fill="#141A1F" />
                <path d="M45 80 L46.5 84 L50.5 85.5 L46.5 87 L45 91 L43.5 87 L39.5 85.5 L43.5 84 Z" fill="#141A1F" />
              </svg>
            </div>

            {/* Timeline */}
            <div className="flex-1">
              <h3 className="font-semibold mb-6" style={{ color: '#141A1F' }}>Les étapes clefs</h3>
              <div className="space-y-6">
                {timeline.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full ${item.done ? 'bg-[#006666]' : 'bg-gray-300'}`}
                      />
                      {index < timeline.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-semibold text-sm" style={{ color: '#141A1F' }}>{item.date}</p>
                      <p className="text-sm" style={{ color: '#6C767F' }}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Download button */}
          <div className="text-center mt-8">
            <button
              onClick={handleDownloadGuide}
              className="inline-flex items-center gap-2 px-5 py-2.5 border rounded-lg font-medium transition-colors hover:bg-gray-50"
              style={{ borderColor: '#006666', color: '#006666' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Télécharger notre guide complet
            </button>
          </div>
        </div>
      </section>

      {/* Guide download section */}
      <section className="py-12 px-8" style={{ backgroundColor: '#E6F2F2' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-8 rounded-2xl overflow-hidden" style={{ backgroundColor: '#E6F2F2' }}>
            {/* Book mockup */}
            <div className="w-80 h-56 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#141A1F' }}>
              <div className="flex -space-x-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-28 h-40 bg-white rounded shadow-lg flex flex-col items-center justify-center p-2"
                    style={{ transform: `rotate(${(i - 1) * 10}deg)` }}
                  >
                    <div className="text-xs text-center mb-1" style={{ color: '#006666' }}>pennybarr</div>
                    <div className="text-[8px] text-center mb-2" style={{ color: '#6C767F' }}>— FACTURE ÉLECTRONIQUE —</div>
                    <div className="text-sm font-bold text-center" style={{ color: '#141A1F' }}>LE GUIDE</div>
                    <div className="text-[7px] text-center mt-1" style={{ color: '#6C767F' }}>POUR TOUT COMPRENDRE ET PRÉPARER VOTRE TRANSITION !</div>
                    <div className="mt-2 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E6F2F2' }}>
                      <svg className="w-6 h-6" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Text */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#141A1F' }}>
                Découvrez comment la <span style={{ color: '#006666' }}>facture électronique</span> va impacter votre entreprise et comment se préparer
              </h2>
              <button
                onClick={handleDownloadGuide}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: '#006666' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Télécharger le guide
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12" style={{ color: '#141A1F' }}>
            Questions Fréquentes
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border rounded-xl overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold" style={{ color: '#141A1F' }}>{faq.question}</span>
                  <svg
                    className={`w-5 h-5 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                    style={{ color: '#6C767F' }}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-sm whitespace-pre-line" style={{ color: '#6C767F' }}>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PDP Guide link */}
      <section className="py-8 px-8 bg-white border-t" style={{ borderColor: '#E4E5E7' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm" style={{ color: '#6C767F' }}>
            <span className="font-semibold" style={{ color: '#006666' }}>PDP guide</span> — Pour plus d'informations sur la réforme de la facturation électronique, téléchargez notre guide complet.
          </p>
        </div>
      </section>
    </div>
  )
}
