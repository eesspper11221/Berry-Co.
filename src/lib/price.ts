export type PriceBreakdown = {
  basePrice: number
  finalPrice: number
  salePercentage: number
  hasSale: boolean
  formattedBasePrice: string
  formattedFinalPrice: string
  savedAmount: number
  formattedSavedAmount: string
}

/**
 * Precision-safe currency formatter for Philippine Peso (₱)
 */
export function formatPHP(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Computes raw numeric final price rounded safely to 2 decimal places
 */
export function calculateFinalPrice(
  price: number,
  salePercentage?: number | null
): number {
  if (!salePercentage || salePercentage <= 0) return price
  const discount = (price * salePercentage) / 100
  return Math.round((price - discount) * 100) / 100
}

/**
 * Master price calculator used by Storefront, Admin UI, and API routes
 */
export function getPriceBreakdown(
  price: number | string,
  salePercentage?: number | null
): PriceBreakdown {
  const numericPrice =
    typeof price === 'number'
      ? price
      : parseFloat(String(price).replace(/[^0-9.-]+/g, '')) || 0

  const validPercentage =
    salePercentage && salePercentage > 0 && salePercentage < 100
      ? salePercentage
      : 0

  const hasSale = validPercentage > 0
  const finalPrice = calculateFinalPrice(numericPrice, validPercentage)
  const savedAmount = Math.round((numericPrice - finalPrice) * 100) / 100

  return {
    basePrice: numericPrice,
    finalPrice,
    salePercentage: validPercentage,
    hasSale,
    formattedBasePrice: formatPHP(numericPrice),
    formattedFinalPrice: formatPHP(finalPrice),
    savedAmount,
    formattedSavedAmount: formatPHP(savedAmount),
  }
}