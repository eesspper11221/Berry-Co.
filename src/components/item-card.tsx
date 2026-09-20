import Link from "next/link";
import { getPriceBreakdown } from "@/lib/price";

export interface Item {
  id?: string | number;
  company?: string;
  name?: string;
  description?: string;
  shortDescription?: string;
  price?: string | number;
  salePercentage?: number | null;
  sale_percentage?: number | null;
  imageUrl?: string;
  href?: string;
  tags?: string[];
  category?: string;
  status?: string;
}

export interface ItemCardProps {
  item: Item;
  className?: string;
}

export default function ItemCard({ item, className = "" }: ItemCardProps) {
  const {
    id,
    company,
    name = "Item Name",
    shortDescription,
    price = 0,
    imageUrl,
    href,
    tags = [],
    status,
  } = item;

  // Handles both camelCase and snake_case props from database queries
  const activeSalePercentage = item.salePercentage ?? item.sale_percentage;

  // 🏷️ Dynamic Price Calculation
  const {
    hasSale,
    formattedBasePrice,
    formattedFinalPrice,
    salePercentage: discountPercent,
  } = getPriceBreakdown(price, activeSalePercentage);

  const safeName = name?.trim() || "Item Name";
  const cardText = shortDescription?.trim();
  const targetHref = href ?? (id !== undefined ? `/products/${id}` : undefined);
  
  const isOutOfStock = status === "out_of_stock";

  const content = (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-dark/15 bg-paper shadow-xs transition-all duration-200 ${
        targetHref ? "hover:-translate-y-1 hover:shadow-md cursor-pointer" : ""
      } ${className}`.trim()}
    >
      {/* Main Image Wrapper */}
      <div className="relative flex h-52 w-full shrink-0 items-center justify-center bg-cream text-xs font-bold text-dark/30 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          "Image Placeholder"
        )}

        {/* Tags Overlay */}
        {tags.length > 0 && (
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1.5 pointer-events-none">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-black text-white shadow-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 🏷️ Top-Right Sale Tag Overlay */}
        {hasSale && !isOutOfStock && (
          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-black text-white shadow-xs">
              -{discountPercent}%
            </span>
          </div>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <span className="rounded-full bg-brand px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Item Info Wrapper */}
      <div className="flex flex-1 flex-col justify-between p-3 text-xs font-semibold text-dark">
        {/* Top Content: Company, Title, Teaser */}
        <div className="space-y-1">
          {company && <p className="font-bold text-dark/80">{company}</p>}
          <p className="line-clamp-2 text-sm font-black leading-snug text-dark group-hover:text-brand transition-colors">
            {safeName}
          </p>

          {cardText && (
            <p className="line-clamp-2 text-[11px] font-semibold leading-relaxed text-dark/70">
              {cardText}
            </p>
          )}
        </div>

        {/* 🏷️ Bottom Content: Dynamic Price Rendering */}
        <div className="mt-3 pt-1">
          {hasSale ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-brand">
                {formattedFinalPrice}
              </span>
              <span className="text-xs font-bold text-dark/40 line-through">
                {formattedBasePrice}
              </span>
            </div>
          ) : (
            <span className="text-sm font-extrabold text-brand">
              {formattedBasePrice}
            </span>
          )}
        </div>
      </div>
    </article>
  );

  if (targetHref) {
    return (
      <Link href={targetHref} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}