import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGallery from "@/components/products/product-gallery";
import ProductAccordions from "@/components/products/product-accordion";
import ProductBuyBox from "@/components/products/product-buy-box";
import { getProductById } from "@/lib/data/data-products";
import { getProductReviews } from "@/lib/data/reviews";
import { isProductWishlisted } from "@/lib/wishlist-service";
import { getSession } from "@/lib/session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const session = await getSession();
  const reviews = await getProductReviews(product.id);
  const initialInWishlist = session ? await isProductWishlisted(session.userId, product.id) : false;

  const status = product.status === 'out_of_stock' ? 'Out of Stock' : 'In Stock';
  const productDescription =
    product.description?.trim() ||
    `${product.name} is part of the Berry Co. collection and brings premium detail, collectible quality, and standout design to fans and collectors alike.`;

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8 text-dark">
      <div className="mx-auto max-w-6xl">
        
        {/* Breadcrumb Hierarchy */}
        <div className="breadcrumbs mb-4 text-xs font-bold text-dark/60">
          <ul>
            <li>
              <Link href="/products" className="hover:text-brand transition-colors">
                Products
              </Link>
            </li>
            <li>
              <Link
                href={`/products?category=${encodeURIComponent(product.category_name ?? '')}`}
                className="hover:text-brand transition-colors"
              >
                {product.category_name ?? 'Uncategorized'}
              </Link>
            </li>
            <li>
              <Link
                href={`/products?category=${encodeURIComponent(product.subcategory_name ?? '')}`}
                className="hover:text-brand transition-colors"
              >
                {product.subcategory_name ?? 'Product'}
              </Link>
            </li>
            <li>
              <Link
                href={`/products?search=${encodeURIComponent(product.sku)}`}
                className="hover:text-brand transition-colors"
              >
                {product.sku}
              </Link>
            </li>
            <li className="font-black text-dark">
              {product.name}
            </li>
          </ul>
        </div>

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          
          {/* Gallery Section */}
          <div className="lg:col-span-8 lg:col-start-1 lg:row-start-1">
            <ProductGallery
              name={product.name}
              imageUrl={product.image_url}
              images={product.image_urls}
            />
          </div>

          {/* 🏷️ Sticky Buy Box Panel with Sale Props */}
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24">
            <ProductBuyBox
              productId={product.id}
              sku={product.sku}
              stock={product.stock}
              name={product.name}
              price={product.price}
              salePercentage={product.sale_percentage}
              status={status}
              tag={product.category_name ?? 'Berry Co.'}
              releaseDate={product.release_date}
              preorderPeriod={
                product.preorder_start_date && product.preorder_end_date
                  ? `${new Date(product.preorder_start_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })} – ${new Date(product.preorder_end_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}`
                  : product.preorder_period
              }
              initialInWishlist={initialInWishlist}
            />
          </div>

          {/* Accordions Card */}
          <div className="lg:col-span-8 lg:col-start-1 lg:row-start-2 rounded-4xl bg-[#F4ECE1] p-6 shadow-xs border border-dark/10">
            <ProductAccordions
              productId={product.id}
              canReview={Boolean(session)}
              reviews={reviews}
              description={productDescription}
              seriesName={product.series?.name ?? product.series_name}
              brandName={product.brand?.name ?? product.brand_name}
              categoryName={product.category?.name ?? product.category_name}
              specifications={product.specifications}
            />
          </div>

        </div>

      </div>
    </main>
  );
}