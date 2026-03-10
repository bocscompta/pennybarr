import { useState, useEffect, useCallback } from 'react'
import type {
  InvoiceTemplate,
  CreateInvoiceTemplateData,
  UpdateInvoiceTemplateData,
  EmailTemplate,
  CreateEmailTemplateData,
  UpdateEmailTemplateData,
  DocumentType,
  EmailTemplateType
} from '../types/invoiceSettings'
import {
  getInvoiceTemplates,
  createInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate
} from '../services/invoiceSettingsService'

// ==============================================================================
// HOOK: useInvoiceTemplates (Templates de documents)
// ==============================================================================

interface UseInvoiceTemplatesReturn {
  templates: InvoiceTemplate[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTemplate: (data: CreateInvoiceTemplateData) => Promise<InvoiceTemplate>
  updateTemplate: (id: string, updates: UpdateInvoiceTemplateData) => Promise<InvoiceTemplate>
  deleteTemplate: (id: string) => Promise<void>
}

export function useInvoiceTemplates(
  companyId: string | null,
  documentType?: DocumentType
): UseInvoiceTemplatesReturn {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    if (!companyId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getInvoiceTemplates(companyId, documentType)
      setTemplates(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoice templates'
      console.error('[useInvoiceTemplates] Error fetching templates:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [companyId, documentType])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const createTemplateHandler = useCallback(
    async (data: CreateInvoiceTemplateData) => {
      try {
        const newTemplate = await createInvoiceTemplate(data)
        setTemplates(prev => [newTemplate, ...prev])
        return newTemplate
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create invoice template'
        console.error('[useInvoiceTemplates] Error creating template:', err)
        throw new Error(message)
      }
    },
    []
  )

  const updateTemplateHandler = useCallback(
    async (id: string, updates: UpdateInvoiceTemplateData) => {
      try {
        const updatedTemplate = await updateInvoiceTemplate(id, updates)
        setTemplates(prev => prev.map(t => (t.id === id ? updatedTemplate : t)))
        return updatedTemplate
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update invoice template'
        console.error('[useInvoiceTemplates] Error updating template:', err)
        throw new Error(message)
      }
    },
    []
  )

  const deleteTemplateHandler = useCallback(async (id: string) => {
    try {
      await deleteInvoiceTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete invoice template'
      console.error('[useInvoiceTemplates] Error deleting template:', err)
      throw new Error(message)
    }
  }, [])

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    createTemplate: createTemplateHandler,
    updateTemplate: updateTemplateHandler,
    deleteTemplate: deleteTemplateHandler
  }
}

// ==============================================================================
// HOOK: useEmailTemplates (Templates d'emails)
// ==============================================================================

interface UseEmailTemplatesReturn {
  templates: EmailTemplate[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTemplate: (data: CreateEmailTemplateData) => Promise<EmailTemplate>
  updateTemplate: (id: string, updates: UpdateEmailTemplateData) => Promise<EmailTemplate>
  deleteTemplate: (id: string) => Promise<void>
}

export function useEmailTemplates(
  companyId: string | null,
  templateType?: EmailTemplateType
): UseEmailTemplatesReturn {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    if (!companyId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getEmailTemplates(companyId, templateType)
      setTemplates(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch email templates'
      console.error('[useEmailTemplates] Error fetching templates:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [companyId, templateType])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const createTemplateHandler = useCallback(
    async (data: CreateEmailTemplateData) => {
      try {
        const newTemplate = await createEmailTemplate(data)
        setTemplates(prev => [newTemplate, ...prev])
        return newTemplate
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create email template'
        console.error('[useEmailTemplates] Error creating template:', err)
        throw new Error(message)
      }
    },
    []
  )

  const updateTemplateHandler = useCallback(
    async (id: string, updates: UpdateEmailTemplateData) => {
      try {
        const updatedTemplate = await updateEmailTemplate(id, updates)
        setTemplates(prev => prev.map(t => (t.id === id ? updatedTemplate : t)))
        return updatedTemplate
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update email template'
        console.error('[useEmailTemplates] Error updating template:', err)
        throw new Error(message)
      }
    },
    []
  )

  const deleteTemplateHandler = useCallback(async (id: string) => {
    try {
      await deleteEmailTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete email template'
      console.error('[useEmailTemplates] Error deleting template:', err)
      throw new Error(message)
    }
  }, [])

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    createTemplate: createTemplateHandler,
    updateTemplate: updateTemplateHandler,
    deleteTemplate: deleteTemplateHandler
  }
}
