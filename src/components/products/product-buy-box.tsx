"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getPriceBreakdown } from "@/lib/price";

type BuyBoxProps = {
  productId: string;
  sku?: string;
  stock?: number;
  name: string;
  price: number | string;
  salePercentage?: number | null;
  status: "In Stock" | "Pre-orders Open" | "Out of Stock" | "Sold Out" | string;
  tag?: string;
  preorderPeriod?: string;
  initialInWishlist?: boolean;
};

export default function ProductBuyBox({
  productId,
  sku,
  stock,
  name,
  price,
  salePercentage,
  status,
  preorderPeriod,
  initialInWishlist = false,
}: BuyBoxProps) {
  const router = useRouter();
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wishlistUpdating, setWishlistUpdating] = useState(false);

  // 🏷️ Dynamic Price Breakdown Calculation
  const {
    hasSale,
    formattedBasePrice,
    formattedFinalPrice,
    salePercentage: discountPercent,
  } = getPriceBreakdown(price, salePercentage);

  const handleCartClick = async () => {
    if (isOutOfStock) return;

    setError(null);
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    const data = await response.json();
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (!response.ok) {
      setError(data.error ?? 'Unable to add this item to your cart.');
      return;
    }
    setAdded(true);
    window.dispatchEvent(new CustomEvent('cart-updated'));
    setTimeout(() => setAdded(false), 2000);
  };

  const handleWishlistToggle = async () => {
    if (wishlistUpdating) return;

    setError(null);
    setWishlistUpdating(true);

    try {
      const response = inWishlist
        ? await fetch(`/api/wishlist/${productId}`, { method: 'DELETE' })
        : await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          });
      const data = await response.json();

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        setError(data.error ?? 'Unable to update your wishlist.');
        return;
      }

      const wasInWishlist = inWishlist;
      setInWishlist(!wasInWishlist);
      window.dispatchEvent(new CustomEvent('wishlist-updated', {
        detail: { delta: wasInWishlist ? -1 : 1 },
      }));
    } catch {
      setError('Unable to reach the wishlist service. Please try again.');
    } finally {
      setWishlistUpdating(false);
    }
  };

  // Status Helper Flags
  const isOutOfStock =
    status.toLowerCase().includes("out of stock") ||
    status.toLowerCase().includes("sold out");

  const isPreOrder = status.toLowerCase().includes("pre-order");

  // Status Text Color Formatting
  const getStatusColor = () => {
    if (isOutOfStock) return "text-red-600";
    if (isPreOrder) return "text-brand";
    return "text-emerald-700";
  };

  return (
    <div className="rounded-4xl bg-[#F4ECE1] p-6 shadow-xs border border-dark/10 space-y-5">
      
      {/* SKU & Product Title */}
      <div className="text-right">
        {sku && (
          <p className="text-[11px] font-black uppercase tracking-wider text-dark/40 mb-1">
            SKU: {sku}
          </p>
        )}
        <h1 className="text-3xl font-black leading-tight tracking-tight text-dark sm:text-4xl">{name}</h1>
      </div>

      {/* 🏷️ Price, Status & Stock Breakdown */}
      <div className="text-right space-y-1">
        {hasSale ? (
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 text-[11px] font-black text-brand">
                -{discountPercent}% OFF
              </span>
              <span className="text-sm font-bold text-dark/40 line-through">
                {formattedBasePrice}
              </span>
            </div>
            <p className="text-3xl font-black text-brand">
              {formattedFinalPrice}
            </p>
          </div>
        ) : (
          <p className="text-2xl font-black text-dark">{formattedBasePrice}</p>
        )}

        <p className={`text-xs font-bold ${getStatusColor()}`}>
          {status}
        </p>
        {typeof stock === "number" && (
          <p className="text-[11px] font-semibold text-dark/50">
            {stock > 0 ? `${stock} unit(s) available` : "0 units in stock"}
          </p>
        )}
      </div>

      {/* 📅 Pre-order Period Banner */}
      {isPreOrder && preorderPeriod && (
        <div className="rounded-2xl bg-cream p-3 text-center text-xs text-dark/80 border border-dark/5">
          <p className="font-extrabold uppercase text-[10px] tracking-wider text-dark/60">
            Pre-order Period
          </p>
          <p className="text-[11px] font-bold text-dark mt-0.5">
            {preorderPeriod}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-1">
        
        {/* Cart Button */}
        <button
          type="button"
          disabled={isOutOfStock}
          onClick={handleCartClick}
          className={`w-full rounded-full border py-3 text-xs font-extrabold transition-all shadow-xs ${
            isOutOfStock
              ? "border-dark/10 bg-dark/10 text-dark/40 cursor-not-allowed"
              : "border-dark/30 bg-cream text-dark hover:bg-dark hover:text-white active:scale-95 cursor-pointer"
          }`}
        >
          {isOutOfStock
            ? "Out of Stock"
            : added
            ? "Added to Cart! ✓"
            : "Add to Cart"}
        </button>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          disabled={wishlistUpdating}
          className={`w-full rounded-full border border-dark/30 py-3 text-xs font-extrabold transition-all active:scale-95 shadow-xs ${
            inWishlist
              ? "bg-brand text-white border-brand"
              : "bg-cream text-dark hover:bg-dark hover:text-white"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {wishlistUpdating
            ? "Updating..."
            : inWishlist
            ? "Remove from Wishlist"
            : isOutOfStock
            ? "Notify Me When Restocked 🔔"
            : "Add to Wishlist"}
        </button>
      </div>

      {error && <p className="text-right text-xs font-bold text-brand">{error}</p>}

    </div>
  );
}