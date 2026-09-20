import { createClient } from '@/lib/supabase/server'

interface CartOwner {
  userId?: string
  guestToken?: string
}

export type ProductPriceData = {
  price: number
  sale_percentage?: number | null
}

/**
 * Calculates effective unit price based on active sale percentage set from the dashboard
 */
export function getEffectivePrice(product: ProductPriceData): number {
  const price = Number(product.price) || 0
  const salePercentage = Number(product.sale_percentage) || 0

  if (salePercentage <= 0) return price

  const discounted = price * (1 - salePercentage / 100)
  return Math.round(discounted * 100) / 100
}

async function getOrCreateCart({ userId, guestToken }: CartOwner) {
  const supabase = await createClient()
  let query = supabase.from('carts').select('id, user_id, session_token').limit(1)
  if (userId) query = query.eq('user_id', userId)
  else if (guestToken) query = query.eq('session_token', guestToken)
  else throw Object.assign(new Error('NO_CART_OWNER'), { status: 401 })

  const { data: existing, error: lookupError } = await query.maybeSingle()
  if (lookupError) throw new Error(lookupError.message)
  if (existing) return existing

  const { data: created, error: createError } = await supabase
    .from('carts')
    .insert({ user_id: userId ?? null, session_token: guestToken ?? null })
    .select('id, user_id, session_token')
    .single()
  if (createError || !created) throw new Error(createError?.message ?? 'Unable to create cart.')
  return created
}

async function getProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, stock, sale_percentage')
    .eq('id', productId)
    .maybeSingle()
  if (error || !data) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { status: 404 })
  return data
}

export async function getCart(owner: CartOwner) {
  const supabase = await createClient()
  const cart = await getOrCreateCart(owner)
  const { data: items, error } = await supabase
    .from('cart_items')
    .select(`
      id, 
      product_id, 
      quantity, 
      unit_price_snapshot, 
      products(id, name, price, sale_percentage, image_url)
    `)
    .eq('cart_id', cart.id)
    .order('added_at', { ascending: true })
  if (error) throw new Error(error.message)

  const normalizedItems = (items ?? []).map((item) => {
    const rawProduct = Array.isArray(item.products) ? item.products[0] : item.products
    const currentEffectivePrice = rawProduct ? getEffectivePrice(rawProduct) : Number(item.unit_price_snapshot)
    const originalPrice = rawProduct ? Number(rawProduct.price) : Number(item.unit_price_snapshot)

    return {
      ...item,
      product: rawProduct ?? null,
      unit_price_snapshot: currentEffectivePrice,
      original_price: originalPrice,
    }
  })

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.unit_price_snapshot * item.quantity, 0)
  return { cartId: cart.id, items: normalizedItems, subtotal, itemCount: normalizedItems.length }
}

export async function addToCart(owner: CartOwner, productId: string, quantity: number) {
  if (quantity < 1) throw Object.assign(new Error('Quantity must be at least 1.'), { status: 400 })
  const supabase = await createClient()
  const product = await getProduct(supabase, productId)
  const cart = await getOrCreateCart(owner)

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', productId)
    .maybeSingle()

  const newQuantity = (existing?.quantity ?? 0) + quantity
  if (newQuantity > product.stock) {
    throw Object.assign(new Error(`Only ${product.stock} unit(s) of "${product.name}" left in stock.`), { status: 409 })
  }

  const effectivePrice = getEffectivePrice(product)

  const request = existing
    ? supabase.from('cart_items').update({ quantity: newQuantity, unit_price_snapshot: effectivePrice }).eq('id', existing.id)
    : supabase.from('cart_items').insert({ cart_id: cart.id, product_id: productId, quantity, unit_price_snapshot: effectivePrice })

  const { data, error } = await request.select('id, cart_id, product_id, quantity, unit_price_snapshot').single()
  if (error || !data) throw new Error(error?.message ?? 'Unable to add item to cart.')
  return data
}

export async function updateCartItemQuantity(owner: CartOwner, cartItemId: string, quantity: number) {
  const supabase = await createClient()
  const cart = await getOrCreateCart(owner)

  if (quantity < 1) {
    await removeCartItem(owner, cartItemId)
    return null
  }

  const { data: item } = await supabase.from('cart_items').select('product_id').eq('id', cartItemId).eq('cart_id', cart.id).single()
  if (!item) throw Object.assign(new Error('CART_ITEM_NOT_FOUND'), { status: 404 })

  const product = await getProduct(supabase, item.product_id)
  if (quantity > product.stock) throw Object.assign(new Error(`Only ${product.stock} unit(s) left in stock.`), { status: 409 })

  const effectivePrice = getEffectivePrice(product)

  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity, unit_price_snapshot: effectivePrice })
    .eq('id', cartItemId)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Unable to update cart.')
  return data
}

export async function removeCartItem(owner: CartOwner, cartItemId: string) {
  const supabase = await createClient()
  const cart = await getOrCreateCart(owner)
  const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId).eq('cart_id', cart.id)
  if (error) throw new Error(error.message)
}

export async function clearCart(cartId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId)
  if (error) throw new Error(error.message)
}