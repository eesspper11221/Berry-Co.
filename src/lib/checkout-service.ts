import { createClient } from '@/lib/supabase/server'
import type { ShippingAddress } from './db'

export interface CheckoutInput {
  userId: string; // checkout requires a logged-in user (guests must sign in/up first)
  shippingAddress: ShippingAddress;
  paymentMethod: 'card' | 'gcash' | 'cod';
  shippingFee?: number;
  selectedCartItemIds?: string[];
}

// NOTE ON MONEY MATH: this uses plain `number` for totals, which is fine for
// the in-memory stand-in but is NOT safe for real currency math (floating
// point rounding). Once Supabase is connected, store prices as integer
// cents/centavos, or use a decimal library (e.g. decimal.js) for the
// subtotal/total calculations below — the same way Prisma.Decimal was doing
// it before this file was adapted away from Prisma.

/**
 * Checkout is the one place where correctness matters most, so everything
 * happens inside a single transaction wrapper (db.$transaction — see the
 * migration note in db.ts about making this a real Postgres transaction
 * once Supabase is connected):
 *   1. Re-fetch the cart fresh (never trust client-side totals).
 *   2. Re-validate EVERY line against current availability/stock/pre-order
 *      window — prices and stock can change between "view cart" and
 *      "click checkout".
 *   3. Decrement stockQty for IN_STOCK / ON_SALE items (pre-orders don't
 *      decrement stock the same way — see note below).
 *   4. Snapshot product name + price onto OrderItem so the order stays
 *      accurate even if the product is edited/discontinued later.
 *   5. Create the Order with status PENDING — matching the "Pending" badge
 *      already shown in your admin's Recent Orders table.
 *   6. Empty the cart.
 * If any step fails, the whole checkout throws and nothing is created.
 * (Real atomicity — no partial orders, no stock silently vanishing — only
 * arrives once step 3-6 run inside an actual Postgres transaction; see
 * the $transaction note in db.ts.)
 */
export async function checkout(input: CheckoutInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== input.userId) {
    throw Object.assign(new Error('UNAUTHENTICATED'), { status: 401 })
  }

  const { data: result, error } = await supabase.rpc('checkout_cart', {
    p_shipping_address: input.shippingAddress,
    p_payment_method: input.paymentMethod,
    p_shipping_fee: input.shippingFee ?? 0,
    p_selected_item_ids: input.selectedCartItemIds ?? null,
  })

  if (error || !result) throw new Error(error?.message ?? 'Unable to create order.')
  return result.order
}

export async function attachPayMongoSession(orderId: string, sessionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('attach_paymongo_checkout_session', {
    p_order_id: orderId,
    p_session_id: sessionId,
  })

  if (error) throw new Error(error.message)
}
