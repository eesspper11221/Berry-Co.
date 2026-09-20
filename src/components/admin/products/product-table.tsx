'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { deleteProduct } from '@/lib/actions/action-products'
import { getPriceBreakdown } from '@/lib/price'
import type { ProductWithCategory } from '@/types/database'

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_stock: 'bg-red-50 text-red-700 border-red-200',
}

const statusLabels: Record<string, string> = {
  active: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
}

export default function ProductTable({
  products,
  page,
  pageSize,
  totalCount,
}: {
  products: ProductWithCategory[]
  page: number
  pageSize: number
  totalCount: number
}) {
  const [isPending, startTransition] = useTransition()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}" from your catalog? This can't be undone.`)) return
    startTransition(() => {
      deleteProduct(id)
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-400">
                  No products found.
                </td>
              </tr>
            )}
            {products.map((product) => {
              const {
                hasSale,
                formattedBasePrice,
                formattedFinalPrice,
                salePercentage,
              } = getPriceBreakdown(product.price, product.sale_percentage)

              return (
                <tr key={product.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-stone-100" />
                      )}
                      <div>
                        <p className="font-medium text-stone-900">{product.name}</p>
                        <p className="text-xs text-stone-400">{product.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {product.subcategory_name ?? product.category_name ?? '—'}
                  </td>

                  {/* 🏷️ Dynamic Price Cell */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {hasSale ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold text-stone-900">
                          {formattedFinalPrice}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-stone-400 line-through">
                            {formattedBasePrice}
                          </span>
                          <span className="rounded bg-red-50 border border-red-100 px-1 py-0.5 text-[10px] font-bold text-red-600">
                            -{salePercentage}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-stone-900 font-medium">
                        {formattedBasePrice}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-stone-900">{product.stock}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        statusStyles[product.status]
                      }`}
                    >
                      {statusLabels[product.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(product.id, product.name)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 border-t border-stone-200 p-3">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`?page=${p}`}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                p === page ? 'bg-[#d9483a] text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}