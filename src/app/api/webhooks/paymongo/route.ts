import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function verifyPayMongoSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const separator = part.indexOf('=')
      return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
    })
  )
  const timestamp = parts.t
  const testSignature = parts.te
  if (!timestamp || !testSignature || !/^[a-f\d]{64}$/i.test(testSignature)) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest()
  const received = Buffer.from(testSignature, 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'PayMongo webhook is not configured.' }, { status: 503 })
  }

  const signature = request.headers.get('paymongo-signature')
  const rawBody = await request.text()
  if (!signature || !verifyPayMongoSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid PayMongo webhook signature.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }

  if (!isObject(payload) || !isObject(payload.data)) {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }

  const event = payload.data
  if (event.type !== 'checkout_session.payment.paid') {
    return NextResponse.json({ received: true })
  }
  if (event.livemode !== false || !isObject(event.data)) {
    return NextResponse.json({ error: 'Only test-mode PayMongo payments are accepted.' }, { status: 400 })
  }

  const session = event.data
  if (typeof session.id !== 'string' || !isObject(session.attributes)) {
    return NextResponse.json({ error: 'Invalid checkout session in webhook.' }, { status: 400 })
  }

  const attributes = session.attributes
  const referenceNumber = attributes.reference_number
  const metadata = attributes.metadata
  const payments = attributes.payments
  if (
    typeof referenceNumber !== 'string' ||
    !isObject(metadata) ||
    typeof metadata.order_id !== 'string' ||
    !Array.isArray(payments)
  ) {
    return NextResponse.json({ error: 'Missing order or payment details in webhook.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, payment_method, payment_status, paymongo_checkout_session_id')
    .eq('id', metadata.order_id)
    .eq('order_number', referenceNumber)
    .eq('paymongo_checkout_session_id', session.id)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: 'Unable to verify the order.' }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ error: 'Order does not match the PayMongo session.' }, { status: 404 })
  }
  if (order.payment_status === 'paid') {
    return NextResponse.json({ received: true })
  }
  if (order.payment_status !== 'pending' || !['card', 'gcash'].includes(order.payment_method ?? '')) {
    return NextResponse.json({ error: 'Order is not awaiting a PayMongo payment.' }, { status: 409 })
  }

  const expectedAmount = Math.round(Number(order.total_amount) * 100)
  const hasMatchingPaidPayment = payments.some((payment: unknown) => {
    if (!isObject(payment) || !isObject(payment.attributes)) return false
    const paymentAttributes = payment.attributes
    return (
      paymentAttributes.status === 'paid' &&
      paymentAttributes.currency === 'PHP' &&
      paymentAttributes.amount === expectedAmount
    )
  })

  if (!hasMatchingPaidPayment) {
    return NextResponse.json({ error: 'Paid payment amount does not match the order.' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('payment_status', 'pending')

  if (updateError) {
    return NextResponse.json({ error: 'Unable to update order payment status.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
