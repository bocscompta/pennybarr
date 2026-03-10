import { createClient } from '@supabase/supabase-js'

// Configuration Supabase via variables d'environnement
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. See .env.example')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Company ID (will use auth later for multi-tenant)
export const COMPANY_ID = import.meta.env.VITE_COMPANY_ID || ''

/**
 * Récupère un secret depuis le vault Supabase
 * Conforme à CLAUDE.md règle 6.2 - "Toutes clés/secrets → secure_vault uniquement"
 * @param secretName - Nom du secret à récupérer
 * @returns Le secret demandé
 * @throws Error si le secret n'existe pas ou en cas d'erreur
 */
export async function getSecretFromVault(secretName: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_vault_secret', { secret_name: secretName })

  if (error) {
    console.error(`[Vault] Erreur récupération secret '${secretName}':`, error.message)
    throw new Error(`Secret '${secretName}' not found in vault: ${error.message}`)
  }

  if (!data) {
    console.error(`[Vault] Secret '${secretName}' introuvable ou vide`)
    throw new Error(`Secret '${secretName}' not found in vault`)
  }

  return data
}
