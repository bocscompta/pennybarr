/**
 * Service OCR pour les factures
 * Utilise Mistral OCR pour extraire automatiquement les données des factures
 * Clé API stockée dans Supabase (table api_keys)
 */

import { supabase } from '../lib/supabase'
import { COMPANY_ID } from '../lib/supabase'

export interface InvoiceOCRResult {
  success: boolean
  data?: {
    vendorName: string
    invoiceNumber: string
    invoiceDate: string
    dueDate: string
    totalTTC: number
    totalHT: number
    totalTVA: number
    vatRate: number
    description: string
    rawText: string
  }
  error?: string
}

export interface ExtractedInvoiceData {
  vendorName: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  totalTTC: number
  totalHT: number
  totalTVA: number
  vatRate: number
  currency?: string  // 'EUR', 'USD', etc. détecté depuis la facture
  description: string
}

/**
 * Upload file to Supabase storage and get public URL
 */
async function uploadToStorage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `invoices/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    throw new Error(`Erreur upload: ${uploadError.message}`)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Call Mistral OCR via Edge Function
 */
async function callMistralOCR(documentUrl: string, fileType: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('invoice-ocr', {
    body: {
      documentUrl,
      fileType // 'pdf' or 'image'
    }
  })

  if (error) {
    throw new Error(`Erreur OCR: ${error.message}`)
  }

  return data.extractedText
}

/**
 * Parse OCR text to extract invoice data
 * Handles both French and English formats, and markdown output
 */
function parseInvoiceText(rawText: string): ExtractedInvoiceData {
  // Clean markdown formatting
  const cleanText = rawText
    .replace(/\*\*/g, '')  // Remove bold
    .replace(/#{1,6}\s*/g, '')  // Remove headers
    .replace(/\|/g, ' ')  // Replace table pipes
    .replace(/-{3,}/g, '')  // Remove horizontal rules

  // Month names mapping
  const monthNames: Record<string, string> = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12',
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
  }

  // Helper to parse amounts - handles various formats
  const parseAmount = (str: string | undefined): number => {
    if (!str) return 0
    // Remove currency symbols, spaces, and normalize
    const cleaned = str
      .replace(/[€$£\s]/g, '')
      .replace(/\u00a0/g, '')  // Non-breaking space
      .replace(/,(\d{2})$/, '.$1')  // Convert French decimal: 10,00 -> 10.00
      .replace(/,/g, '')  // Remove thousand separators
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  // Helper to parse dates - handles multiple formats
  const parseDate = (str: string | undefined): string => {
    if (!str) return ''

    // Format: December 11, 2025 or 11 December 2025
    const monthNameMatch = str.match(/(\d{1,2})[\s,]+([a-zéû]+)[\s,]+(\d{4})|([a-zéû]+)[\s,]+(\d{1,2})[\s,]+(\d{4})/i)
    if (monthNameMatch) {
      let day: string, monthName: string, year: string
      if (monthNameMatch[1]) {
        // 11 December 2025
        day = monthNameMatch[1]
        monthName = monthNameMatch[2].toLowerCase()
        year = monthNameMatch[3]
      } else {
        // December 11, 2025
        monthName = monthNameMatch[4].toLowerCase()
        day = monthNameMatch[5]
        year = monthNameMatch[6]
      }
      const month = monthNames[monthName]
      if (month) {
        return `${year}-${month}-${day.padStart(2, '0')}`
      }
    }

    // Format: DD/MM/YYYY or DD-MM-YYYY
    const numericMatch = str.match(/(\d{1,2})[\s\/\-\.](\d{1,2})[\s\/\-\.](\d{2,4})/)
    if (numericMatch) {
      let [, day, month, year] = numericMatch
      if (year.length === 2) {
        year = '20' + year
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    return ''
  }

  // Extract vendor name (usually first non-empty meaningful line)
  const lines = cleanText.split('\n').filter(l => l.trim())
  let vendorName = ''
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim().replace(/^#+\s*/, '')
    if (line.length > 2 &&
        !line.toLowerCase().includes('facture') &&
        !line.toLowerCase().includes('invoice') &&
        !line.toLowerCase().includes('date') &&
        !line.match(/^\d+[\s\/\-\.]\d+/) &&
        !line.match(/^(total|montant|tva|ht|ttc)/i)) {
      vendorName = line
      break
    }
  }

  // Patterns for extraction (FR + EN)
  const patterns = {
    invoiceNumber: /(?:facture|invoice|n[°o]|numero|numéro|number|ref|référence|reference)[\s:#]*([A-Z0-9\-\/]+)/i,
    invoiceDate: /(?:date\s*(?:of\s*)?(?:issue|émission|emission|facture|invoice)?|émise?\s*le|issued?)[\s:,]*([^\n]{5,30})/i,
    dueDate: /(?:échéance|echeance|due\s*date|date\s*limite|payable|payment\s*due)[\s:,]*([^\n]{5,30})/i,
    totalTTC: /(?:total\s*(?:ttc|amount|due|à\s*payer)?|net\s*(?:à\s*payer|payable)|amount\s*due|grand\s*total)[\s:€$]*(\d+[\s,.]?\d*[\s,.]?\d*)/i,
    totalHT: /(?:total\s*(?:ht|hors\s*taxe|excl\.?\s*(?:vat|tax))|subtotal|sous[\s-]?total|net\s*amount)[\s:€$]*(\d+[\s,.]?\d*[\s,.]?\d*)/i,
    totalTVA: /(?:tva|vat|tax|taxe)[\s:€$]*(\d+[\s,.]?\d*[\s,.]?\d*)/i,
    vatRate: /(?:tva|vat|tax)[\s:]*(\d+(?:[,.]\d+)?)\s*%/i,
  }

  // Extract data
  const invoiceNumber = cleanText.match(patterns.invoiceNumber)?.[1]?.trim() || ''
  const invoiceDateRaw = cleanText.match(patterns.invoiceDate)?.[1]?.trim() || ''
  const dueDateRaw = cleanText.match(patterns.dueDate)?.[1]?.trim() || ''

  const invoiceDate = parseDate(invoiceDateRaw)
  const dueDate = parseDate(dueDateRaw)

  const totalTTC = parseAmount(cleanText.match(patterns.totalTTC)?.[1])
  const totalHT = parseAmount(cleanText.match(patterns.totalHT)?.[1])
  let totalTVA = parseAmount(cleanText.match(patterns.totalTVA)?.[1])

  const vatRateMatch = cleanText.match(patterns.vatRate)?.[1]
  const vatRate = vatRateMatch ? parseFloat(vatRateMatch.replace(',', '.')) : 20

  // Calculate TVA if not found
  if (!totalTVA && totalTTC && totalHT) {
    totalTVA = Math.round((totalTTC - totalHT) * 100) / 100
  }

  // Extract description
  const descriptionMatch = cleanText.match(/(?:objet|description|désignation|libellé|subject|for)[\s:]*([^\n]+)/i)
  const description = descriptionMatch?.[1]?.trim() || ''

  console.log('📊 Parsed invoice data:', { vendorName, invoiceNumber, invoiceDate, dueDate, totalTTC, totalHT, totalTVA, vatRate })

  return {
    vendorName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    totalTTC,
    totalHT,
    totalTVA,
    vatRate,
    description
  }
}

/**
 * Process invoice file with OCR
 */
export async function processInvoiceOCR(file: File): Promise<InvoiceOCRResult> {
  try {
    // 1. Upload file to storage
    console.log('📤 Upload du fichier...')
    const publicUrl = await uploadToStorage(file)
    console.log('✅ Fichier uploadé:', publicUrl)

    // 2. Determine file type
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image'

    // 3. Call OCR
    console.log('🔍 Analyse OCR en cours...')
    const rawText = await callMistralOCR(publicUrl, fileType)
    console.log('✅ Texte extrait:', rawText.substring(0, 200) + '...')

    // 4. Parse extracted text
    console.log('📊 Extraction des données...')
    const extractedData = parseInvoiceText(rawText)

    return {
      success: true,
      data: {
        ...extractedData,
        rawText
      }
    }
  } catch (error) {
    console.error('❌ Erreur OCR:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }
  }
}

/**
 * Process invoice file with OCR via Edge Function
 * Appelle l'Edge Function invoice-ocr qui récupère la clé API depuis la DB
 */
export async function processInvoiceOCRDirect(file: File, _apiKey?: string): Promise<InvoiceOCRResult> {
  try {
    // 1. Convert file to base64
    const base64 = await fileToBase64(file)
    const mimeType = file.type
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image'

    console.log('🔍 Appel Edge Function OCR...')

    // 2. Call Edge Function
    const { data, error } = await supabase.functions.invoke('invoice-ocr', {
      body: {
        fileBase64: base64,
        fileType,
        mimeType,
        companyId: COMPANY_ID
      }
    })

    if (error) {
      throw new Error(`Erreur Edge Function: ${error.message}`)
    }

    if (!data.success) {
      throw new Error(data.error || 'Erreur OCR inconnue')
    }

    const rawText = data.extractedText || ''
    console.log('✅ Texte extrait:', rawText.substring(0, 300) + '...')

    // 3. Use structured data from Edge Function if available, otherwise parse locally
    let extractedData: ExtractedInvoiceData

    if (data.structuredData) {
      console.log('📊 Utilisation données structurées Edge Function:', data.structuredData)
      extractedData = {
        vendorName: data.structuredData.vendorName || '',
        invoiceNumber: data.structuredData.invoiceNumber || '',
        invoiceDate: data.structuredData.invoiceDate || '',
        dueDate: data.structuredData.dueDate || '',
        totalTTC: typeof data.structuredData.totalTTC === 'number' ? data.structuredData.totalTTC : parseFloat(data.structuredData.totalTTC) || 0,
        totalHT: typeof data.structuredData.totalHT === 'number' ? data.structuredData.totalHT : parseFloat(data.structuredData.totalHT) || 0,
        totalTVA: typeof data.structuredData.totalTVA === 'number' ? data.structuredData.totalTVA : parseFloat(data.structuredData.totalTVA) || 0,
        vatRate: typeof data.structuredData.vatRate === 'number' ? data.structuredData.vatRate : parseFloat(data.structuredData.vatRate) || 20,
        description: data.structuredData.description || ''
      }
    } else {
      console.log('📊 Parsing local du texte extrait...')
      extractedData = parseInvoiceText(rawText)
    }

    return {
      success: true,
      data: {
        ...extractedData,
        rawText
      }
    }
  } catch (error) {
    console.error('❌ Erreur OCR:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }
  }
}

/**
 * Convert file to base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = error => reject(error)
  })
}
