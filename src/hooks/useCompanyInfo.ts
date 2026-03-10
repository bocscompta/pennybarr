import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface CompanyInfo {
  id: string
  name: string
  siren: string | null
  siret: string | null
  vat_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
}

interface UseCompanyInfoReturn {
  companyInfo: CompanyInfo | null
  loading: boolean
  error: string | null
}

export function useCompanyInfo(companyId: string): UseCompanyInfoReturn {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCompanyInfo() {
      try {
        setLoading(true)
        setError(null)

        // Récupérer les infos de la company
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single()

        if (companyError) {
          console.error('[useCompanyInfo] Error fetching company:', companyError)
          throw new Error(`Erreur chargement entreprise: ${companyError.message}`)
        }

        if (!company) {
          throw new Error('Entreprise non trouvée')
        }

        // Récupérer email et phone depuis invoice_settings
        const { data: settings, error: settingsError } = await supabase
          .from('invoice_settings')
          .select('company_email, company_phone')
          .eq('company_id', companyId)
          .single()

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('[useCompanyInfo] Error fetching settings:', settingsError)
        }

        setCompanyInfo({
          id: company.id,
          name: company.name,
          siren: company.siren,
          siret: company.siret,
          vat_number: company.vat_number,
          address: company.address,
          postal_code: company.postal_code,
          city: company.city,
          country: company.country,
          email: settings?.company_email || null,
          phone: settings?.company_phone || null
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur chargement entreprise'
        console.error('[useCompanyInfo] Error:', err)
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanyInfo()
  }, [companyId])

  return {
    companyInfo,
    loading,
    error
  }
}
