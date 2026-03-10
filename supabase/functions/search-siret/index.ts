import "jsr:@supabase/functions-js/edge-runtime.d.ts"

/**
 * Edge Function: search-siret
 * Recherche une entreprise française via l'API SIRENE INSEE
 * Évite les problèmes CORS en faisant l'appel côté serveur
 */

interface SireneEtablissement {
  siret: string
  siren: string
  uniteLegale: {
    denominationUniteLegale: string
    categorieJuridiqueUniteLegale: string
  }
  adresseEtablissement: {
    numeroVoieEtablissement: string
    typeVoieEtablissement: string
    libelleVoieEtablissement: string
    codePostalEtablissement: string
    libelleCommuneEtablissement: string
  }
  periodesEtablissement: Array<{
    activitePrincipaleEtablissement: string
  }>
}

interface SireneResponse {
  etablissement: SireneEtablissement
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { siret } = await req.json()

    if (!siret) {
      return new Response(
        JSON.stringify({ error: 'SIRET requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Nettoyer le SIRET (enlever espaces)
    const cleanSiret = siret.replace(/\s/g, '')

    // Valider format SIRET (14 chiffres)
    if (!/^\d{14}$/.test(cleanSiret)) {
      return new Response(
        JSON.stringify({ error: 'SIRET invalide (14 chiffres requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Appel à l'API SIRENE publique (sans authentification)
    // Alternative: API recherche-entreprises.api.gouv.fr (plus permissive)
    const apiUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}`

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API SIRENE error: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Entreprise non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = data.results[0]

    // Calculer le numéro de TVA intracommunautaire
    const tvaNumber = calculateTVANumber(result.siren)

    // Formater la réponse
    const formattedResult = {
      siren: result.siren,
      siret: result.siret,
      name: result.nom_complet || result.nom_raison_sociale,
      address: result.siege?.adresse || '',
      postal_code: result.siege?.code_postal || '',
      city: result.siege?.libelle_commune || '',
      vat_number: tvaNumber,
      legal_form: result.nature_juridique,
      activity: result.activite_principale
    }

    return new Response(
      JSON.stringify(formattedResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in search-siret function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur lors de la recherche' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Calculer le numéro de TVA intracommunautaire français
 * Format: FR + clé (2 chiffres) + SIREN (9 chiffres)
 * Clé = (12 + 3 * (SIREN % 97)) % 97
 */
function calculateTVANumber(siren: string): string {
  const sirenNum = parseInt(siren, 10)
  if (isNaN(sirenNum)) return ''

  const key = (12 + 3 * (sirenNum % 97)) % 97
  return `FR${key.toString().padStart(2, '0')}${siren}`
}
