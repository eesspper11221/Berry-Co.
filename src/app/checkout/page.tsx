import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCustomerCart } from '@/lib/data/storefront'
import CheckoutForm from '@/components/storefront/checkout-form'

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const fullCart = await getCustomerCart(user.id)
  const selectedIds = (await searchParams).items?.split(',').filter(Boolean)
  
  // Filter selected items
  const items = selectedIds?.length
    ? fullCart.items.filter((item) => selectedIds.includes(item.id))
    : fullCart.items

  // Recalculate subtotal using effective discounted unit_price_snapshot
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price_snapshot) * item.quantity, 
    0
  )

  // Calculate total savings using item.price (original price) vs item.unit_price_snapshot (sale price)
  const totalSavings = items.reduce((sum, item) => {
    const originalPrice = Number(item.price ?? item.unit_price_snapshot)
    const effectivePrice = Number(item.unit_price_snapshot)
    const savingsPerUnit = Math.max(0, originalPrice - effectivePrice)
    return sum + savingsPerUnit * item.quantity
  }, 0)

  const selectedCart = {
    ...fullCart,
    items,
    subtotal,
    totalSavings,
    itemCount: items.length,
  }

  return (
    <main className="page-shell">
      <div className="page-container max-w-6xl">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Checkout</p>
          <h1 className="mt-2 text-4xl font-black text-dark">Complete your order</h1>
        </div>

        {selectedCart.itemCount === 0 ? (
          <div className="content-panel flex min-h-88 items-center justify-center text-center">
            <div className="space-y-5">
              <p className="text-sm font-semibold text-dark/70">Your cart is empty.</p>
              <Link href="/products" className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-black text-white hover:bg-brand-dark">
                Explore products
              </Link>
            </div>
          </div>
        ) : (
          <CheckoutForm
            cart={selectedCart}
            selectedCartItemIds={selectedIds}
            userEmail={user.email ?? 'customer@berryco.test'}
          />
        )}
      </div>
    </main>
  )
}