// Produits Service - CRUD operations for products and services catalog
// Pennybarr - Gestion Commerciale

import { supabase, COMPANY_ID } from '../lib/supabase'
import type {
  Product,
  ProductCategory,
  ProductFormData,
  ProductFilters,
} from '../types/commercial'

// ============ CRUD Produits ============

/**
 * Create a new product
 */
export async function createProduct(data: ProductFormData): Promise<Product> {
  // Validate required fields
  if (!data.code?.trim()) {
    throw new Error('Le code produit est requis')
  }
  if (!data.name?.trim()) {
    throw new Error('Le nom du produit est requis')
  }
  if (!data.accountingCodeSale?.trim()) {
    throw new Error('Le compte comptable de vente est requis')
  }
  if (data.salePriceHT < 0) {
    throw new Error('Le prix de vente HT doit être positif')
  }

  // Check for duplicate code
  const { data: existing, error: checkError } = await supabase
    .from('products')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('code', data.code.trim().toUpperCase())
    .maybeSingle()

  if (checkError) {
    console.error('Error checking product code:', checkError)
    throw new Error(`Erreur vérification code produit: ${checkError.message}`)
  }

  if (existing) {
    throw new Error(`Le code produit "${data.code}" existe déjà`)
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      company_id: COMPANY_ID,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description?.trim() || null,
      type: data.type,
      category_id: data.categoryId || null,
      sale_price_ht: data.salePriceHT,
      purchase_price_ht: data.purchasePriceHT || null,
      vat_rate: data.vatRate,
      accounting_code_sale: data.accountingCodeSale.trim(),
      accounting_code_purchase: data.accountingCodePurchase?.trim() || null,
      track_stock: data.type === 'product' ? (data.trackStock ?? false) : false,
      stock_quantity: data.type === 'product' && data.trackStock ? 0 : null,
      stock_alert_threshold: data.type === 'product' && data.trackStock ? (data.stockAlertThreshold || null) : null,
      is_active: true,
    })
    .select('*, category:product_categories(*)')
    .single()

  if (error) {
    console.error('Error creating product:', error)
    throw new Error(`Erreur création produit: ${error.message}`)
  }

  console.log(`Created product: ${product.code} - ${product.name}`)
  return product
}

/**
 * Get a product by ID
 */
export async function getProduct(productId: string): Promise<Product> {
  if (!productId) {
    throw new Error('ID produit requis')
  }

  const { data, error } = await supabase
    .from('products')
    .select('*, category:product_categories(*)')
    .eq('id', productId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (error) {
    console.error('Error fetching product:', error)
    throw new Error(`Erreur chargement produit: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Produit non trouvé: ${productId}`)
  }

  return data
}

/**
 * Update a product
 */
export async function updateProduct(
  productId: string,
  data: Partial<ProductFormData>
): Promise<Product> {
  if (!productId) {
    throw new Error('ID produit requis')
  }

  // Build update object (only include defined fields)
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.code !== undefined) {
    if (!data.code.trim()) {
      throw new Error('Le code produit ne peut pas être vide')
    }
    // Check for duplicate code (excluding current product)
    const { data: existing, error: checkError } = await supabase
      .from('products')
      .select('id')
      .eq('company_id', COMPANY_ID)
      .eq('code', data.code.trim().toUpperCase())
      .neq('id', productId)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking product code:', checkError)
      throw new Error(`Erreur vérification code produit: ${checkError.message}`)
    }

    if (existing) {
      throw new Error(`Le code produit "${data.code}" existe déjà`)
    }
    updates.code = data.code.trim().toUpperCase()
  }

  if (data.name !== undefined) {
    if (!data.name.trim()) {
      throw new Error('Le nom du produit ne peut pas être vide')
    }
    updates.name = data.name.trim()
  }

  if (data.description !== undefined) {
    updates.description = data.description?.trim() || null
  }

  if (data.type !== undefined) {
    updates.type = data.type
  }

  if (data.categoryId !== undefined) {
    updates.category_id = data.categoryId || null
  }

  if (data.salePriceHT !== undefined) {
    if (data.salePriceHT < 0) {
      throw new Error('Le prix de vente HT doit être positif')
    }
    updates.sale_price_ht = data.salePriceHT
  }

  if (data.purchasePriceHT !== undefined) {
    updates.purchase_price_ht = data.purchasePriceHT || null
  }

  if (data.vatRate !== undefined) {
    updates.vat_rate = data.vatRate
  }

  if (data.accountingCodeSale !== undefined) {
    if (!data.accountingCodeSale.trim()) {
      throw new Error('Le compte comptable de vente ne peut pas être vide')
    }
    updates.accounting_code_sale = data.accountingCodeSale.trim()
  }

  if (data.accountingCodePurchase !== undefined) {
    updates.accounting_code_purchase = data.accountingCodePurchase?.trim() || null
  }

  if (data.trackStock !== undefined) {
    updates.track_stock = data.trackStock
    if (!data.trackStock) {
      updates.stock_quantity = null
      updates.stock_alert_threshold = null
    }
  }

  if (data.stockAlertThreshold !== undefined) {
    updates.stock_alert_threshold = data.stockAlertThreshold || null
  }

  const { data: product, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .eq('company_id', COMPANY_ID)
    .select('*, category:product_categories(*)')
    .single()

  if (error) {
    console.error('Error updating product:', error)
    throw new Error(`Erreur mise à jour produit: ${error.message}`)
  }

  console.log(`Updated product: ${product.code}`)
  return product
}

/**
 * Delete a product (soft delete by setting is_active = false)
 */
export async function deleteProduct(productId: string): Promise<void> {
  if (!productId) {
    throw new Error('ID produit requis')
  }

  // Check if product is used in any devis lines
  const { count: devisCount, error: checkError } = await supabase
    .from('devis_lines')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId)

  if (checkError) {
    console.error('Error checking product usage:', checkError)
    throw new Error(`Erreur vérification utilisation produit: ${checkError.message}`)
  }

  if (devisCount && devisCount > 0) {
    // Product is used, soft delete only
    const { error } = await supabase
      .from('products')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('company_id', COMPANY_ID)

    if (error) {
      console.error('Error deactivating product:', error)
      throw new Error(`Erreur désactivation produit: ${error.message}`)
    }

    console.log(`Product ${productId} deactivated (used in ${devisCount} devis)`)
  } else {
    // Product not used, can hard delete
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('company_id', COMPANY_ID)

    if (error) {
      console.error('Error deleting product:', error)
      throw new Error(`Erreur suppression produit: ${error.message}`)
    }

    console.log(`Product ${productId} deleted`)
  }
}

/**
 * List all products with optional filters
 */
export async function listProducts(filters?: ProductFilters): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*, category:product_categories(*)')
    .eq('company_id', COMPANY_ID)
    .order('code')

  // Apply filters
  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  } else {
    // By default, only show active products
    query = query.eq('is_active', true)
  }

  if (filters?.searchTerm) {
    const term = `%${filters.searchTerm}%`
    query = query.or(`code.ilike.${term},name.ilike.${term},description.ilike.${term}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error listing products:', error)
    throw new Error(`Erreur chargement produits: ${error.message}`)
  }

  if (!data) {
    console.error('listProducts: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour products')
  }

  return data
}

// ============ Recherche ============

/**
 * Search products by query string
 */
export async function searchProducts(query: string): Promise<Product[]> {
  if (!query?.trim()) {
    return listProducts({ isActive: true })
  }

  const term = `%${query.trim()}%`

  const { data, error } = await supabase
    .from('products')
    .select('*, category:product_categories(*)')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .or(`code.ilike.${term},name.ilike.${term},description.ilike.${term}`)
    .order('code')
    .limit(50)

  if (error) {
    console.error('Error searching products:', error)
    throw new Error(`Erreur recherche produits: ${error.message}`)
  }

  if (!data) {
    console.error('searchProducts: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour searched products')
  }

  return data
}

/**
 * Get products by category
 */
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  if (!categoryId) {
    throw new Error('ID catégorie requis')
  }

  const { data, error } = await supabase
    .from('products')
    .select('*, category:product_categories(*)')
    .eq('company_id', COMPANY_ID)
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('code')

  if (error) {
    console.error('Error fetching products by category:', error)
    throw new Error(`Erreur chargement produits par catégorie: ${error.message}`)
  }

  if (!data) {
    console.error('getProductsByCategory: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour products by category')
  }

  return data
}

// ============ Categories ============

/**
 * Create a product category
 */
export async function createCategory(
  name: string,
  parentId?: string
): Promise<ProductCategory> {
  if (!name?.trim()) {
    throw new Error('Le nom de la catégorie est requis')
  }

  // Check for duplicate name at same level
  let checkQuery = supabase
    .from('product_categories')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .ilike('name', name.trim())

  if (parentId) {
    checkQuery = checkQuery.eq('parent_id', parentId)
  } else {
    checkQuery = checkQuery.is('parent_id', null)
  }

  const { data: existing, error: checkError } = await checkQuery.maybeSingle()

  if (checkError) {
    console.error('Error checking category name:', checkError)
    throw new Error(`Erreur vérification nom catégorie: ${checkError.message}`)
  }

  if (existing) {
    throw new Error(`La catégorie "${name}" existe déjà à ce niveau`)
  }

  // Get max sort_order for positioning
  let sortQuery = supabase
    .from('product_categories')
    .select('sort_order')
    .eq('company_id', COMPANY_ID)
    .order('sort_order', { ascending: false })
    .limit(1)

  if (parentId) {
    sortQuery = sortQuery.eq('parent_id', parentId)
  } else {
    sortQuery = sortQuery.is('parent_id', null)
  }

  const { data: maxSort } = await sortQuery.maybeSingle()
  const sortOrder = (maxSort?.sort_order || 0) + 1

  const { data: category, error } = await supabase
    .from('product_categories')
    .insert({
      company_id: COMPANY_ID,
      name: name.trim(),
      parent_id: parentId || null,
      sort_order: sortOrder,
      is_active: true,
    })
    .select('*, parent:product_categories!parent_id(*)')
    .single()

  if (error) {
    console.error('Error creating category:', error)
    throw new Error(`Erreur création catégorie: ${error.message}`)
  }

  console.log(`Created category: ${category.name}`)
  return category
}

/**
 * List all product categories
 */
export async function listCategories(): Promise<ProductCategory[]> {
  const { data, error } = await supabase
    .from('product_categories')
    .select('*, parent:product_categories!parent_id(*)')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Error listing categories:', error)
    throw new Error(`Erreur chargement catégories: ${error.message}`)
  }

  // Build hierarchical structure
  const categories = data || []
  const rootCategories = categories.filter(c => !c.parent_id)

  // Add children to each category
  rootCategories.forEach(root => {
    root.children = categories.filter(c => c.parent_id === root.id)
  })

  return rootCategories
}

/**
 * Delete a product category
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  if (!categoryId) {
    throw new Error('ID catégorie requis')
  }

  // Check if category has products
  const { count: productCount, error: productCheckError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('is_active', true)

  if (productCheckError) {
    console.error('Error checking category products:', productCheckError)
    throw new Error(`Erreur vérification produits catégorie: ${productCheckError.message}`)
  }

  if (productCount && productCount > 0) {
    throw new Error(`Cette catégorie contient ${productCount} produit(s) actif(s). Déplacez ou supprimez les produits d'abord.`)
  }

  // Check if category has sub-categories
  const { count: childCount, error: childCheckError } = await supabase
    .from('product_categories')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', categoryId)
    .eq('is_active', true)

  if (childCheckError) {
    console.error('Error checking sub-categories:', childCheckError)
    throw new Error(`Erreur vérification sous-catégories: ${childCheckError.message}`)
  }

  if (childCount && childCount > 0) {
    throw new Error(`Cette catégorie contient ${childCount} sous-catégorie(s). Supprimez les sous-catégories d'abord.`)
  }

  // Soft delete the category
  const { error } = await supabase
    .from('product_categories')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', categoryId)
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error deleting category:', error)
    throw new Error(`Erreur suppression catégorie: ${error.message}`)
  }

  console.log(`Category ${categoryId} deleted`)
}

// ============ Prix et Stocks ============

/**
 * Update product price
 */
export async function updatePrice(
  productId: string,
  newPrice: number
): Promise<Product> {
  if (!productId) {
    throw new Error('ID produit requis')
  }

  if (newPrice < 0) {
    throw new Error('Le prix doit être positif')
  }

  const { data: product, error } = await supabase
    .from('products')
    .update({
      sale_price_ht: newPrice,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('company_id', COMPANY_ID)
    .select('*, category:product_categories(*)')
    .single()

  if (error) {
    console.error('Error updating price:', error)
    throw new Error(`Erreur mise à jour prix: ${error.message}`)
  }

  console.log(`Updated price for ${product.code}: ${newPrice} EUR HT`)
  return product
}

/**
 * Update product stock quantity
 */
export async function updateStock(
  productId: string,
  quantity: number
): Promise<Product> {
  if (!productId) {
    throw new Error('ID produit requis')
  }

  // First check if product tracks stock
  const { data: existing, error: checkError } = await supabase
    .from('products')
    .select('type, track_stock')
    .eq('id', productId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (checkError) {
    console.error('Error checking product:', checkError)
    throw new Error(`Erreur vérification produit: ${checkError.message}`)
  }

  if (!existing) {
    throw new Error(`Produit non trouvé: ${productId}`)
  }

  if (existing.type !== 'product') {
    throw new Error('La gestion de stock ne s\'applique qu\'aux produits (pas aux services)')
  }

  if (!existing.track_stock) {
    throw new Error('Ce produit n\'a pas la gestion de stock activée')
  }

  if (quantity < 0) {
    throw new Error('La quantité en stock ne peut pas être négative')
  }

  const { data: product, error } = await supabase
    .from('products')
    .update({
      stock_quantity: quantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('company_id', COMPANY_ID)
    .select('*, category:product_categories(*)')
    .single()

  if (error) {
    console.error('Error updating stock:', error)
    throw new Error(`Erreur mise à jour stock: ${error.message}`)
  }

  console.log(`Updated stock for ${product.code}: ${quantity} units`)
  return product
}

/**
 * Adjust stock quantity (add or remove units)
 */
export async function adjustStock(
  productId: string,
  adjustment: number,
  reason?: string
): Promise<Product> {
  if (!productId) {
    throw new Error('ID produit requis')
  }

  // Get current stock
  const { data: existing, error: checkError } = await supabase
    .from('products')
    .select('type, track_stock, stock_quantity, code')
    .eq('id', productId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (checkError) {
    console.error('Error checking product:', checkError)
    throw new Error(`Erreur vérification produit: ${checkError.message}`)
  }

  if (!existing) {
    throw new Error(`Produit non trouvé: ${productId}`)
  }

  if (existing.type !== 'product') {
    throw new Error('La gestion de stock ne s\'applique qu\'aux produits')
  }

  if (!existing.track_stock) {
    throw new Error('Ce produit n\'a pas la gestion de stock activée')
  }

  const currentStock = existing.stock_quantity || 0
  const newStock = currentStock + adjustment

  if (newStock < 0) {
    throw new Error(`Stock insuffisant. Stock actuel: ${currentStock}, ajustement demandé: ${adjustment}`)
  }

  const { data: product, error } = await supabase
    .from('products')
    .update({
      stock_quantity: newStock,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('company_id', COMPANY_ID)
    .select('*, category:product_categories(*)')
    .single()

  if (error) {
    console.error('Error adjusting stock:', error)
    throw new Error(`Erreur ajustement stock: ${error.message}`)
  }

  const adjustmentStr = adjustment >= 0 ? `+${adjustment}` : `${adjustment}`
  console.log(`Stock adjusted for ${product.code}: ${currentStock} -> ${newStock} (${adjustmentStr})${reason ? ` - ${reason}` : ''}`)

  return product
}

/**
 * Get products with low stock (below alert threshold)
 */
export async function getLowStockProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:product_categories(*)')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'product')
    .eq('track_stock', true)
    .eq('is_active', true)
    .not('stock_alert_threshold', 'is', null)

  if (error) {
    console.error('Error fetching low stock products:', error)
    throw new Error(`Erreur chargement produits stock bas: ${error.message}`)
  }

  // Filter products where stock_quantity <= stock_alert_threshold
  const lowStockProducts = (data || []).filter(
    p => (p.stock_quantity || 0) <= (p.stock_alert_threshold || 0)
  )

  return lowStockProducts
}
