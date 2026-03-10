import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface UseCurrentCompanyReturn {
  companyId: string | null
  loading: boolean
  error: string | null
}

export function useCurrentCompany(): UseCurrentCompanyReturn {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCompanyId() {
      try {
        setLoading(true)
        setError(null)

        // Get current user
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(`Failed to get user: ${userError.message}`)
        }

        if (!user) {
          throw new Error('User not authenticated')
        }

        // Get user's company access
        const { data, error: accessError } = await supabase
          .from('user_company_access')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)

        if (accessError) {
          console.error('[useCurrentCompany] Failed to fetch company access:', accessError)
          throw new Error(`Failed to fetch company access: ${accessError.message}`)
        }

        // Si aucune relation trouvée, récupérer la première entreprise disponible
        if (!data || data.length === 0) {
          console.warn('[useCurrentCompany] No company access found, fetching first company')
          const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single()

          if (companiesError || !companies) {
            throw new Error('No company found in database')
          }

          setCompanyId(companies.id)
          return
        }

        setCompanyId(data[0].company_id)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch company'
        console.error('[useCurrentCompany] Error:', err)
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanyId()
  }, [])

  return {
    companyId,
    loading,
    error
  }
}
