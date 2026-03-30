import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminRequest } from '@/lib/verify-request';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const affiliates = await prisma.affiliate.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            referrals: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const { getCurrencySymbol } = await import('@/lib/currency');
    const currencySymbol = await getCurrencySymbol();

    return NextResponse.json({
      success: true,
      affiliates,
      currencySymbol,
    });
  } catch (error) {
    console.error('Get affiliates API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();

    const { success, data, error: validationError } = await import('@/lib/validations').then(m => m.affiliateCreateSchema.safeParse(body));

    if (!success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.issues },
        { status: 400 }
      );
    }

    const { name, email, password } = data;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    const crypto = await import('crypto');
    const userPassword = password || `AF${crypto.randomBytes(12).toString('base64url')}`;

    const hashedPassword = await (await import('bcryptjs')).hash(userPassword, 12);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role: 'AFFILIATE',
        status: 'ACTIVE',
        password: hashedPassword
      }
    });

    const affiliate = await prisma.affiliate.create({
      data: {
        userId: newUser.id,
        referralCode: `AF${Date.now()}${(await import('crypto')).randomBytes(3).toString('hex').toUpperCase().slice(0, 4)}`,
        balanceCents: 0,
        payoutDetails: {}
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Affiliate created successfully',
      affiliate: {
        id: affiliate.id,
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        referralCode: affiliate.referralCode,
        balanceCents: affiliate.balanceCents,
        createdAt: affiliate.createdAt
      },
      temporaryPassword: userPassword
    });
  } catch (error) {
    console.error('Create affiliate API error:', error);
    return NextResponse.json(
      { error: 'Failed to create affiliate' },
      { status: 500 }
    );
  }
}
