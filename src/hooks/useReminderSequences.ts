import { useState, useEffect, useCallback } from 'react'
import type {
  PaymentReminderSequence,
  CreatePaymentReminderSequenceData,
  UpdatePaymentReminderSequenceData,
  PaymentReminderStep,
  CreatePaymentReminderStepData,
  UpdatePaymentReminderStepData,
  PaymentReminderSequenceWithSteps,
  PaymentReminderStepWithTemplate
} from '../types/invoiceSettings'
import {
  getPaymentReminderSequences,
  getPaymentReminderSequenceWithSteps,
  createPaymentReminderSequence,
  updatePaymentReminderSequence,
  deletePaymentReminderSequence,
  toggleSequenceActive,
  getPaymentReminderSteps,
  getPaymentReminderStepsWithTemplates,
  createPaymentReminderStep,
  updatePaymentReminderStep,
  deletePaymentReminderStep,
  createMultiplePaymentReminderSteps,
  replaceSequenceSteps,
  getSequenceStats,
  type ReminderSequenceStats
} from '../services/paymentReminderService'

// ==============================================================================
// HOOK: useReminderSequences (Liste des séquences)
// ==============================================================================

interface UseReminderSequencesReturn {
  sequences: PaymentReminderSequence[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createSequence: (data: CreatePaymentReminderSequenceData) => Promise<PaymentReminderSequence>
  updateSequence: (
    id: string,
    updates: UpdatePaymentReminderSequenceData
  ) => Promise<PaymentReminderSequence>
  deleteSequence: (id: string) => Promise<void>
  toggleActive: (id: string, isActive: boolean) => Promise<void>
}

export function useReminderSequences(companyId: string | null): UseReminderSequencesReturn {
  const [sequences, setSequences] = useState<PaymentReminderSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSequences = useCallback(async () => {
    if (!companyId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getPaymentReminderSequences(companyId)
      setSequences(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch reminder sequences'
      console.error('[useReminderSequences] Error fetching sequences:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchSequences()
  }, [fetchSequences])

  const createSequenceHandler = useCallback(
    async (data: CreatePaymentReminderSequenceData) => {
      try {
        const newSequence = await createPaymentReminderSequence(data)
        setSequences(prev => [newSequence, ...prev])
        return newSequence
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create reminder sequence'
        console.error('[useReminderSequences] Error creating sequence:', err)
        throw new Error(message)
      }
    },
    []
  )

  const updateSequenceHandler = useCallback(
    async (id: string, updates: UpdatePaymentReminderSequenceData) => {
      try {
        const updatedSequence = await updatePaymentReminderSequence(id, updates)
        setSequences(prev => prev.map(s => (s.id === id ? updatedSequence : s)))
        return updatedSequence
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update reminder sequence'
        console.error('[useReminderSequences] Error updating sequence:', err)
        throw new Error(message)
      }
    },
    []
  )

  const deleteSequenceHandler = useCallback(async (id: string) => {
    try {
      await deletePaymentReminderSequence(id)
      setSequences(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete reminder sequence'
      console.error('[useReminderSequences] Error deleting sequence:', err)
      throw new Error(message)
    }
  }, [])

  const toggleActiveHandler = useCallback(async (id: string, isActive: boolean) => {
    try {
      const updatedSequence = await toggleSequenceActive(id, isActive)
      setSequences(prev => prev.map(s => (s.id === id ? updatedSequence : s)))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle sequence active state'
      console.error('[useReminderSequences] Error toggling active:', err)
      throw new Error(message)
    }
  }, [])

  return {
    sequences,
    loading,
    error,
    refetch: fetchSequences,
    createSequence: createSequenceHandler,
    updateSequence: updateSequenceHandler,
    deleteSequence: deleteSequenceHandler,
    toggleActive: toggleActiveHandler
  }
}

// ==============================================================================
// HOOK: useReminderSequenceDetails (Séquence avec ses étapes)
// ==============================================================================

interface UseReminderSequenceDetailsReturn {
  sequence: PaymentReminderSequenceWithSteps | null
  steps: PaymentReminderStep[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateSequence: (
    updates: UpdatePaymentReminderSequenceData
  ) => Promise<PaymentReminderSequence>
  createStep: (data: CreatePaymentReminderStepData) => Promise<PaymentReminderStep>
  updateStep: (id: string, updates: UpdatePaymentReminderStepData) => Promise<PaymentReminderStep>
  deleteStep: (id: string) => Promise<void>
  replaceAllSteps: (newSteps: CreatePaymentReminderStepData[]) => Promise<void>
}

export function useReminderSequenceDetails(
  sequenceId: string | null
): UseReminderSequenceDetailsReturn {
  const [sequence, setSequence] = useState<PaymentReminderSequenceWithSteps | null>(null)
  const [steps, setSteps] = useState<PaymentReminderStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSequenceDetails = useCallback(async () => {
    if (!sequenceId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getPaymentReminderSequenceWithSteps(sequenceId)
      setSequence(data)
      setSteps(data.steps)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sequence details'
      console.error('[useReminderSequenceDetails] Error fetching details:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [sequenceId])

  useEffect(() => {
    fetchSequenceDetails()
  }, [fetchSequenceDetails])

  const updateSequenceHandler = useCallback(
    async (updates: UpdatePaymentReminderSequenceData) => {
      if (!sequenceId) {
        throw new Error('Sequence ID is required')
      }

      try {
        const updatedSequence = await updatePaymentReminderSequence(sequenceId, updates)
        setSequence(prev => (prev ? { ...prev, ...updatedSequence } : null))
        return updatedSequence
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update sequence'
        console.error('[useReminderSequenceDetails] Error updating sequence:', err)
        throw new Error(message)
      }
    },
    [sequenceId]
  )

  const createStepHandler = useCallback(
    async (data: CreatePaymentReminderStepData) => {
      try {
        const newStep = await createPaymentReminderStep(data)
        setSteps(prev => [...prev, newStep].sort((a, b) => a.step_order - b.step_order))
        return newStep
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create step'
        console.error('[useReminderSequenceDetails] Error creating step:', err)
        throw new Error(message)
      }
    },
    []
  )

  const updateStepHandler = useCallback(
    async (id: string, updates: UpdatePaymentReminderStepData) => {
      try {
        const updatedStep = await updatePaymentReminderStep(id, updates)
        setSteps(prev => prev.map(s => (s.id === id ? updatedStep : s)))
        return updatedStep
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update step'
        console.error('[useReminderSequenceDetails] Error updating step:', err)
        throw new Error(message)
      }
    },
    []
  )

  const deleteStepHandler = useCallback(async (id: string) => {
    try {
      await deletePaymentReminderStep(id)
      setSteps(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete step'
      console.error('[useReminderSequenceDetails] Error deleting step:', err)
      throw new Error(message)
    }
  }, [])

  const replaceAllStepsHandler = useCallback(
    async (newSteps: CreatePaymentReminderStepData[]) => {
      if (!sequenceId) {
        throw new Error('Sequence ID is required')
      }

      try {
        const replacedSteps = await replaceSequenceSteps(sequenceId, newSteps)
        setSteps(replacedSteps)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to replace steps'
        console.error('[useReminderSequenceDetails] Error replacing steps:', err)
        throw new Error(message)
      }
    },
    [sequenceId]
  )

  return {
    sequence,
    steps,
    loading,
    error,
    refetch: fetchSequenceDetails,
    updateSequence: updateSequenceHandler,
    createStep: createStepHandler,
    updateStep: updateStepHandler,
    deleteStep: deleteStepHandler,
    replaceAllSteps: replaceAllStepsHandler
  }
}

// ==============================================================================
// HOOK: useSequenceStats (Stats pour affichage tableau)
// ==============================================================================

interface UseSequenceStatsReturn {
  stats: ReminderSequenceStats | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useSequenceStats(sequenceId: string | null): UseSequenceStatsReturn {
  const [stats, setStats] = useState<ReminderSequenceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!sequenceId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await getSequenceStats(sequenceId)
      setStats(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sequence stats'
      console.error('[useSequenceStats] Error fetching stats:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [sequenceId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  }
}
