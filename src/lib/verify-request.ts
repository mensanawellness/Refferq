// src/lib/auth/verify-request.ts
//
// Single source of truth for authenticating API requests.
// Every API route should use this instead of reading x-user-id from headers.
//
// Usage:
//   import { verifyRequest } from '@/lib/auth/verify-request';
//
//   export async function GET(request: NextRequest) {
//     const auth = await verifyRequest(request);
//     if (!auth.success) return auth.response;
//     const { userId, role } = auth;
//     // ... your route logic
//   }

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

type AuthSuccess = {
  success: true;
  userId: string;
  role: string;
};

type AuthFailure = {
  success: false;
  response: NextResponse;
};

type AuthResult = AuthSuccess | AuthFailure;

export async function verifyRequest(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const role = payload.role as string;

    if (!userId) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        ),
      };
    }

    return { success: true, userId, role };
  } catch (error) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Convenience: verifyRequest + require ADMIN role
 */
export async function verifyAdminRequest(
  request: NextRequest
): Promise<AuthResult> {
  const auth = await verifyRequest(request);
  if (!auth.success) return auth;

  if (auth.role !== "ADMIN") {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      ),
    };
  }

  return auth;
}
