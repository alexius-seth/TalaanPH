import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPin } from '@/lib/hash';
import { createSessionToken, AUTH_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

    if (!pin) {
      return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
    }

    const hashedInput = hashPin(pin);

    // 1. Check PostgreSQL StoreSetting singleton (with safe fallback if DB uninitialized)
    let setting = null;
    try {
      setting = await prisma.storeSetting.findUnique({
        where: { id: 'default_store' },
      });
    } catch (dbErr) {
      console.warn('[/api/auth] Database lookup skipped or unavailable, using environment/default fallback:', dbErr);
    }

    let isValid = false;
    let storeName = 'Aking Tindahan';

    if (setting?.pinHash) {
      isValid = hashedInput === setting.pinHash;
      storeName = setting.storeName;
    } else {
      // 2. Fall back to process.env.STORE_PIN or '1234'
      const fallbackPin = process.env.STORE_PIN || '1234';
      isValid = pin === fallbackPin || hashedInput === hashPin(fallbackPin);
    }

    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid PIN' }, { status: 401 });
    }

    const token = createSessionToken();
    const response = NextResponse.json({
      success: true,
      storeName,
      token,
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('[/api/auth] Authentication error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}

