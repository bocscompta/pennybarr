import { useState, useEffect, useCallback } from 'react'
import type {
  InvoiceSettings,
  UpdateInvoiceSettingsData,
  InvoicePaymentConfig,
  UpdateInvoicePaymentConfigData
} from '../types/invoiceSettings'
import {
  getInvoiceSettings,
  updateInvoiceSettings,
  getInvoicePaymentConfig,
  updateInvoicePaymentConfig,
  initializeInvoiceSettings
} from '../services/invoiceSettingsService'

interface UseInvoiceSettingsReturn {
  settings: InvoiceSettings | null
  paymentConfig: InvoicePaymentConfig | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateSettings: (updates: UpdateInvoiceSettingsData) => Promise<void>
  updatePaymentConfig: (updates: UpdateInvoicePaymentConfigData) => Promise<void>
  initialize: () => Promise<void>
}

export function useInvoiceSettings(companyId: string | null): UseInvoiceSettingsReturn {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<InvoicePaymentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [settingsData, paymentConfigData] = await Promise.all([
        getInvoiceSettings(companyId),
        getInvoicePaymentConfig(companyId)
      ])

      setSettings(settingsData)
      setPaymentConfig(paymentConfigData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoice settings'
      console.error('[useInvoiceSettings] Error fetching data:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateSettingsHandler = useCallback(
    async (updates: UpdateInvoiceSettingsData) => {
      if (!companyId) {
        throw new Error('Company ID is required')
      }

      try {
        const updatedSettings = await updateInvoiceSettings(companyId, updates)
        setSettings(updatedSettings)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update invoice settings'
        console.error('[useInvoiceSettings] Error updating settings:', err)
        throw new Error(message)
      }
    },
    [companyId]
  )

  const updatePaymentConfigHandler = useCallback(
    async (updates: UpdateInvoicePaymentConfigData) => {
      if (!companyId) {
        throw new Error('Company ID is required')
      }

      try {
        const updatedConfig = await updateInvoicePaymentConfig(companyId, updates)
        setPaymentConfig(updatedConfig)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update payment config'
        console.error('[useInvoiceSettings] Error updating payment config:', err)
        throw new Error(message)
      }
    },
    [companyId]
  )

  const initializeHandler = useCallback(async () => {
    if (!companyId) {
      throw new Error('Company ID is required')
    }

    try {
      await initializeInvoiceSettings(companyId)
      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize invoice settings'
      console.error('[useInvoiceSettings] Error initializing settings:', err)
      throw new Error(message)
    }
  }, [companyId, fetchData])

  return {
    settings,
    paymentConfig,
    loading,
    error,
    refetch: fetchData,
    updateSettings: updateSettingsHandler,
    updatePaymentConfig: updatePaymentConfigHandler,
    initialize: initializeHandler
  }
}
