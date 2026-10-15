type PayMongoCheckoutInput = {
  orderId: string
  orderNumber: string
  totalAmount: number
  paymentMethod: 'card' | 'gcash'
  successUrl: string
  cancelUrl: string
}

type PayMongoCheckoutResponse = {
  data?: {
    id?: string
    attributes?: {
      checkout_url?: string
    }
  }
  errors?: Array<{ detail?: string }>
}

export async function createPayMongoCheckoutSession(input: PayMongoCheckoutInput) {
  const secretKey = process.env.PAYMONGO_SECRET_KEY
  if (!secretKey?.startsWith('sk_test_')) {
    throw new Error('PayMongo test mode is not configured. Set PAYMONGO_SECRET_KEY to a test secret key.')
  }

  const amount = Math.round(input.totalAmount * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('The order total is invalid for PayMongo checkout.')
  }

  const response = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: `Berry & Co order ${input.orderNumber}`,
              amount,
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: [input.paymentMethod],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: input.orderNumber,
          metadata: { order_id: input.orderId },
        },
      },
    }),
  })

  const result = (await response.json()) as PayMongoCheckoutResponse
  if (!response.ok) {
    const detail = result.errors?.map((error) => error.detail).filter(Boolean).join(' ')
    throw Object.assign(
      new Error(detail || `PayMongo could not create the test checkout (HTTP ${response.status}).`),
      { status: 502 }
    )
  }

  const sessionId = result.data?.id
  const checkoutUrl = result.data?.attributes?.checkout_url
  if (!sessionId || !checkoutUrl) {
    throw new Error('PayMongo returned an incomplete checkout session.')
  }

  return { id: sessionId, checkoutUrl }
}
