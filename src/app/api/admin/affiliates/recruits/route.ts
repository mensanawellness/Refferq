import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminRequest } from "@/lib/verify-request";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const affiliateId = searchParams.get("affiliateId");

    if (affiliateId) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
        include: {
          user: { select: { name: true, email: true, status: true } },
          referredByAffiliate: {
            include: {
              user: { select: { name: true, email: true } },
            },
          },
          recruits: {
            include: {
              user: { select: { name: true, email: true, status: true } },
              _count: {
                select: { conversions: true },
              },
            },
          },
        },
      });

      if (!affiliate) {
        return NextResponse.json(
          { error: "Affiliate not found" },
          { status: 404 }
        );
      }

      const tierTwoEarnings = await prisma.commission.aggregate({
        where: {
          affiliateId: affiliate.id,
          tier: "TIER_TWO",
        },
        _sum: { amountCents: true },
        _count: true,
      });

      const recruitEarnings = await Promise.all(
        affiliate.recruits.map(async (recruit) => {
          const earnings = await prisma.commission.aggregate({
            where: {
              affiliateId: affiliate.id,
              tier: "TIER_TWO",
              conversion: {
                affiliateId: recruit.id,
              },
            },
            _sum: { amountCents: true },
            _count: true,
          });

          return {
            recruitId: recruit.id,
            name: recruit.user.name,
            email: recruit.user.email,
            status: recruit.user.status,
            referralCode: recruit.referralCode,
            conversions: recruit._count.conversions,
            tierTwoEarned: {
              totalCents: earnings._sum.amountCents || 0,
              count: earnings._count,
            },
            joinedAt: recruit.createdAt,
          };
        })
      );

      return NextResponse.json({
        affiliate: {
          id: affiliate.id,
          name: affiliate.user.name,
          email: affiliate.user.email,
          referralCode: affiliate.referralCode,
          recruitedBy: affiliate.referredByAffiliate
            ? {
                id: affiliate.referredByAffiliate.id,
                name: affiliate.referredByAffiliate.user.name,
                email: affiliate.referredByAffiliate.user.email,
              }
            : null,
        },
        recruits: recruitEarnings,
        totalTierTwoEarnings: {
          totalCents: tierTwoEarnings._sum.amountCents || 0,
          count: tierTwoEarnings._count,
        },
      });
    }

    const recruiters = await prisma.affiliate.findMany({
      where: {
        recruits: {
          some: {},
        },
      },
      include: {
        user: { select: { name: true, email: true, status: true } },
        _count: {
          select: { recruits: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const recruitersWithEarnings = await Promise.all(
      recruiters.map(async (recruiter) => {
        const tierTwoEarnings = await prisma.commission.aggregate({
          where: {
            affiliateId: recruiter.id,
            tier: "TIER_TWO",
          },
          _sum: { amountCents: true },
          _count: true,
        });

        return {
          id: recruiter.id,
          name: recruiter.user.name,
          email: recruiter.user.email,
          status: recruiter.user.status,
          referralCode: recruiter.referralCode,
          recruitCount: recruiter._count.recruits,
          tierTwoEarnings: {
            totalCents: tierTwoEarnings._sum.amountCents || 0,
            count: tierTwoEarnings._count,
          },
        };
      })
    );

    return NextResponse.json({
      recruiters: recruitersWithEarnings,
      total: recruitersWithEarnings.length,
    });
  } catch (error) {
    console.error("Error fetching recruit data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
