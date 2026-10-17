import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { attachPayMongoSession, checkout } from "@/lib/checkout-service";
import { createPayMongoCheckoutSession } from "@/lib/paymongo";

// POST /api/checkout  { shippingAddress, paymentMethod, shippingFee? }
// Requires login — guests get redirected to Login/Sign up first, same as
// the nav bar implies (Cart is guest-accessible, checkout is not).
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();

    if (!body.shippingAddress || !["card", "gcash", "cod"].includes(body.paymentMethod)) {
      return NextResponse.json({ error: "shippingAddress and paymentMethod are required" }, { status: 400 });
    }

    const paymentPlatform = body.paymentPlatform ?? "web";
    if (paymentPlatform !== "web" && paymentPlatform !== "app") {
      return NextResponse.json({ error: "paymentPlatform must be web or app." }, { status: 400 });
    }

    let successBaseUrl: string | undefined;
    let cancelBaseUrl: string | undefined;
    if (body.paymentMethod !== "cod") {
      if (!process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_test_")) {
        return NextResponse.json(
          { error: "PayMongo test mode is not configured with a test secret key." },
          { status: 503 }
        );
      }

      let returnUrl: URL;
      if (paymentPlatform === "app") {
        const appReturnUrl = process.env.PAYMONGO_APP_RETURN_URL;
        if (!appReturnUrl) {
          return NextResponse.json(
            { error: "PayMongo app return URL is not configured." },
            { status: 503 }
          );
        }
        try {
          returnUrl = new URL(appReturnUrl);
        } catch {
          return NextResponse.json(
            { error: "PAYMONGO_APP_RETURN_URL must be a valid HTTPS URL." },
            { status: 500 }
          );
        }
        if (returnUrl.protocol !== "https:") {
          return NextResponse.json(
            { error: "PAYMONGO_APP_RETURN_URL must use HTTPS." },
            { status: 500 }
          );
        }
      } else {
        const requestOrigin = req.headers.get("origin");
        const appOrigin = new URL(req.url).origin;
        const allowedOrigins = new Set<string>();
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
        const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;

        if (siteUrl) {
          try {
            const configuredUrl = new URL(siteUrl);
            if (
              configuredUrl.protocol !== "https:" &&
              (process.env.NODE_ENV === "production" || configuredUrl.protocol !== "http:")
            ) {
              throw new Error("Unsupported URL protocol.");
            }
            allowedOrigins.add(configuredUrl.origin);
          } catch {
            return NextResponse.json(
              { error: "NEXT_PUBLIC_SITE_URL must be a valid URL." },
              { status: 500 }
            );
          }
        }
        if (railwayDomain) {
          allowedOrigins.add(new URL(`https://${railwayDomain}`).origin);
        }
        if (process.env.NODE_ENV !== "production") {
          allowedOrigins.add(appOrigin);
        }

        if (requestOrigin) {
          let origin: URL;
          try {
            origin = new URL(requestOrigin);
          } catch {
            return NextResponse.json({ error: "Invalid request origin." }, { status: 400 });
          }
          if (!allowedOrigins.has(origin.origin)) {
            return NextResponse.json({ error: "Checkout must be started from this website." }, { status: 403 });
          }
          returnUrl = new URL("/", origin.origin);
        } else if (siteUrl) {
          returnUrl = new URL("/", siteUrl);
        } else if (railwayDomain) {
          returnUrl = new URL("/", `https://${railwayDomain}`);
        } else {
          returnUrl = new URL("/", appOrigin);
        }
        cancelBaseUrl = new URL("/orders", returnUrl.origin).toString();
      }
      successBaseUrl = returnUrl.toString();
      cancelBaseUrl ??= returnUrl.toString();
    }

    const order = await checkout({
      userId: session.userId,
      shippingAddress: body.shippingAddress,
      paymentMethod: body.paymentMethod,
      shippingFee: body.shippingFee,
      selectedCartItemIds: body.selectedCartItemIds,
    });

    if (body.paymentMethod !== "cod") {
      if (!successBaseUrl || !cancelBaseUrl) {
        throw new Error("PayMongo return URL was not configured.");
      }
      const successUrl = new URL(successBaseUrl);
      successUrl.searchParams.set("payment", "success");
      successUrl.searchParams.set("order", order.order_number);
      const cancelUrl = new URL(cancelBaseUrl);
      cancelUrl.searchParams.set("payment", "cancelled");
      cancelUrl.searchParams.set("order", order.order_number);

      const payMongoSession = await createPayMongoCheckoutSession({
        orderId: order.id,
        orderNumber: order.order_number,
        totalAmount: Number(order.total_amount),
        paymentMethod: body.paymentMethod,
        successUrl: successUrl.toString(),
        cancelUrl: cancelUrl.toString(),
      });
      await attachPayMongoSession(order.id, payMongoSession.id);

      return NextResponse.json({ order, checkoutUrl: payMongoSession.checkoutUrl }, { status: 201 });
    }

    // Order now shows up immediately in the admin dashboard's
    // "Recent Orders" table and increments Total Orders / Pending Orders.
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? "Checkout failed." }, { status: e.status ?? 500 });
  }
}
