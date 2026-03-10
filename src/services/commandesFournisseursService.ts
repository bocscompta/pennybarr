// Supplier Orders Service - CRUD operations and workflow management
// Pennybarr - Gestion Achats

import { supabase, COMPANY_ID } from '../lib/supabase'
import type {
  SupplierOrder,
  SupplierOrderFormData,
  SupplierOrderLineFormData,
  SupplierOrderFilters,
  SupplierOrderStatus,
  GoodsReceipt,
  GoodsReceiptFormData,
  ThreeWayMatchSummary,
  ThreeWayMatchLine,
} from '../types/achats'

// ============ Helper Functions ============

/**
 * Calculate line totals from input data
 */
function calculateLineTotals(line: SupplierOrderLineFormData): {
  total_ht: number
  total_vat: number
  total_ttc: number
} {
  const totalHT = line.quantity * line.unitPrice
  const totalVAT = (totalHT * line.vatRate) / 100
  const totalTTC = totalHT + totalVAT

  return {
    total_ht: totalHT,
    total_vat: totalVAT,
    total_ttc: totalTTC,
  }
}

// ============ Order Number Generation ============

/**
 * Generate next supplier order number
 * Format: CMD-YYYY-NNNNN (ex: CMD-2025-00001)
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `CMD-${year}-`

  const { data, error } = await supabase
    .from('supplier_orders')
    .select('number')
    .eq('company_id', COMPANY_ID)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching last order number:', error)
    throw new Error(`Erreur generation numero commande: ${error.message}`)
  }

  let nextNumber = 1
  if (data && data.length > 0) {
    const lastNumber = data[0].number
    const lastSeq = parseInt(lastNumber.replace(prefix, ''), 10)
    if (!isNaN(lastSeq)) {
      nextNumber = lastSeq + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`
}

// ============ CRUD Operations ============

/**
 * Create a new supplier order
 */
export async function createOrder(data: SupplierOrderFormData): Promise<SupplierOrder> {
  // Validate required fields
  if (!data.supplierId) {
    throw new Error('Le fournisseur est requis pour creer une commande')
  }
  if (!data.date) {
    throw new Error('La date de la commande est requise')
  }
  if (!data.lines || data.lines.length === 0) {
    throw new Error('Au moins une ligne est requise')
  }

  // Generate order number
  const orderNumber = await generateOrderNumber()

  // Calculate totals from lines
  let totalHT = 0
  let totalVAT = 0
  let totalTTC = 0

  const processedLines = data.lines.map((line, index) => {
    const lineTotals = calculateLineTotals(line)

    totalHT += lineTotals.total_ht
    totalVAT += lineTotals.total_vat
    totalTTC += lineTotals.total_ttc

    return {
      product_id: line.productId || null,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      vat_rate: line.vatRate,
      total_ht: lineTotals.total_ht,
      total_vat: lineTotals.total_vat,
      total_ttc: lineTotals.total_ttc,
      received_quantity: 0,
      invoiced_quantity: 0,
      sort_order: index + 1,
    }
  })

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('supplier_orders')
    .insert({
      company_id: COMPANY_ID,
      supplier_id: data.supplierId,
      number: orderNumber,
      date: data.date,
      expected_delivery_date: data.expectedDeliveryDate || null,
      status: 'draft' as SupplierOrderStatus,
      total_ht: totalHT,
      total_vat: totalVAT,
      total_ttc: totalTTC,
      notes: data.notes || null,
      payment_terms: data.paymentTerms || null,
      delivery_address: data.deliveryAddress || null,
    })
    .select('*, supplier:third_parties(*)')
    .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    throw new Error(`Erreur creation commande: ${orderError.message}`)
  }

  // Create lines
  const linesWithOrderId = processedLines.map((line) => ({
    ...line,
    order_id: order.id,
  }))

  const { data: lines, error: linesError } = await supabase
    .from('supplier_order_lines')
    .insert(linesWithOrderId)
    .select('*')

  if (linesError) {
    console.error('Error creating order lines:', linesError)
    // Rollback: delete the order
    await supabase.from('supplier_orders').delete().eq('id', order.id)
    throw new Error(`Erreur creation lignes commande: ${linesError.message}`)
  }

  console.log(`Created order ${orderNumber} with ${lines?.length || 0} lines`)

  return {
    ...order,
    lines: lines || [],
  }
}

/**
 * Get an order by ID
 */
export async function getOrder(orderId: string): Promise<SupplierOrder> {
  const { data, error } = await supabase
    .from('supplier_orders')
    .select('*, supplier:third_parties(*), lines:supplier_order_lines(*)')
    .eq('id', orderId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (error) {
    console.error('Error fetching order:', error)
    throw new Error(`Erreur chargement commande: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Commande non trouvee: ${orderId}`)
  }

  return data
}

/**
 * Update an order
 */
export async function updateOrder(
  orderId: string,
  data: Partial<SupplierOrderFormData>
): Promise<SupplierOrder> {
  // Check if order exists and is editable
  const existing = await getOrder(orderId)
  if (existing.status !== 'draft') {
    throw new Error('Seules les commandes en brouillon peuvent etre modifiees')
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.supplierId !== undefined) updateData.supplier_id = data.supplierId
  if (data.date !== undefined) updateData.date = data.date
  if (data.expectedDeliveryDate !== undefined) updateData.expected_delivery_date = data.expectedDeliveryDate || null
  if (data.notes !== undefined) updateData.notes = data.notes || null
  if (data.paymentTerms !== undefined) updateData.payment_terms = data.paymentTerms || null
  if (data.deliveryAddress !== undefined) updateData.delivery_address = data.deliveryAddress || null

  // If lines are provided, replace all lines
  if (data.lines && data.lines.length > 0) {
    // Delete existing lines
    const { error: deleteError } = await supabase
      .from('supplier_order_lines')
      .delete()
      .eq('order_id', orderId)

    if (deleteError) {
      console.error('Error deleting existing order lines:', deleteError)
      throw new Error(`Erreur suppression lignes: ${deleteError.message}`)
    }

    // Calculate new totals
    let totalHT = 0
    let totalVAT = 0
    let totalTTC = 0

    const newLines = data.lines.map((line, index) => {
      const lineTotals = calculateLineTotals(line)

      totalHT += lineTotals.total_ht
      totalVAT += lineTotals.total_vat
      totalTTC += lineTotals.total_ttc

      return {
        order_id: orderId,
        product_id: line.productId || null,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unitPrice,
        vat_rate: line.vatRate,
        total_ht: lineTotals.total_ht,
        total_vat: lineTotals.total_vat,
        total_ttc: lineTotals.total_ttc,
        received_quantity: 0,
        invoiced_quantity: 0,
        sort_order: index + 1,
      }
    })

    // Insert new lines
    const { error: insertError } = await supabase
      .from('supplier_order_lines')
      .insert(newLines)

    if (insertError) {
      console.error('Error inserting new order lines:', insertError)
      throw new Error(`Erreur insertion lignes: ${insertError.message}`)
    }

    updateData.total_ht = totalHT
    updateData.total_vat = totalVAT
    updateData.total_ttc = totalTTC
  }

  // Update order
  const { data: updated, error: updateError } = await supabase
    .from('supplier_orders')
    .update(updateData)
    .eq('id', orderId)
    .select('*, supplier:third_parties(*), lines:supplier_order_lines(*)')
    .single()

  if (updateError) {
    console.error('Error updating order:', updateError)
    throw new Error(`Erreur mise a jour commande: ${updateError.message}`)
  }

  return updated
}

/**
 * Delete an order
 */
export async function deleteOrder(orderId: string): Promise<void> {
  // Check if order exists and is deletable
  const existing = await getOrder(orderId)
  if (existing.status !== 'draft' && existing.status !== 'cancelled') {
    throw new Error('Seules les commandes en brouillon ou annulees peuvent etre supprimees')
  }

  // Delete lines first
  const { error: linesError } = await supabase
    .from('supplier_order_lines')
    .delete()
    .eq('order_id', orderId)

  if (linesError) {
    console.error('Error deleting order lines:', linesError)
    throw new Error(`Erreur suppression lignes commande: ${linesError.message}`)
  }

  // Delete order
  const { error } = await supabase
    .from('supplier_orders')
    .delete()
    .eq('id', orderId)

  if (error) {
    console.error('Error deleting order:', error)
    throw new Error(`Erreur suppression commande: ${error.message}`)
  }

  console.log(`Deleted order ${existing.number}`)
}

/**
 * List orders with optional filters
 */
export async function listOrders(filters?: SupplierOrderFilters): Promise<SupplierOrder[]> {
  let query = supabase
    .from('supplier_orders')
    .select('*, supplier:third_parties(*), lines:supplier_order_lines(*)')
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.supplierId) {
    query = query.eq('supplier_id', filters.supplierId)
  }

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate)
  }

  if (filters?.searchTerm) {
    query = query.or(
      `number.ilike.%${filters.searchTerm}%,notes.ilike.%${filters.searchTerm}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error listing orders:', error)
    throw new Error(`Erreur liste commandes: ${error.message}`)
  }

  if (!data) {
    console.error('listOrders: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour supplier orders')
  }

  return data
}

// ============ Workflow Operations ============

/**
 * Validate an order (draft -> validated)
 */
export async function validateOrder(orderId: string): Promise<SupplierOrder> {
  const order = await getOrder(orderId)

  if (order.status !== 'draft') {
    throw new Error('Seules les commandes en brouillon peuvent etre validees')
  }

  // Check that order has lines
  if (!order.lines || order.lines.length === 0) {
    throw new Error('La commande doit avoir au moins une ligne pour etre validee')
  }

  const { data, error } = await supabase
    .from('supplier_orders')
    .update({
      status: 'validated' as SupplierOrderStatus,
      validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*, supplier:third_parties(*), lines:supplier_order_lines(*)')
    .single()

  if (error) {
    console.error('Error validating order:', error)
    throw new Error(`Erreur validation commande: ${error.message}`)
  }

  console.log(`Order ${data.number} validated`)
  return data
}

/**
 * Send an order to supplier (validated -> sent)
 * In a real app, this would also generate a PDF and send an email
 */
export async function sendOrder(orderId: string): Promise<SupplierOrder> {
  const order = await getOrder(orderId)

  if (order.status !== 'validated') {
    throw new Error('Seules les commandes validees peuvent etre envoyees')
  }

  const { data, error } = await supabase
    .from('supplier_orders')
    .update({
      status: 'sent' as SupplierOrderStatus,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*, supplier:third_parties(*), lines:supplier_order_lines(*)')
    .single()

  if (error) {
    console.error('Error sending order:', error)
    throw new Error(`Erreur envoi commande: ${error.message}`)
  }

  console.log(`Order ${data.number} marked as sent`)
  // TODO: Generate PDF and send email to supplier

  return data
}

/**
 * Receive goods for an order
 */
export async function receiveGoods(
  data: GoodsReceiptFormData
): Promise<GoodsReceipt> {
  const order = await getOrder(data.orderId)

  if (order.status !== 'sent' && order.status !== 'received') {
    throw new Error('Seules les commandes envoyees peuvent avoir une reception')
  }

  // Create receipt
  const { data: receipt, error: receiptError } = await supabase
    .from('goods_receipts')
    .insert({
      order_id: data.orderId,
      date: data.date,
      reference: data.reference || null,
      notes: data.notes || null,
    })
    .select('*')
    .single()

  if (receiptError) {
    console.error('Error creating receipt:', receiptError)
    throw new Error(`Erreur creation reception: ${receiptError.message}`)
  }

  // Create receipt lines and update order lines
  for (const line of data.lines) {
    // Create receipt line
    const { error: lineError } = await supabase
      .from('goods_receipt_lines')
      .insert({
        receipt_id: receipt.id,
        order_line_id: line.orderLineId,
        quantity_received: line.quantityReceived,
        notes: line.notes || null,
      })

    if (lineError) {
      console.error('Error creating receipt line:', lineError)
      throw new Error(`Erreur creation ligne reception: ${lineError.message}`)
    }

    // Update received_quantity on order line
    const { data: orderLine, error: fetchError } = await supabase
      .from('supplier_order_lines')
      .select('received_quantity')
      .eq('id', line.orderLineId)
      .single()

    if (fetchError) {
      console.error('Error fetching order line:', fetchError)
      throw new Error(`Erreur lecture ligne commande: ${fetchError.message}`)
    }

    const newReceivedQty = (orderLine?.received_quantity || 0) + line.quantityReceived

    const { error: updateError } = await supabase
      .from('supplier_order_lines')
      .update({
        received_quantity: newReceivedQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', line.orderLineId)

    if (updateError) {
      console.error('Error updating order line received quantity:', updateError)
      throw new Error(`Erreur mise a jour quantite recue: ${updateError.message}`)
    }
  }

  // Update order status if not already 'received'
  if (order.status !== 'received') {
    const { error: statusError } = await supabase
      .from('supplier_orders')
      .update({
        status: 'received' as SupplierOrderStatus,
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.orderId)

    if (statusError) {
      console.error('Error updating order status:', statusError)
      throw new Error(`Erreur mise a jour statut commande: ${statusError.message}`)
    }
  }

  // Fetch complete receipt with lines
  const { data: completeReceipt, error: fetchReceiptError } = await supabase
    .from('goods_receipts')
    .select('*, lines:goods_receipt_lines(*)')
    .eq('id', receipt.id)
    .single()

  if (fetchReceiptError) {
    console.error('Error fetching complete receipt:', fetchReceiptError)
    throw new Error(`Erreur lecture reception: ${fetchReceiptError.message}`)
  }

  console.log(`Created receipt for order ${order.number}`)
  return completeReceipt
}

/**
 * Link an order to a supplier invoice
 */
export async function linkToInvoice(
  orderId: string,
  invoiceId: string
): Promise<SupplierOrder> {
  const order = await getOrder(orderId)

  if (order.status !== 'received' && order.status !== 'sent') {
    throw new Error('Seules les commandes envoyees ou recues peuvent etre liees a une facture')
  }

  // Update order
  const { data, error } = await supabase
    .from('supplier_orders')
    .update({
      status: 'invoiced' as SupplierOrderStatus,
      linked_invoice_id: invoiceId,
      invoiced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*, supplier:third_parties(*), lines:supplier_order_lines(*)')
    .single()

  if (error) {
    console.error('Error linking order to invoice:', error)
    throw new Error(`Erreur liaison commande-facture: ${error.message}`)
  }

  // Update invoiced_quantity on order lines (assuming full invoicing)
  if (order.lines) {
    for (const line of order.lines) {
      const { error: lineError } = await supabase
        .from('supplier_order_lines')
        .update({
          invoiced_quantity: line.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', line.id)

      if (lineError) {
        console.error('Error updating invoiced quantity:', lineError)
        // Don't throw, order is already linked
      }
    }
  }

  console.log(`Order ${data.number} linked to invoice ${invoiceId}`)
  return data
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<SupplierOrder> {
  const order = await getOrder(orderId)

  if (order.status === 'invoiced') {
    throw new Error('Une commande facturee ne peut pas etre annulee')
  }

  const { data, error } = await supabase
    .from('supplier_orders')
    .update({
      status: 'cancelled' as SupplierOrderStatus,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*, supplier:third_parties(*), lines:supplier_order_lines(*)')
    .single()

  if (error) {
    console.error('Error cancelling order:', error)
    throw new Error(`Erreur annulation commande: ${error.message}`)
  }

  console.log(`Order ${data.number} cancelled`)
  return data
}

// ============ 3-Way Match ============

/**
 * Get 3-way match summary for an order
 * Compares: Ordered vs Received vs Invoiced quantities
 */
export async function getThreeWayMatch(orderId: string): Promise<ThreeWayMatchSummary> {
  const order = await getOrder(orderId)

  const lines: ThreeWayMatchLine[] = (order.lines || []).map((line) => {
    const orderedQty = line.quantity
    const receivedQty = line.received_quantity || 0
    const invoicedQty = line.invoiced_quantity || 0

    let hasDiscrepancy = false
    let discrepancyType: ThreeWayMatchLine['discrepancyType'] = undefined

    if (receivedQty < orderedQty) {
      hasDiscrepancy = true
      discrepancyType = 'under_received'
    } else if (receivedQty > orderedQty) {
      hasDiscrepancy = true
      discrepancyType = 'over_received'
    } else if (invoicedQty < orderedQty) {
      hasDiscrepancy = true
      discrepancyType = 'under_invoiced'
    } else if (invoicedQty > orderedQty) {
      hasDiscrepancy = true
      discrepancyType = 'over_invoiced'
    }

    return {
      orderLineId: line.id,
      description: line.description,
      orderedQuantity: orderedQty,
      receivedQuantity: receivedQty,
      invoicedQuantity: invoicedQty,
      unitPrice: line.unit_price,
      hasDiscrepancy,
      discrepancyType,
    }
  })

  const totalOrdered = lines.reduce((sum, l) => sum + l.orderedQuantity * l.unitPrice, 0)
  const totalReceived = lines.reduce((sum, l) => sum + l.receivedQuantity * l.unitPrice, 0)
  const totalInvoiced = lines.reduce((sum, l) => sum + l.invoicedQuantity * l.unitPrice, 0)

  return {
    orderId: order.id,
    orderNumber: order.number,
    supplierName: order.supplier?.name || 'Fournisseur inconnu',
    totalOrdered,
    totalReceived,
    totalInvoiced,
    hasDiscrepancy: lines.some((l) => l.hasDiscrepancy),
    lines,
  }
}

/**
 * Get receipts for an order
 */
export async function getOrderReceipts(orderId: string): Promise<GoodsReceipt[]> {
  const { data, error } = await supabase
    .from('goods_receipts')
    .select('*, lines:goods_receipt_lines(*)')
    .eq('order_id', orderId)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching order receipts:', error)
    throw new Error(`Erreur lecture receptions: ${error.message}`)
  }

  if (!data) {
    console.error('getOrderReceipts: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour order receipts')
  }

  return data
}
