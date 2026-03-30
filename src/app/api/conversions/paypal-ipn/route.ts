import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processTwoTierCommission } from "@/lib/commissions/process-two-tier";

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);

    const verifyUrl = process.env.PAYPAL_SANDBOX === "true"
      ? "https://ipnpb.sandbox.paypal.com/cgi-bin/webscr"
      : "https://ipnpb.paypal.com/cgi-bin/webscr";

    const verifyBody = `cmd=_notify-validate&${text}`;
    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody,
    });

    const verifyResult = await verifyResponse.text();
    if (verifyResult !== "VERIFIED") {
      console.error("PayPal IPN verification failed:", verifyResult);
      return NextResponse.json({ error: "IPN not verified" }, { status: 400 });
    }

    const txnId = params.get("txn_id");
    const paymentStatus = params.get("payment_status");
    const payerEmail = params.get("payer_email");
    const mcGross = params.get("mc_gross");
    const mcCurrency = params.get("mc_currency") || "USD";
    const txnType = params.get("txn_type");
    const customField = params.get("custom");

    if (paymentStatus !== "Completed") {
      return NextResponse.json({ message: "Ignoring non-completed payment" }, { status: 200 });
    }

    const relevantTypes = ["subscr_payment", "web_accept", "recurring_payment"];
    if (txnType && !relevantTypes.includes(txnType)) {
      return NextResponse.json({ message: "Ignoring txn type: " + txnType }, { status: 200 });
    }

    if (!txnId || !mcGross || !payerEmail) {
      return NextResponse.json({ error: "Missing required IPN fields" }, { status: 400 });
    }

    const existingConversion = await prisma.conversion.findFirst({
      where: {
        eventMetadata: {
          path: ["transaction_id"],
          equals: txnId,
        },
      },
    });

    if (existingConversion) {
      return NextResponse.json({ message: "Already processed" }, { status: 200 });
    }

    let affiliateId: string | null = null;

    if (customField) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { referralCode: customField },
      });
      if (affiliate) {
        affiliateId = affiliate.id;
      }
    }

    if (!affiliateId) {
      const previousConversion = await prisma.conversion.findFirst({
        where: {
          eventMetadata: {
            path: ["customer_email"],
            equals: payerEmail,
          },
        },
        orderBy: { createdAt: "asc" },
      });

      if (previousConversion) {
        affiliateId = previousConversion.affiliateId;
      }
    }

    if (!affiliateId) {
      return NextResponse.json(
        { message: "No affiliate attribution found for this customer" },
        { status: 200 }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: { user: true },
    });

    if (!affiliate || affiliate.user.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Affiliated user is not active" },
        { status: 200 }
      );
    }

    const amountCents = Math.round(parseFloat(mcGross) * 100);

    const conversion = await prisma.conversion.create({
      data: {
        affiliateId,
        eventType: "PURCHASE",
        amountCents,
        currency: mcCurrency,
        status: "APPROVED",
        eventMetadata: {
          transaction_id: txnId,
          customer_email: payerEmail,
          txn_type: txnType || "unknown",
          source: "paypal_ipn",
          payment_status: paymentStatus,
        },
      },
    });

    const commissionResult = await processTwoTierCommission({
      affiliateId,
      conversionId: conversion.id,
      amountCents,
    });

    console.log(
      `PayPal IPN processed: txn=${txnId}, affiliate=${affiliateId}, ` +
      `t1=$${commissionResult.tierOne.amountCents / 100}, ` +
      `t2=${commissionResult.tierTwo ? "$" + commissionResult.tierTwo.amountCents / 100 : "none"}`
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("PayPal IPN error:", error);
    return NextResponse.json({ error: "Processing error" }, { status: 200 });
  }
}
