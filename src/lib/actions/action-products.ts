'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ProductFormState = { error: string | null }

function generateSku(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 20)
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}-${suffix}`
}

function parseProductDates(formData: FormData) {
  const preorderStartDate = String(formData.get('preorder_start_date') ?? '').trim()
  const preorderEndDate = String(formData.get('preorder_end_date') ?? '').trim()
  const releaseDate = String(formData.get('release_date') ?? '').trim()
  const salePercentageValue = String(formData.get('sale_percentage') ?? '').trim()
  const salePercentage = salePercentageValue === '' ? null : Number(salePercentageValue)

  if (salePercentage !== null && (!Number.isInteger(salePercentage) || salePercentage < 0 || salePercentage > 100)) {
    return { error: 'Sale percentage must be a whole number from 0 to 100.' }
  }
  if (preorderStartDate && preorderEndDate && preorderEndDate < preorderStartDate) {
    return { error: 'Pre-order end date cannot be before the start date.' }
  }

  return {
    values: {
      preorder_start_date: preorderStartDate || null,
      preorder_end_date: preorderEndDate || null,
      release_date: releaseDate || null,
      sale_percentage: salePercentage,
    },
  }
}

async function syncProductTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  tagIds: string[]
) {
  const { error: deleteError } = await supabase.from('product_tags').delete().eq('product_id', productId)
  if (deleteError) return deleteError
  if (tagIds.length === 0) return null

  const { error } = await supabase.from('product_tags').insert(
    tagIds.map((tagId) => ({ product_id: productId, tag_id: tagId }))
  )
  return error
}

async function validateCategorySelection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  subcategoryId: string
) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, parent_id, level')
    .eq('id', subcategoryId)
    .single()

  if (error || !data || data.level !== 1 || data.parent_id !== categoryId) {
    return false
  }

  return true
}

/** Add a new product to the catalog. */
export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const name = String(formData.get('name') ?? '').trim()
  const price = Number(formData.get('price') ?? 0)
  const stock = Number(formData.get('stock') ?? 0)
  let sku = String(formData.get('sku') ?? '').trim()
  const categoryId = String(formData.get('category_id') ?? '')
  const subcategoryId = String(formData.get('subcategory_id') ?? '')
  const brandId = String(formData.get('brand_id') ?? '')
  const seriesId = String(formData.get('series_id') ?? '')
  const tagIds = formData.getAll('tag_ids').map(String).filter(Boolean)

  if (!name) return { error: 'Product name is required.' }
  if (Number.isNaN(price) || price < 0) return { error: 'Enter a valid price.' }
  if (Number.isNaN(stock) || stock < 0) return { error: 'Enter a valid starting stock.' }
  if (!subcategoryId) return { error: 'Select a subcategory.' }
  if (!sku) sku = generateSku(name)

  const productDates = parseProductDates(formData)
  if (productDates.error) return { error: productDates.error }

  const supabase = await createClient()
  if (!(await validateCategorySelection(supabase, categoryId, subcategoryId))) {
    return { error: 'Select a valid category and subcategory.' }
  }

  const payload = {
    name,
    sku,
    price,
    stock,
    low_stock_threshold: Number(formData.get('low_stock_threshold') ?? 5),
    category_id: subcategoryId || categoryId || null,
    brand_id: brandId || null,
    series_id: seriesId || null,
    ...productDates.values,
    short_description: String(formData.get('short_description') ?? '').trim() || null,
    description: String(formData.get('description') ?? '') || null,
    specifications: String(formData.get('specifications') ?? '').trim() || null,
    image_url: String(formData.get('image_url') ?? '') || null,
    image_urls: String(formData.get('image_urls') ?? '')
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean),
  }

  const { data, error } = await supabase.from('products').insert(payload).select('id').single()

  if (error) {
    if (error.code === '23505') return { error: 'That SKU is already in use.' }
    return { error: error.message }
  }

  const tagError = await syncProductTags(supabase, data.id, tagIds)
  if (tagError) return { error: tagError.message }

  // Revalidate Admin and Public Pages
  revalidatePath('/admin/products')
  revalidatePath('/products')
  redirect(`/admin/products/${data.id}`)
}

/** Bind the product id first: `updateProduct.bind(null, id)`. Does not touch
 * stock — that goes through adjustStock so every change is intentional. */
export async function updateProduct(
  id: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const name = String(formData.get('name') ?? '').trim()
  const sku = String(formData.get('sku') ?? '').trim()
  const price = Number(formData.get('price') ?? 0)
  const categoryId = String(formData.get('category_id') ?? '')
  const subcategoryId = String(formData.get('subcategory_id') ?? '')
  const brandId = String(formData.get('brand_id') ?? '')
  const seriesId = String(formData.get('series_id') ?? '')
  const tagIds = formData.getAll('tag_ids').map(String).filter(Boolean)

  if (!name) return { error: 'Product name is required.' }
  if (!sku) return { error: 'SKU is required.' }
  if (Number.isNaN(price) || price < 0) return { error: 'Enter a valid price.' }
  if (!subcategoryId) return { error: 'Select a subcategory.' }

  const productDates = parseProductDates(formData)
  if (productDates.error) return { error: productDates.error }

  const supabase = await createClient()
  if (!(await validateCategorySelection(supabase, categoryId, subcategoryId))) {
    return { error: 'Select a valid category and subcategory.' }
  }

  const payload = {
    name,
    sku,
    price,
    low_stock_threshold: Number(formData.get('low_stock_threshold') ?? 5),
    category_id: subcategoryId || categoryId || null,
    brand_id: brandId || null,
    series_id: seriesId || null,
    ...productDates.values,
    short_description: String(formData.get('short_description') ?? '').trim() || null,
    description: String(formData.get('description') ?? '') || null,
    specifications: String(formData.get('specifications') ?? '').trim() || null,
    image_url: String(formData.get('image_url') ?? '') || null,
    image_urls: String(formData.get('image_urls') ?? '')
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('products').update(payload).eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'That SKU is already in use.' }
    return { error: error.message }
  }

  const tagError = await syncProductTags(supabase, id, tagIds)
  if (tagError) return { error: tagError.message }

  // Revalidate Admin and Public Pages
  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${id}`)
  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  return { error: null }
}

/** Remove a product from the catalog entirely. */
export async function deleteProduct(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
  revalidatePath('/products')
  redirect('/admin/products')
}

/**
 * Stocking a product — pass a positive delta to restock, a negative delta
 * to remove stock (sale, damage, correction). Stock is clamped at 0.
 */
export async function adjustStock(id: string, delta: number) {
  const supabase = await createClient()

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock')
    .eq('id', id)
    .single()

  if (fetchError || !product) return { error: 'Product not found.' }

  const nextStock = Math.max(0, product.stock + delta)

  const { error } = await supabase
    .from('products')
    .update({ stock: nextStock, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${id}`)
  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  return { error: null, stock: nextStock }
}

/** Set a product's stock to an exact non-negative whole number. */
export async function setStock(
  id: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const stock = Number(formData.get('stock'))

  if (!Number.isInteger(stock) || stock < 0) {
    return { error: 'Enter a valid stock quantity.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .update({ stock, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${id}`)
  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  return { error: null }
}