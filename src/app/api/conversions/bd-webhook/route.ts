import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processTwoTierCommission } from "@/lib/commissions/process-two-tier";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      ref,
      amount,
      currency = "USD",
      transaction_id,
      customer_email,
      customer_name,
      plan_name,
      event_type = "signup",
      secret,
    } = body;

    const expectedSecret = process.env.BD_WEBHOOK_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!ref || !amount || !transaction_id || !customer_email) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["ref", "amount", "transaction_id", "customer_email"],
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const existingConversion = await prisma.conversion.findFirst({
      where: {
        eventMetadata: {
          path: ["transaction_id"],
          equals: transaction_id,
        },
      },
    });

    if (existingConversion) {
      return NextResponse.json(
        { message: "Transaction already processed", conversionId: existingConversion.id },
        { status: 200, headers: corsHeaders }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode: ref },
      include: { user: true },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: "Affiliate not found for ref code", ref },
        { status: 404, headers: corsHeaders }
      );
    }

    if (affiliate.user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Affiliate is not active" },
        { status: 403, headers: corsHeaders }
      );
    }

    const amountCents = Math.round(parseFloat(amount) * 100);

    const conversionType = event_type === "renewal" ? "PURCHASE" : "SIGNUP";

    const conversion = await prisma.conversion.create({
      data: {
        affiliateId: affiliate.id,
        eventType: conversionType,
        amountCents,
        currency,
        status: "APPROVED",
        eventMetadata: {
          transaction_id,
          customer_email,
          customer_name: customer_name || "",
          plan_name: plan_name || "",
          event_type,
          source: "brilliant_directories",
        },
      },
    });

    const commissionResult = await processTwoTierCommission({
      affiliateId: affiliate.id,
      conversionId: conversion.id,
      amountCents,
    });

    return NextResponse.json(
      {
        success: true,
        conversionId: conversion.id,
        commissions: {
          tierOne: {
            affiliateId: commissionResult.tierOne.affiliateId,
            amount: commissionResult.tierOne.amountCents / 100,
            rate: commissionResult.tierOne.rate,
          },
          tierTwo: commissionResult.tierTwo
            ? {
                affiliateId: commissionResult.tierTwo.affiliateId,
                amount: commissionResult.tierTwo.amountCents / 100,
                rate: commissionResult.tierTwo.rate,
              }
            : null,
        },
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("BD webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
