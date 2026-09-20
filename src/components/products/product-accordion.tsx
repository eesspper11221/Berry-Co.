"use client";

import { useState } from "react";
import ReviewForm from "./review-form";
import type { ProductReview } from "@/lib/data/reviews";

type AccordionsProps = {
  description?: string | null;
  seriesName?: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  specifications?: string | null;
  reviews?: ProductReview[];
  productId: string;
  canReview?: boolean;
};

export default function ProductAccordions({
  description,
  seriesName,
  brandName,
  categoryName,
  specifications,
  reviews = [],
  productId,
  canReview = false,
}: AccordionsProps) {
  // All accordion sections set to open by default
  const [openSections, setOpenSections] = useState({
    desc: true,
    specs: true,
    reviews: true,
  });

  const toggle = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const reviewsCount = reviews.length;
  const rating = reviewsCount
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviewsCount
    : 0;

  const specRows = [
    { label: "Series", value: seriesName },
    { label: "Specifications", value: specifications },
    { label: "Manufacturer", value: brandName },
    { label: "Category", value: categoryName },
  ].filter((row) => Boolean(row.value));

  return (
    <div className="w-full space-y-3 pt-2 text-left">
      {/* 1. Description */}
      <div className="w-full border-b border-dark/20 pb-3">
        <button
          type="button"
          onClick={() => toggle("desc")}
          className="flex w-full items-center justify-between py-2 text-left text-sm font-black uppercase text-dark cursor-pointer"
        >
          <span>Product Description</span>
          <span className="text-base font-bold">{openSections.desc ? "−" : "+"}</span>
        </button>
        {openSections.desc && (
          <div className="mt-2 w-full rounded-2xl bg-cream p-4 text-xs font-semibold text-dark/80 leading-relaxed wrap-break-word">
            {description ?? "Detailed product description goes here..."}
          </div>
        )}
      </div>

      {/* 2. Product Specifications */}
      <div className="w-full border-b border-dark/20 pb-3">
        <button
          type="button"
          onClick={() => toggle("specs")}
          className="flex w-full items-center justify-between py-2 text-left text-sm font-black uppercase text-dark cursor-pointer"
        >
          <span>Product Specifications</span>
          <span className="text-base font-bold">{openSections.specs ? "−" : "+"}</span>
        </button>
        {openSections.specs && (
          <div className="mt-2 w-full rounded-2xl bg-cream p-5 text-xs text-dark divide-y divide-dark/10 space-y-4">
            {specRows.length > 0 ? (
              specRows.map((row) => (
                <div key={row.label} className="pt-3 first:pt-0">
                  <p className="font-extrabold text-dark/60 text-[11px] uppercase tracking-wide">
                    {row.label}
                  </p>
                  <p className="font-bold text-dark mt-0.5 text-sm leading-relaxed whitespace-pre-line wrap-break-word">
                    {row.value}
                  </p>
                </div>
              ))
            ) : (
              <p className="italic text-dark/60">No detailed specifications available.</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Reviews */}
      <div className="w-full border-b border-dark/20 pb-3">
        <button
          type="button"
          onClick={() => toggle("reviews")}
          className="flex w-full items-center justify-between py-2 text-left text-sm font-black uppercase text-dark cursor-pointer"
        >
          <span>Reviews & Rating</span>
          <span className="text-base font-bold">{openSections.reviews ? "−" : "+"}</span>
        </button>
        {openSections.reviews && (
          <div className="mt-2 w-full rounded-2xl bg-cream p-4 text-xs font-semibold text-dark/80">
            <p className="font-extrabold text-brand">
              {reviewsCount ? `★ ${rating.toFixed(1)} / 5.0 (${reviewsCount} Reviews)` : 'No reviews yet'}
            </p>
            {reviews.length > 0 ? (
              <div className="mt-3 space-y-3">
                {reviews.map((review) => (
                  <article key={review.id} className="border-t border-dark/10 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-extrabold text-brand">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
                      <p className="text-[11px] text-dark/50">{review.reviewer_name}</p>
                    </div>
                    <p className="mt-1 text-dark/70 wrap-break-word">{review.comment}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-1 italic text-dark/70">Be the first to review this product.</p>
            )}
            {canReview ? (
              <ReviewForm productId={productId} />
            ) : (
              <p className="mt-4 border-t border-dark/10 pt-4 text-xs font-semibold text-dark/60">
                Sign in to share your review.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}