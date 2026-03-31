import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { verifyAdminRequest } = await import('@/lib/verify-request');
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const programs = await prisma.program.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, programs });
  } catch (error) {
    console.error('Admin programs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { verifyAdminRequest } = await import('@/lib/verify-request');
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { name, slug, description, commissionRate, commissionType, cookieDuration, currency, autoApprove, minPayoutCents, payoutFrequency, termsUrl, logoUrl, brandColor } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    const existing = await prisma.program.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
    }

    const program = await prisma.program.create({
      data: {
        name,
        slug: slug.toLowerCase(),
        description: description || null,
        commissionRate: commissionRate || 20,
        commissionType: commissionType || 'PERCENTAGE',
        cookieDuration: cookieDuration || 30,
        currency: currency || 'USD',
        autoApprove: autoApprove || false,
        minPayoutCents: minPayoutCents || 100,
        payoutFrequency: payoutFrequency || 'MONTHLY',
        termsUrl: termsUrl || null,
        logoUrl: logoUrl || null,
        brandColor: brandColor || '#10b981',
      },
    });

    return NextResponse.json({ success: true, program });
  } catch (error) {
    console.error('Admin programs POST error:', error);
    return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { verifyAdminRequest } = await import('@/lib/verify-request');
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Program ID required' }, { status: 400 });
    }

    const allowedFields = [
      'name', 'slug', 'description', 'commissionRate', 'commissionType',
      'cookieDuration', 'currency', 'isActive', 'autoApprove',
      'minPayoutCents', 'payoutFrequency', 'termsUrl', 'logoUrl', 'brandColor',
    ];
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body && body[key] !== undefined) updates[key] = body[key];
    }

    const program = await prisma.program.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, program });
  } catch (error) {
    console.error('Admin programs PUT error:', error);
    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { verifyAdminRequest } = await import('@/lib/verify-request');
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Program ID required' }, { status: 400 });
    }

    await prisma.program.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin programs DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  }
}
