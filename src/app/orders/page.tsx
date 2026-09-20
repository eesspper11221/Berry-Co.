import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrdersForUser } from '@/lib/data/storefront'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orders = await getOrdersForUser(user.id)
  const wasCancelled = (await searchParams).cancelled === '1'

  return (
    <main className="page-shell">
      <div className="page-container max-w-6xl">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Account</p>
          <h1 className="mt-2 text-4xl font-black text-dark">Order history</h1>
        </div>

        {wasCancelled && (
          <div className="mb-5 rounded-2xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700" role="status">
            Order cancelled successfully. It has been removed from your order history.
          </div>
        )}

        {orders.length === 0 ? (
          <div className="content-panel flex min-h-[18rem] items-center justify-center text-center">
            <div className="space-y-4">
              <p className="text-lg font-bold text-dark/70">You do not have any orders yet.</p>
              <Link href="/products" className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-black text-white hover:bg-brand-dark">
                Start shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-[2rem] border border-dark/10 bg-highlights p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-dark/50">{order.order_number}</p>
                    <p className="mt-2 text-xl font-black text-dark">
                      {new Date(order.created_at).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-dark/70">
                    <span className="rounded-full bg-cream px-3 py-1">Order Status: {order.status}</span>
                    <span className="rounded-full bg-cream px-3 py-1">Payment Status: {order.payment_status}</span>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-dark/50">Total</p>
                    <p className="text-2xl font-black text-dark">₱{Number(order.total_amount).toLocaleString('en-PH')}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2 border-t border-dark/10 pt-4">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-dark/50">Ordered items</p>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-dark/10 bg-paper px-3 py-2">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream text-[9px] font-black text-dark/50">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain" />
                        ) : (
                          'ITEM'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-dark">{item.product_name}</p>
                        <p className="text-xs font-semibold text-dark/60">Qty {item.quantity}</p>
                      </div>
                      <p className="text-sm font-black text-dark">₱{(item.price * item.quantity).toLocaleString('en-PH')}</p>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
