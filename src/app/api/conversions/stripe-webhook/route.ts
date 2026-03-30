import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processTwoTierCommission } from "@/lib/commissions/process-two-tier";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 }
      );
    }

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Stripe signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    if (event.type !== "invoice.payment_succeeded") {
      return NextResponse.json(
        { message: "Ignoring event type: " + event.type },
        { status: 200 }
      );
    }

    const invoice = event.data.object;
    const customerEmail = invoice.customer_email;
    const amountPaid = invoice.amount_paid;
    const invoiceId = invoice.id;
    const currency = (invoice.currency || "usd").toUpperCase();

    if (!customerEmail || !amountPaid || amountPaid === 0) {
      return NextResponse.json(
        { message: "Ignoring zero amount or missing email" },
        { status: 200 }
      );
    }

    const existingConversion = await prisma.conversion.findFirst({
      where: {
        eventMetadata: {
          path: ["transaction_id"],
          equals: invoiceId,
        },
      },
    });

    if (existingConversion) {
      return NextResponse.json(
        { message: "Already processed" },
        { status: 200 }
      );
    }

    const previousConversion = await prisma.conversion.findFirst({
      where: {
        eventMetadata: {
          path: ["customer_email"],
          equals: customerEmail,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!previousConversion) {
      return NextResponse.json(
        { message: "No affiliate attribution found for this customer" },
        { status: 200 }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: previousConversion.affiliateId },
      include: { user: true },
    });

    if (!affiliate || affiliate.user.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Affiliated user is not active" },
        { status: 200 }
      );
    }

    const conversion = await prisma.conversion.create({
      data: {
        affiliateId: affiliate.id,
        eventType: "PURCHASE",
        amountCents: amountPaid,
        currency,
        status: "APPROVED",
        eventMetadata: {
          transaction_id: invoiceId,
          customer_email: customerEmail,
          stripe_customer_id: invoice.customer || "",
          source: "stripe_webhook",
          event_type: "renewal",
        },
      },
    });

    const commissionResult = await processTwoTierCommission({
      affiliateId: affiliate.id,
      conversionId: conversion.id,
      amountCents: amountPaid,
    });

    console.log(
      `Stripe renewal processed: invoice=${invoiceId}, affiliate=${affiliate.id}, ` +
      `t1=$${commissionResult.tierOne.amountCents / 100}, ` +
      `t2=${commissionResult.tierTwo ? "$" + commissionResult.tierTwo.amountCents / 100 : "none"}`
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 200 }
    );
  }
}
