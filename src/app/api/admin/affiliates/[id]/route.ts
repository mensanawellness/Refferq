import { NextRequest, NextResponse } from 'next/server';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyAdminRequest } from '@/lib/verify-request';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: affiliate.userId },
      data: {
        status: status as UserStatus
      }
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.userId,
        action: 'UPDATE_AFFILIATE_STATUS',
        objectType: 'AFFILIATE',
        objectId: params.id,
        payload: {
          oldStatus: affiliate.user.status,
          newStatus: status,
          notes: notes || null,
          affiliateEmail: affiliate.user.email
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Affiliate status updated to ${status}`,
      affiliate: {
        id: affiliate.id,
        userId: updatedUser.id,
        status: updatedUser.status
      }
    });
  } catch (error) {
    console.error('Update affiliate status error:', error);
    return NextResponse.json(
      { error: 'Failed to update affiliate status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    await prisma.user.delete({
      where: { id: affiliate.userId }
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.userId,
        action: 'DELETE_AFFILIATE',
        objectType: 'AFFILIATE',
        objectId: params.id,
        payload: {
          affiliateName: affiliate.user.name,
          affiliateEmail: affiliate.user.email,
          referralCode: affiliate.referralCode
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Affiliate deleted successfully'
    });
  } catch (error) {
    console.error('Delete affiliate error:', error);
    return NextResponse.json(
      { error: 'Failed to delete affiliate' },
      { status: 500 }
    );
  }
}
