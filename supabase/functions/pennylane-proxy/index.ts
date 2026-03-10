import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PENNYLANE_BASE_URL = 'https://app.pennylane.com/api/external/v2'
const RATE_LIMIT_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, params } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: apiKey, error: vaultError } = await supabase.rpc('get_vault_secret', {
      secret_name: 'pennylane_api_key',
    })

    if (vaultError || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Clé API Pennylane non trouvée dans le vault' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'test_connection': {
        const result = await pennylaneGet(apiKey, '/me')
        return jsonResponse({ ok: true, company: result.company?.name })
      }

      case 'list_supplier_invoices': {
        const supplierMap = await fetchAllSuppliers(apiKey)
        const filterParts: { field: string; operator: string; value: string }[] = []
        if (params?.dateFrom) {
          filterParts.push({ field: 'date', operator: 'gteq', value: params.dateFrom })
        }
        const extraParams: Record<string, string> = {}
        if (filterParts.length > 0) {
          extraParams.filter = JSON.stringify(filterParts)
        }

        const allInvoices = await fetchAllPaginated(apiKey, '/supplier_invoices', extraParams)

        for (const inv of allInvoices) {
          if (!inv.supplier && inv.supplier_id) {
            const s = supplierMap.get(inv.supplier_id)
            if (s) {
              inv.supplier = { id: s.id, name: s.name, emails: s.emails || [] }
            }
          }
          if (!inv.supplier?.name) {
            const name = inv.third_party_name || inv.label || null
            if (name) {
              inv.supplier = { id: 0, name, emails: [] }
            }
          }
        }

        return jsonResponse({ invoices: allInvoices, count: allInvoices.length })
      }

      case 'list_suppliers': {
        const supplierMap = await fetchAllSuppliers(apiKey)
        const suppliers = Array.from(supplierMap.values())
        return jsonResponse({ suppliers, count: suppliers.length })
      }

      case 'list_customers': {
        const items = await fetchAllPaginated(apiKey, '/customers')
        // Debug: log first customer to see all available fields
        if (items.length > 0) {
          console.log('[pennylane-proxy] Sample customer keys:', Object.keys(items[0]))
          console.log('[pennylane-proxy] Sample customer data:', JSON.stringify(items[0], null, 2))
        }
        return jsonResponse({ customers: items, count: items.length })
      }

      case 'get_customer': {
        const customerId = params?.customerId as number
        if (!customerId) {
          return new Response(
            JSON.stringify({ error: 'customerId requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const customer = await pennylaneGet(apiKey, `/customers/${customerId}`)
        console.log(`[pennylane-proxy] Customer #${customerId} raw keys:`, Object.keys(customer.customer || customer))
        return jsonResponse({ customer: customer.customer || customer })
      }

      case 'list_customer_invoices': {
        const filterParts: { field: string; operator: string; value: string }[] = []
        if (params?.dateFrom) {
          filterParts.push({ field: 'date', operator: 'gteq', value: params.dateFrom })
        }
        const extraParams: Record<string, string> = {}
        if (filterParts.length > 0) {
          extraParams.filter = JSON.stringify(filterParts)
        }
        const items = await fetchAllPaginated(apiKey, '/customer_invoices', extraParams)
        return jsonResponse({ invoices: items, count: items.length })
      }

      case 'list_quotes': {
        const items = await fetchAllPaginated(apiKey, '/quotes')
        return jsonResponse({ quotes: items, count: items.length })
      }

      case 'list_products': {
        const items = await fetchAllPaginated(apiKey, '/products')
        return jsonResponse({ products: items, count: items.length })
      }

      case 'list_categories': {
        const items = await fetchAllPaginated(apiKey, '/categories')
        return jsonResponse({ categories: items, count: items.length })
      }

      case 'list_category_groups': {
        const items = await fetchAllPaginated(apiKey, '/category_groups')
        return jsonResponse({ groups: items, count: items.length })
      }

      case 'get_invoice_matched_transactions': {
        const invoiceId = params?.invoiceId as number
        const invoiceType = params?.invoiceType as string // 'supplier' or 'customer'
        if (!invoiceId || !invoiceType) {
          return new Response(
            JSON.stringify({ error: 'invoiceId et invoiceType requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const endpoint = invoiceType === 'customer'
          ? `/customer_invoices/${invoiceId}/matched_transactions`
          : `/supplier_invoices/${invoiceId}/matched_transactions`
        const result = await pennylaneGet(apiKey, endpoint)
        const keys = Object.keys(result)
        console.log(`[pennylane-proxy] matched_transactions for ${invoiceType}#${invoiceId} - keys: ${keys.join(', ')}`)
        // Try multiple possible response keys
        const transactions = result.matched_transactions || result.transactions || result.items || result.data || []
        if (Array.isArray(transactions)) {
          console.log(`[pennylane-proxy] Found ${transactions.length} matched transactions`)
        } else {
          console.log(`[pennylane-proxy] transactions is not array, raw:`, JSON.stringify(result).slice(0, 500))
        }
        return jsonResponse({ transactions: Array.isArray(transactions) ? transactions : [] })
      }

      case 'list_transactions': {
        const items = await fetchAllPaginated(apiKey, '/transactions')
        return jsonResponse({ transactions: items, count: items.length })
      }

      case 'download_document': {
        const rawUrl = params?.url as string
        const storagePath = params?.storagePath as string
        if (!rawUrl || !storagePath) {
          return new Response(
            JSON.stringify({ error: 'url et storagePath requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const fileUrl = rawUrl.startsWith('http') ? rawUrl : `${PENNYLANE_BASE_URL}${rawUrl}`
        console.log(`[pennylane-proxy] Downloading: ${fileUrl} -> ${storagePath}`)

        // Only send Bearer token for Pennylane API URLs, not for public signed URLs
        const isApiUrl = !rawUrl.startsWith('http')
        const fetchHeaders: Record<string, string> = { Accept: '*/*' }
        if (isApiUrl) {
          fetchHeaders.Authorization = `Bearer ${apiKey}`
        }
        const fileResponse = await fetch(fileUrl, { headers: fetchHeaders })

        if (!fileResponse.ok) {
          const body = await fileResponse.text()
          console.error(`[pennylane-proxy] Download failed ${fileResponse.status}:`, body)
          throw new Error(`Download failed ${fileResponse.status}: ${body}`)
        }

        const fileBlob = await fileResponse.blob()
        const contentType = fileResponse.headers.get('content-type') || 'application/pdf'

        const { error: uploadError } = await supabase.storage
          .from('invoice-documents')
          .upload(storagePath, fileBlob, {
            contentType,
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          console.error(`[pennylane-proxy] Storage upload failed:`, uploadError)
          throw new Error(`Storage upload failed: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('invoice-documents')
          .getPublicUrl(storagePath)

        return jsonResponse({ publicUrl: urlData.publicUrl })
      }

      case 'debug_sample': {
        const endpoint = (params?.endpoint as string) || '/supplier_invoices'
        const response = await pennylaneGet(apiKey, endpoint, { limit: '2' })
        return jsonResponse({ raw_items: response.items, keys: response.items[0] ? Object.keys(response.items[0]) : [] })
      }

      default:
        return new Response(
          JSON.stringify({ error: `Action inconnue: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[pennylane-proxy] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============ Generic paginated fetch ============

// deno-lint-ignore no-explicit-any
async function fetchAllPaginated(apiKey: string, path: string, extraParams?: Record<string, string>): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const allItems: any[] = []
  let cursor: string | null = null
  let hasMore = true

  while (hasMore) {
    const queryParams: Record<string, string> = { limit: '100', ...extraParams }
    if (cursor) queryParams.cursor = cursor

    const response = await pennylaneGet(apiKey, path, queryParams)
    const items = response.items || response.data || []
    allItems.push(...items)
    hasMore = response.has_more || false
    cursor = response.next_cursor || null

    if (hasMore) await sleep(RATE_LIMIT_DELAY_MS)
  }

  console.log(`[pennylane-proxy] Fetched ${allItems.length} items from ${path}`)
  return allItems
}

// deno-lint-ignore no-explicit-any
async function fetchAllSuppliers(apiKey: string): Promise<Map<number, any>> {
  // deno-lint-ignore no-explicit-any
  const map = new Map<number, any>()
  const items = await fetchAllPaginated(apiKey, '/suppliers')
  for (const s of items) {
    map.set(s.id, s)
  }
  console.log(`[pennylane-proxy] Loaded ${map.size} suppliers into lookup map`)
  return map
}

// deno-lint-ignore no-explicit-any
async function pennylaneGet(apiKey: string, path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${PENNYLANE_BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    console.error(`[Pennylane API] ${response.status} ${path}:`, body)
    throw new Error(`Pennylane API ${response.status}: ${body}`)
  }

  return response.json()
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
