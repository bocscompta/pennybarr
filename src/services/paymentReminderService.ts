import { supabase } from '../lib/supabase'
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

// ==============================================================================
// PAYMENT REMINDER SEQUENCES (Séquences de relances)
// ==============================================================================

export async function getPaymentReminderSequences(
  companyId: string
): Promise<PaymentReminderSequence[]> {
  const { data, error } = await supabase
    .from('payment_reminder_sequences')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[paymentReminderService] Failed to fetch reminder sequences:', error)
    throw new Error(`Failed to fetch reminder sequences: ${error.message}`)
  }

  return data || []
}

export async function getPaymentReminderSequenceById(
  sequenceId: string
): Promise<PaymentReminderSequence> {
  const { data, error } = await supabase
    .from('payment_reminder_sequences')
    .select('*')
    .eq('id', sequenceId)
    .single()

  if (error) {
    console.error('[paymentReminderService] Failed to fetch reminder sequence:', error)
    throw new Error(`Failed to fetch reminder sequence: ${error.message}`)
  }

  if (!data) {
    throw new Error('Reminder sequence not found')
  }

  return data
}

export async function getPaymentReminderSequenceWithSteps(
  sequenceId: string
): Promise<PaymentReminderSequenceWithSteps> {
  // Récupérer la séquence
  const sequence = await getPaymentReminderSequenceById(sequenceId)

  // Récupérer les étapes
  const steps = await getPaymentReminderSteps(sequenceId)

  return {
    ...sequence,
    steps
  }
}

export async function createPaymentReminderSequence(
  sequenceData: CreatePaymentReminderSequenceData
): Promise<PaymentReminderSequence> {
  const { data, error } = await supabase
    .from('payment_reminder_sequences')
    .insert(sequenceData)
    .select()
    .single()

  if (error) {
    console.error('[paymentReminderService] Failed to create reminder sequence:', error)
    throw new Error(`Failed to create reminder sequence: ${error.message}`)
  }

  return data
}

export async function updatePaymentReminderSequence(
  sequenceId: string,
  updates: UpdatePaymentReminderSequenceData
): Promise<PaymentReminderSequence> {
  const { data, error } = await supabase
    .from('payment_reminder_sequences')
    .update(updates)
    .eq('id', sequenceId)
    .select()
    .single()

  if (error) {
    console.error('[paymentReminderService] Failed to update reminder sequence:', error)
    throw new Error(`Failed to update reminder sequence: ${error.message}`)
  }

  return data
}

export async function deletePaymentReminderSequence(sequenceId: string): Promise<void> {
  const { error } = await supabase
    .from('payment_reminder_sequences')
    .delete()
    .eq('id', sequenceId)

  if (error) {
    console.error('[paymentReminderService] Failed to delete reminder sequence:', error)
    throw new Error(`Failed to delete reminder sequence: ${error.message}`)
  }
}

export async function toggleSequenceActive(
  sequenceId: string,
  isActive: boolean
): Promise<PaymentReminderSequence> {
  return updatePaymentReminderSequence(sequenceId, { is_active: isActive })
}

// ==============================================================================
// PAYMENT REMINDER STEPS (Étapes de relances)
// ==============================================================================

export async function getPaymentReminderSteps(sequenceId: string): Promise<PaymentReminderStep[]> {
  const { data, error } = await supabase
    .from('payment_reminder_steps')
    .select('*')
    .eq('sequence_id', sequenceId)
    .order('step_order', { ascending: true })

  if (error) {
    console.error('[paymentReminderService] Failed to fetch reminder steps:', error)
    throw new Error(`Failed to fetch reminder steps: ${error.message}`)
  }

  return data || []
}

export async function getPaymentReminderStepsWithTemplates(
  sequenceId: string
): Promise<PaymentReminderStepWithTemplate[]> {
  const { data, error } = await supabase
    .from('payment_reminder_steps')
    .select('*, email_template:email_templates(*)')
    .eq('sequence_id', sequenceId)
    .order('step_order', { ascending: true })

  if (error) {
    console.error('[paymentReminderService] Failed to fetch reminder steps with templates:', error)
    throw new Error(`Failed to fetch reminder steps with templates: ${error.message}`)
  }

  return data || []
}

export async function getPaymentReminderStepById(stepId: string): Promise<PaymentReminderStep> {
  const { data, error } = await supabase
    .from('payment_reminder_steps')
    .select('*')
    .eq('id', stepId)
    .single()

  if (error) {
    console.error('[paymentReminderService] Failed to fetch reminder step:', error)
    throw new Error(`Failed to fetch reminder step: ${error.message}`)
  }

  if (!data) {
    throw new Error('Reminder step not found')
  }

  return data
}

export async function createPaymentReminderStep(
  stepData: CreatePaymentReminderStepData
): Promise<PaymentReminderStep> {
  const { data, error } = await supabase
    .from('payment_reminder_steps')
    .insert(stepData)
    .select()
    .single()

  if (error) {
    console.error('[paymentReminderService] Failed to create reminder step:', error)
    throw new Error(`Failed to create reminder step: ${error.message}`)
  }

  return data
}

export async function updatePaymentReminderStep(
  stepId: string,
  updates: UpdatePaymentReminderStepData
): Promise<PaymentReminderStep> {
  const { data, error } = await supabase
    .from('payment_reminder_steps')
    .update(updates)
    .eq('id', stepId)
    .select()
    .single()

  if (error) {
    console.error('[paymentReminderService] Failed to update reminder step:', error)
    throw new Error(`Failed to update reminder step: ${error.message}`)
  }

  return data
}

export async function deletePaymentReminderStep(stepId: string): Promise<void> {
  const { error } = await supabase
    .from('payment_reminder_steps')
    .delete()
    .eq('id', stepId)

  if (error) {
    console.error('[paymentReminderService] Failed to delete reminder step:', error)
    throw new Error(`Failed to delete reminder step: ${error.message}`)
  }
}

export async function createMultiplePaymentReminderSteps(
  stepsData: CreatePaymentReminderStepData[]
): Promise<PaymentReminderStep[]> {
  const { data, error } = await supabase
    .from('payment_reminder_steps')
    .insert(stepsData)
    .select()

  if (error) {
    console.error('[paymentReminderService] Failed to create multiple reminder steps:', error)
    throw new Error(`Failed to create multiple reminder steps: ${error.message}`)
  }

  return data || []
}

// ==============================================================================
// BATCH OPERATIONS
// ==============================================================================

export async function replaceSequenceSteps(
  sequenceId: string,
  newSteps: CreatePaymentReminderStepData[]
): Promise<PaymentReminderStep[]> {
  // Supprimer toutes les étapes existantes
  const { error: deleteError } = await supabase
    .from('payment_reminder_steps')
    .delete()
    .eq('sequence_id', sequenceId)

  if (deleteError) {
    console.error('[paymentReminderService] Failed to delete existing steps:', deleteError)
    throw new Error(`Failed to delete existing steps: ${deleteError.message}`)
  }

  // Créer les nouvelles étapes
  if (newSteps.length === 0) {
    return []
  }

  return createMultiplePaymentReminderSteps(newSteps)
}

// ==============================================================================
// STATISTICS (pour affichage dans le tableau)
// ==============================================================================

export interface ReminderSequenceStats {
  sequence_id: string
  steps_count: number
  affected_clients_count: number // À implémenter selon votre modèle de données
  affected_invoices_count: number // À implémenter selon votre modèle de données
}

export async function getSequenceStats(sequenceId: string): Promise<ReminderSequenceStats> {
  // Compter les étapes
  const steps = await getPaymentReminderSteps(sequenceId)
  const stepsCount = steps.length

  // TODO: Implémenter le calcul des clients et factures impactés
  // Cela dépendra de votre modèle de données pour les clients et factures

  return {
    sequence_id: sequenceId,
    steps_count: stepsCount,
    affected_clients_count: 0, // À implémenter
    affected_invoices_count: 0 // À implémenter
  }
}
