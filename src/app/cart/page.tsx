'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  category?: string;
  price: number;
  originalPrice: number;
  quantity: number;
  image_url: string | null;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseCartItems = (items: any[]): CartItem[] => {
    return (items ?? []).map((item) => {
      const currentPrice = Number(item.unit_price_snapshot ?? 0);
      const origPrice = Number(item.original_price ?? item.product?.price ?? currentPrice);

      return {
        id: item.id,
        name: item.product?.name ?? 'Product unavailable',
        category: item.product?.category ?? '',
        price: currentPrice,
        originalPrice: origPrice,
        quantity: item.quantity,
        image_url: item.product?.image_url ?? null,
      };
    });
  };

  const loadCart = async () => {
    const response = await fetch('/api/cart');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to load your cart.');
    const nextCart = parseCartItems(data.items);
    setCart(nextCart);
    setSelectedItemIds((current) => current.filter((id) => nextCart.some((item) => item.id === id)));
    window.dispatchEvent(new CustomEvent('cart-updated'));
  };

  useEffect(() => {
    fetch('/api/cart')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Unable to load your cart.');
        return data;
      })
      .then((data) => {
        const nextCart = parseCartItems(data.items);
        setCart(nextCart);
        setSelectedItemIds(nextCart.map((item) => item.id));
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const updateQuantity = (itemId: string, delta: number) => {
    const item = cart.find((entry) => entry.id === itemId);
    if (!item) return;
    fetch(`/api/cart/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: Math.max(1, item.quantity + delta) }),
    })
      .then((response) => (response.ok ? loadCart() : response.json().then((data) => Promise.reject(new Error(data.error)))))
      .catch((updateError: Error) => setError(updateError.message));
  };

  const removeFromCart = (itemId: string) => {
    fetch(`/api/cart/${itemId}`, { method: 'DELETE' })
      .then((response) => (response.ok ? loadCart() : response.json().then((data) => Promise.reject(new Error(data.error)))))
      .catch((removeError: Error) => setError(removeError.message));
  };

  const selectedItems = cart.filter((item) => selectedItemIds.includes(item.id));
  const originalSubtotal = selectedItems.reduce<number>((acc, item) => acc + item.originalPrice * item.quantity, 0);
  const discountedSubtotal = selectedItems.reduce<number>((acc, item) => acc + item.price * item.quantity, 0);
  const totalSavings = originalSubtotal - discountedSubtotal;

  const shipping = discountedSubtotal > 0 ? 15 : 0;
  const total = discountedSubtotal + shipping;

  const checkoutHref = selectedItems.length > 0
    ? `/checkout?items=${selectedItemIds.join(',')}`
    : '#';

  return (
    <main className="max-w-7xl w-full mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-black text-dark">Your Shopping Cart</h1>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Cart Items Section */}
        <div className="flex-1 bg-highlights rounded-3xl p-6 shadow-sm border border-dark/10 w-full space-y-4">
          {loading ? (
            <p className="py-12 text-center text-sm font-semibold text-dark/60">Loading cart...</p>
          ) : error ? (
            <p className="py-12 text-center text-sm font-semibold text-brand">{error}</p>
          ) : cart.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-sm font-semibold text-dark/70">Your cart is empty.</p>
              <Link
                href="/products"
                className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-6 py-2.5 rounded-full text-xs transition shadow-sm"
              >
                Explore Products
              </Link>
            </div>
          ) : (
            cart.map((item) => {
              const isOnSale = item.originalPrice > item.price;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-[#F3E4C8]/50 border border-dark/10 rounded-2xl p-4 gap-4"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={() =>
                        setSelectedItemIds((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id]
                        )
                      }
                      aria-label={`Select ${item.name} for checkout`}
                      className="h-5 w-5 accent-brand"
                    />

                    <div className="w-16 h-16 bg-[#F3E4C8] rounded-xl flex items-center justify-center text-[10px] text-dark/60 font-bold overflow-hidden shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        'Image'
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-dark">{item.name}</h3>
                      {item.category && <p className="text-xs text-dark/70">{item.category}</p>}

                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={`font-extrabold text-sm ${isOnSale ? 'text-brand' : 'text-dark'}`}>
                          ₱{item.price.toFixed(2)}
                        </span>
                        {isOnSale && (
                          <span className="text-xs font-bold text-dark/40 line-through">
                            ₱{item.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-highlights border border-dark/20 rounded-full px-3 py-1 gap-3 text-xs font-bold">
                      <button onClick={() => updateQuantity(item.id, -1)} className="hover:text-brand">
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="hover:text-brand">
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs text-brand font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Order Summary Sidebar */}
        <aside className="w-full lg:w-80 bg-highlights rounded-3xl p-6 shadow-sm border border-dark/10 space-y-4">
          <h2 className="text-lg font-bold text-dark border-b border-dark/10 pb-2">
            Order Summary
          </h2>

          <div className="space-y-2 text-xs font-medium text-dark/80">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₱{originalSubtotal.toFixed(2)}</span>
            </div>

            {totalSavings > 0 && (
              <div className="flex justify-between text-brand font-bold">
                <span>Sale Savings</span>
                <span>-₱{totalSavings.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Estimated Shipping</span>
              <span>₱{shipping.toFixed(2)}</span>
            </div>

            <div className="flex justify-between font-bold text-sm text-dark pt-2 border-t border-dark/10">
              <span>Total</span>
              <span>₱{total.toFixed(2)}</span>
            </div>
          </div>

          <Link
            href={checkoutHref}
            className={`w-full block text-center font-bold py-3 rounded-full text-xs transition ${
              selectedItems.length > 0
                ? 'bg-brand hover:bg-brand-dark text-white shadow-sm'
                : 'bg-stone-300 text-stone-500 cursor-not-allowed'
            }`}
            aria-disabled={selectedItems.length === 0}
            onClick={(event) => {
              if (selectedItems.length === 0) event.preventDefault();
            }}
          >
            {selectedItems.length > 0
              ? `Checkout ${selectedItems.length} selected item${selectedItems.length === 1 ? '' : 's'}`
              : 'Select items to checkout'}
          </Link>
        </aside>
      </div>
    </main>
  );
}