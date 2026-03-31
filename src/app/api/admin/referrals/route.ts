import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { verifyAdminRequest } = await import('@/lib/verify-request');
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const referrals = await prisma.referral.findMany({
      include: {
        affiliate: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const partnerGroups = await prisma.partnerGroup.findMany();
    const partnerGroupMap = new Map(
      partnerGroups.map(pg => [pg.id, { name: pg.name, rate: pg.commissionRate }])
    );

    return NextResponse.json({
      success: true,
      referrals: referrals.map(referral => {
        const metadata = referral.metadata as any;
        const affiliate = referral.affiliate as any;
        const pgId = affiliate.partnerGroupId;
        const pgData = pgId ? partnerGroupMap.get(pgId) : null;

        return {
          id: referral.id,
          leadEmail: referral.leadEmail,
          leadName: referral.leadName,
          leadPhone: referral.leadPhone,
          status: referral.status,
          notes: referral.notes,
          createdAt: referral.createdAt,
          estimatedValue: Number(metadata?.estimated_value) || 0,
          company: metadata?.company || '',
          affiliate: {
            id: affiliate.id,
            name: affiliate.user.name,
            email: affiliate.user.email,
            referralCode: affiliate.referralCode,
            partnerGroup: pgData?.name || 'Default',
            partnerGroupId: pgId,
            commissionRate: pgData?.rate || 0.20
          }
        };
      })
    });
  } catch (error) {
    console.error('Admin referrals API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { verifyAdminRequest } = await import('@/lib/verify-request');
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { referralIds, action } = body;

    if (!referralIds || !Array.isArray(referralIds) || referralIds.length === 0) {
      return NextResponse.json(
        { error: 'Referral IDs array is required' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const updatedReferrals = await prisma.referral.updateMany({
      where: {
        id: { in: referralIds },
        status: 'PENDING'
      },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewedBy: auth.userId,
        reviewedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `${updatedReferrals.count} referrals ${action}d successfully`,
      updatedCount: updatedReferrals.count
    });
  } catch (error) {
    console.error('Batch referral API error:', error);
    return NextResponse.json(
      { error: 'Failed to process referrals' },
      { status: 500 }
    );
  }
}
