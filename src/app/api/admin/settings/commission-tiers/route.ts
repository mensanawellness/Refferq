import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminRequest } from "@/lib/verify-request";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const programSettings = await prisma.programSettings.findFirst();
    const partnerGroups = await prisma.partnerGroup.findMany({
      include: {
        _count: {
          select: { affiliates: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      program: {
        tierTwoCommissionRate: programSettings?.tierTwoCommissionRate ?? 0,
      },
      partnerGroups: partnerGroups.map((pg) => ({
        id: pg.id,
        name: pg.name,
        tierOneRate: pg.commissionRate,
        tierTwoRate: pg.tierTwoCommissionRate,
        affiliateCount: pg._count.affiliates,
        isDefault: pg.isDefault,
      })),
    });
  } catch (error) {
    console.error("Error fetching commission tier settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { programTierTwoRate, partnerGroupUpdates } = body;

    const results: {
      programUpdated: boolean;
      partnerGroupsUpdated: string[];
    } = {
      programUpdated: false,
      partnerGroupsUpdated: [],
    };

    if (programTierTwoRate !== undefined) {
      const rate = parseFloat(programTierTwoRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return NextResponse.json(
          { error: "programTierTwoRate must be between 0 and 100" },
          { status: 400 }
        );
      }

      await prisma.programSettings.updateMany({
        data: { tierTwoCommissionRate: rate },
      });
      results.programUpdated = true;
    }

    if (partnerGroupUpdates && Array.isArray(partnerGroupUpdates)) {
      for (const update of partnerGroupUpdates) {
        if (!update.id) continue;

        const rate =
          update.tierTwoRate === null
            ? null
            : parseFloat(update.tierTwoRate);

        if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
          return NextResponse.json(
            {
              error: `Invalid tierTwoRate for partner group ${update.id}: must be 0-100 or null`,
            },
            { status: 400 }
          );
        }

        await prisma.partnerGroup.update({
          where: { id: update.id },
          data: { tierTwoCommissionRate: rate },
        });

        results.partnerGroupsUpdated.push(update.id);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error updating commission tier settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
