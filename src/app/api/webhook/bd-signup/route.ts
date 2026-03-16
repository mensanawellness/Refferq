import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/webhook/bd-signup - Receive Brilliant Directories signup webhooks
 * 
 * Handles both Paid and Free plan signups.
 * 
 * BD webhook field reference:
 * - Email, First Name, Last Name, Companyname
 * - User Id, Subscription Id, Subscription Name
 * - Amount Collected, Invoice Total (paid only)
 * - Formname: "whmcs_signup_paid" or "signup_free"
 * - Querystring (contains URL params like ?ref=CODE)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Log the full payload for debugging
    console.log('📥 BD Webhook received:', JSON.stringify(body, null, 2));

    // Detect signup type
    const formname = body['Formname'] || body['formname'] || '';
    const isPaidSignup = formname === 'whmcs_signup_paid' || formname === 'whmcs_signup_external';
    const isFreeSignup = formname === 'signup_free';
    
    console.log(`📋 Signup type: ${isPaidSignup ? 'PAID' : isFreeSignup ? 'FREE' : 'UNKNOWN'} (formname: ${formname})`);

    // Extract customer info using BD's field names (case variations handled)
    const customerEmail = body['Email'] || body['email'] || body['User Email'] || body['user_email'];
    const firstName = body['First Name'] || body['first_name'] || body['Firstname'] || '';
    const lastName = body['Last Name'] || body['last_name'] || '';
    const companyName = body['Companyname'] || body['companyname'] || body['Company'] || body['company'] || '';
    const customerName = companyName || `${firstName} ${lastName}`.trim() || 'Unknown';
    
    const planId = body['Subscription Id'] || body['subscription_id'] || body['Sid'];
    const planName = body['Subscription Name'] || body['subscription_name'];
    const userId = body['User Id'] || body['user_id'];
    
    // Amount only present for paid signups
    const amountCollected = isPaidSignup 
      ? (body['Amount Collected'] || body['amount_collected'] || body['Invoice Total'] || 0)
      : 0;
    
    // Parse referral code from Querystring (e.g., "ref=JENNIF-7328&other=value")
    const querystring = body['Querystring'] || body['querystring'] || '';
    let referralCode = null;
    
    if (querystring) {
      const params = new URLSearchParams(querystring);
      referralCode = params.get('ref') || params.get('referral') || params.get('affiliate');
    }
    
    // Also check for direct ref fields (in case BD passes it differently)
    if (!referralCode) {
      referralCode = body['Refcode'] || body['refcode'] || body['Ref Code'] || body['ref_code'] || body['ref'];
    }

    if (!referralCode) {
      console.log('⚠️ No referral code in BD webhook payload (Querystring or Refcode fields)');
      // Still return success so BD doesn't retry
      return NextResponse.json({
        success: true,
        message: 'Webhook received, no referral code present',
        tracked: false
      });
    }

    if (!customerEmail) {
      console.log('⚠️ No customer email in BD webhook payload');
      return NextResponse.json({
        success: true,
        message: 'Webhook received, no customer email present',
        tracked: false
      });
    }

    // Find affiliate by referral code
    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!affiliate) {
      console.log(`⚠️ Invalid referral code: ${referralCode}`);
      return NextResponse.json({
        success: true,
        message: 'Invalid referral code',
        tracked: false
      });
    }

    if (affiliate.user.status !== 'ACTIVE') {
      console.log(`⚠️ Affiliate not active: ${referralCode}`);
      return NextResponse.json({
        success: true,
        message: 'Affiliate is not active',
        tracked: false
      });
    }

    // Check if referral with this email already exists
    let referral = await prisma.referral.findFirst({
      where: {
        leadEmail: customerEmail.toLowerCase(),
        affiliateId: affiliate.id,
      },
    });

    // Create referral if doesn't exist
    if (!referral) {
      referral = await prisma.referral.create({
        data: {
          leadEmail: customerEmail.toLowerCase(),
          leadName: customerName,
          affiliateId: affiliate.id,
          status: 'APPROVED',
          metadata: {
            source: 'bd_webhook',
            bdUserId: userId,
            planId,
            planName,
          },
        },
      });
    } else if (referral.status === 'PENDING') {
      referral = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: 'APPROVED',
          metadata: {
            ...(referral.metadata as object),
            source: 'bd_webhook',
            bdUserId: userId,
            planId,
            planName,
          },
        },
      });
    }

    // Create conversion record
    // Convert amount to cents (BD sends as dollars with decimals)
    const amountCents = Math.round(parseFloat(amountCollected || 0) * 100);
    const eventType = isPaidSignup ? 'PAID_SIGNUP' : 'FREE_SIGNUP';

    const conversion = await prisma.conversion.create({
      data: {
        affiliateId: affiliate.id,
        referralId: referral.id,
        eventType,
        amountCents,
        currency: 'USD',
        status: 'PENDING',
        eventMetadata: {
          source: 'brilliant_directories',
          signupType: isPaidSignup ? 'paid' : 'free',
          formname,
          bdUserId: userId,
          planId,
          planName,
          customerEmail,
          customerName,
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log('✅ BD signup conversion tracked:', {
      conversionId: conversion.id,
      affiliateId: affiliate.id,
      referralId: referral.id,
      referralCode,
      customerEmail,
      amountCents,
    });

    return NextResponse.json({
      success: true,
      message: 'Conversion tracked successfully',
      tracked: true,
      conversion: {
        id: conversion.id,
        amount: amountCents / 100,
      },
      affiliate: {
        name: affiliate.user.name,
        code: affiliate.referralCode,
      },
    });

  } catch (error) {
    console.error('POST /api/webhook/bd-signup error:', error);
    // Return 200 so BD doesn't keep retrying
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
      tracked: false
    });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
