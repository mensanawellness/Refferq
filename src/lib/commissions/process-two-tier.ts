import { prisma } from "@/lib/prisma";

interface ProcessConversionInput {
  affiliateId: string;
  conversionId: string;
  amountCents: number;
}

interface CommissionResult {
  tierOne: {
    id: string;
    affiliateId: string;
    amountCents: number;
    rate: number;
  };
  tierTwo: {
    id: string;
    affiliateId: string;
    amountCents: number;
    rate: number;
  } | null;
}

export async function processTwoTierCommission(
  input: ProcessConversionInput
): Promise<CommissionResult> {
  const { affiliateId, conversionId, amountCents } = input;

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: {
      user: true,
      partnerGroup: true,
      referredByAffiliate: {
        include: {
          user: true,
          partnerGroup: true,
        },
      },
    },
  });

  if (!affiliate) {
    throw new Error(`Affiliate not found: ${affiliateId}`);
  }

  const programSettings = await prisma.programSettings.findFirst();
  if (!programSettings) {
    throw new Error("Program settings not configured");
  }

  const effectiveTierOneRate = affiliate.partnerGroup?.commissionRate ?? 10;

  const tierOneAmountCents = Math.floor(
    amountCents * (effectiveTierOneRate / 100)
  );

  const tierOneCommission = await prisma.commission.create({
    data: {
      conversionId,
      affiliateId: affiliate.id,
      userId: affiliate.userId,
      amountCents: tierOneAmountCents,
      rate: effectiveTierOneRate,
      tier: "TIER_ONE",
      status: "PENDING",
    },
  });

  let tierTwoResult: CommissionResult["tierTwo"] = null;

  if (affiliate.referredByAffiliate) {
    const recruiter = affiliate.referredByAffiliate;

    const tierTwoRate =
      recruiter.partnerGroup?.tierTwoCommissionRate ??
      programSettings.tierTwoCommissionRate ??
      0;

    if (tierTwoRate > 0) {
      const tierTwoAmountCents = Math.floor(
        amountCents * (tierTwoRate / 100)
      );

      const tierTwoCommission = await prisma.commission.create({
        data: {
          conversionId,
          affiliateId: recruiter.id,
          userId: recruiter.userId,
          amountCents: tierTwoAmountCents,
          rate: tierTwoRate,
          tier: "TIER_TWO",
          status: "PENDING",
        },
      });

      tierTwoResult = {
        id: tierTwoCommission.id,
        affiliateId: recruiter.id,
        amountCents: tierTwoAmountCents,
        rate: tierTwoRate,
      };
    }
  }

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      balanceCents: { increment: tierOneAmountCents },
    },
  });

  if (tierTwoResult && affiliate.referredByAffiliate) {
    await prisma.affiliate.update({
      where: { id: affiliate.referredByAffiliate.id },
      data: {
        balanceCents: { increment: tierTwoResult.amountCents },
      },
    });
  }

  return {
    tierOne: {
      id: tierOneCommission.id,
      affiliateId: affiliate.id,
      amountCents: tierOneAmountCents,
      rate: effectiveTierOneRate,
    },
    tierTwo: tierTwoResult,
  };
}
