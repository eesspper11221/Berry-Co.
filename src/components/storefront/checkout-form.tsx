'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface CartItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price_snapshot: number
  price: number
  image_url: string | null
}

export default function CheckoutForm({
  cart,
  selectedCartItemIds,
  userEmail,
}: {
  cart: { items: CartItem[]; subtotal: number; itemCount: number; totalSavings?: number }
  selectedCartItemIds?: string[]
  userEmail: string
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    paymentMethod: 'card',
  })

  const subtotal = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.unit_price_snapshot) * item.quantity, 0),
    [cart.items]
  )

  const totalSavings = useMemo(
    () =>
      cart.items.reduce((sum, item) => {
        const originalPrice = Number(item.price ?? item.unit_price_snapshot)
        const effectivePrice = Number(item.unit_price_snapshot)
        const diff = Math.max(0, originalPrice - effectivePrice)
        return sum + diff * item.quantity
      }, 0),
    [cart.items]
  )

  const shipping = subtotal > 0 ? 120 : 0
  const total = subtotal + shipping

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        shippingAddress: {
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode,
          country: 'PH',
        },
        paymentMethod: form.paymentMethod,
        shippingFee: shipping,
        selectedCartItemIds,
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed.')
      }

      window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: 0 } }))
      window.dispatchEvent(new CustomEvent('orders-updated', { detail: { delta: 1 } }))
      router.push('/orders')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Checkout failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form onSubmit={handleSubmit} className="content-panel space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-dark/70">
            <span>Full name</span>
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              className="w-full rounded-2xl border border-dark/20 bg-paper px-4 py-3 text-sm font-bold text-dark outline-none transition focus:border-brand"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-dark/70">
            <span>Phone</span>
            <input
              required
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-2xl border border-dark/20 bg-paper px-4 py-3 text-sm font-bold text-dark outline-none transition focus:border-brand"
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm font-semibold text-dark/70">
          <span>Street address</span>
          <input
            required
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            className="w-full rounded-2xl border border-dark/20 bg-paper px-4 py-3 text-sm font-bold text-dark outline-none transition focus:border-brand"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold text-dark/70">
            <span>City</span>
            <input
              required
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              className="w-full rounded-2xl border border-dark/20 bg-paper px-4 py-3 text-sm font-bold text-dark outline-none transition focus:border-brand"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-dark/70">
            <span>Province</span>
            <input
              required
              value={form.province}
              onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))}
              className="w-full rounded-2xl border border-dark/20 bg-paper px-4 py-3 text-sm font-bold text-dark outline-none transition focus:border-brand"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-dark/70">
            <span>Postal code</span>
            <input
              required
              value={form.postalCode}
              onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))}
              className="w-full rounded-2xl border border-dark/20 bg-paper px-4 py-3 text-sm font-bold text-dark outline-none transition focus:border-brand"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-dark/10 bg-cream/40 p-4">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-dark/70">Payment</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {['card', 'gcash', 'cod'].map((method) => (
              <label key={method} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dark/15 bg-paper px-3 py-2 text-sm font-bold capitalize text-dark">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={form.paymentMethod === method}
                  onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                />
                {method}
              </label>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm font-semibold text-brand">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Processing...' : `Pay ₱${total.toLocaleString('en-PH')}`}
        </button>
      </form>

      <aside className="sidebar-panel gap-5">
        <div>
          <h2 className="text-xl font-black text-dark">Your order</h2>
          <p className="mt-1 text-sm font-semibold text-dark/60">{userEmail}</p>
        </div>

        <div className="space-y-3 border-t border-dark/10 pt-4">
          {cart.items.map((item) => {
            const hasSale = item.price > item.unit_price_snapshot
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-dark/10 bg-paper px-3 py-2">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-cream text-[10px] font-black text-dark/60">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    'ITEM'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-dark">{item.product_name}</p>
                  <p className="text-xs font-semibold text-dark/60">Qty {item.quantity}</p>
                </div>
                <div className="text-right">
                  {hasSale && (
                    <p className="text-xs font-semibold text-dark/40 line-through">
                      ₱{(item.price * item.quantity).toLocaleString('en-PH')}
                    </p>
                  )}
                  <p className="text-sm font-black text-dark">
                    ₱{(item.unit_price_snapshot * item.quantity).toLocaleString('en-PH')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-2 border-t border-dark/10 pt-4 text-sm font-semibold text-dark/70">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₱{subtotal.toLocaleString('en-PH')}</span>
          </div>

          {totalSavings > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Sale Savings</span>
              <span>-₱{totalSavings.toLocaleString('en-PH')}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Shipping</span>
            <span>₱{shipping.toLocaleString('en-PH')}</span>
          </div>

          <div className="flex justify-between border-t border-dark/10 pt-2 text-base font-black text-dark">
            <span>Total</span>
            <span>₱{total.toLocaleString('en-PH')}</span>
          </div>
        </div>
      </aside>
    </div>
  )
}