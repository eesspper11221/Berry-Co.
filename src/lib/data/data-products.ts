import { createClient } from '@/lib/supabase/server'
import type { Category, Product, ProductStatus, ProductWithCategory } from '@/types/database'

export interface CategoryNode extends Category {
  children: CategoryNode[]
}

export interface ProductMetadataOptions {
  brands: { id: string; name: string }[]
  series: { id: string; name: string }[]
  tags: { id: string; name: string }[]
}

export async function getProductMetadataOptions(): Promise<ProductMetadataOptions> {
  const supabase = await createClient()
  const [{ data: brands }, { data: series }, { data: tags }] = await Promise.all([
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('series').select('id, name').order('name'),
    supabase.from('tags').select('id, name').order('name'),
  ])

  return { brands: brands ?? [], series: series ?? [], tags: tags ?? [] }
}

export function deriveProductStatus(stock: number, lowStockThreshold: number): ProductStatus {
  if (stock <= 0) return 'out_of_stock'
  if (stock <= lowStockThreshold) return 'low_stock'
  return 'active'
}

function toProductWithCategory(
  product: any, // Using 'any' here temporarily to handle the joined Supabase format
  categoriesById: Map<string, Category>
): ProductWithCategory {
  const leaf = product.category_id ? categoriesById.get(product.category_id) : undefined
  const sub = leaf?.parent_id ? categoriesById.get(leaf.parent_id) : undefined
  const top = sub?.parent_id ? categoriesById.get(sub.parent_id) : undefined

  // Remove the nested joined objects so they don't pollute the final object
  const { brands, series, product_tags, ...restProduct } = product

  // Compute display string for pre-order window if dates are present
  const preorder_period =
    product.preorder_start_date && product.preorder_end_date
      ? `${new Date(product.preorder_start_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })} – ${new Date(product.preorder_end_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}`
      : undefined

  return {
    ...restProduct,
    preorder_period,
    category_name: top?.name ?? sub?.name ?? null,
    subcategory_name: sub?.name ?? leaf?.name ?? null,
    brand_name: brands?.name ?? null,
    series_name: series?.name ?? null,
    shortDescription: product.short_description ?? null,
    // Map the junction table records into a flat array of strings
    tags: product_tags?.map((pt: any) => pt.tags?.name).filter(Boolean) ?? [],
    status: deriveProductStatus(product.stock, product.low_stock_threshold),
  }
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('*').order('level').order('name')
  if (error || !data) return []
  return data as Category[]
}

export function buildCategoryTree(flat: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()
  flat.forEach((c) => byId.set(c.id, { ...c, children: [] }))

  const roots: CategoryNode[] = []
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else if (!node.parent_id) {
      roots.push(node)
    }
  })
  return roots
}

export async function getProducts(
  params: {
    search?: string
    categoryId?: string
    status?: ProductStatus
    inStock?: boolean
    tags?: string[]
    page?: number
    pageSize?: number
  } = {}
): Promise<{ products: ProductWithCategory[]; count: number }> {
  const { search, categoryId, status, inStock, tags = [], page = 1, pageSize = 20 } = params
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*, brands(name), series(name), product_tags(tags(name))')
    .order('created_at', { ascending: false })
    .limit(500)

  if (search) query = query.ilike('name', `%${search}%`)
  if (categoryId) query = query.eq('category_id', categoryId)

  const [{ data, error }, categories] = await Promise.all([query, getCategories()])

  if (error || !data) return { products: [], count: 0 }

  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  let products = data.map((p) => toProductWithCategory(p, categoriesById))

  // Filter 1: Status / Out of stock filter
  if (inStock) {
    products = products.filter((p) => p.status !== 'out_of_stock')
  }

  // Filter 2: Tags filter (e.g., Pre-Order, Sale)
  if (tags.length > 0) {
    products = products.filter((p) =>
      tags.every((tag) => (p.tags ?? []).includes(tag))
    )
  }

  if (status) products = products.filter((p) => p.status === status)

  const count = products.length
  const from = (page - 1) * pageSize
  products = products.slice(from, from + pageSize)

  return { products, count }
}

export async function getProductById(id: string): Promise<ProductWithCategory | null> {
  const supabase = await createClient()

  const [{ data, error }, categories] = await Promise.all([
    supabase
      .from('products')
      .select('*, brands(name), series(name), product_tags(tags(name))')
      .eq('id', id)
      .single(),
    getCategories(),
  ])

  if (error || !data) return null

  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  return toProductWithCategory(data, categoriesById)
}