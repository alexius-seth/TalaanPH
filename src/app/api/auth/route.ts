import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPin } from '@/lib/hash';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

    if (!pin) {
      return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
    }

    const hashedInput = hashPin(pin);

    // 1. Check PostgreSQL StoreSetting singleton
    const setting = await prisma.storeSetting.findUnique({
      where: { id: 'default_store' },
    });

    let isValid = false;
    let storeName = 'Talaan Store';

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

    return NextResponse.json({
      success: true,
      storeName,
    });
  } catch (error) {
    console.error('[/api/auth] Authentication error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}

