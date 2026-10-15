This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment variables

Create `.env.local` for local development with values from Supabase Project
Settings → API:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
PAYMONGO_SECRET_KEY=sk_test_your_test_secret_key
PAYMONGO_WEBHOOK_SECRET=your_test_webhook_signing_secret
# Optional: HTTPS Universal/App Link handled by your mobile app
PAYMONGO_APP_RETURN_URL=https://your-domain.example/payment-return
```

For Railway, add these variables in the service's Variables tab, change
`NEXT_PUBLIC_SITE_URL` to the Railway public URL, save them, and redeploy.
`.env.local` is intentionally ignored by GitHub and is not deployed.

PayMongo checkout is intentionally restricted to test secret keys (`sk_test_`)
and uses PayMongo's hosted checkout for card and GCash payments. The public key
is not needed for this server-created checkout flow. In the PayMongo test
dashboard, configure a webhook for `checkout_session.payment.paid` pointing to
`/api/webhooks/paymongo`, then set its signing secret as
`PAYMONGO_WEBHOOK_SECRET`. For local testing, expose the local webhook endpoint
through a trusted HTTPS tunnel and use that public URL in the test dashboard.
Apply `supabase/migrations/014_paymongo_checkout.sql` to your Supabase project
before using checkout.

Website checkouts return to the same origin that initiated checkout and then
open the home page after payment; cancelling returns to `/orders`. A separate
mobile client using `/api/checkout` must send
`paymentPlatform: "app"` and configure `PAYMONGO_APP_RETURN_URL` to an HTTPS
Universal/App Link registered by that app. The app must handle the `payment`
and `order` query parameters. This repository contains the website backend,
not the mobile app that registers and handles that link.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
