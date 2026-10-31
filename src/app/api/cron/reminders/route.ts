import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { formatReminderText } from '@/sms';

export const dynamic = 'force-dynamic';

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed in production: a missing secret must never open the endpoint.
  if (!cronSecret) return process.env.NODE_ENV !== 'production';
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const received = Buffer.from(req.headers.get('authorization') ?? '');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(req: Request) {
  try {
    // 1. Security Check: enforce CRON_SECRET bearer token (Vercel Cron sends it automatically)
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const semaphoreApiKey = process.env.SEMAPHORE_API_KEY;
    const storeName = process.env.STORE_NAME || 'Talaan Store';
    const today = new Date();

    // 2. Query due reminders where status is PENDING and dueDate <= today
    const dueReminders = await prisma.paymentReminder.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lte: today },
      },
      include: {
        customer: {
          include: {
            accounts: {
              include: {
                entries: true,
              },
            },
          },
        },
      },
    });

    const results: Array<{ id: string; phone: string; status: string; error?: string }> = [];

    for (const rem of dueReminders) {
      // Calculate dynamic customer balance from AR account
      const arAccount = rem.customer.accounts.find((a: any) =>
        a.code.startsWith('ASSET:AR:')
      );

      let balanceCents = 0;
      if (arAccount && arAccount.entries) {
        for (const entry of arAccount.entries) {
          const cents = Math.round((Number(entry.amount) + Number.EPSILON) * 100);
          balanceCents += entry.direction === 'DEBIT' ? cents : -cents;
        }
      }
      const balance = balanceCents / 100;

      // If already settled, mark settled and continue
      if (balance <= 0) {
        await prisma.paymentReminder.update({
          where: { id: rem.id },
          data: { status: 'SETTLED' },
        });
        results.push({ id: rem.id, phone: rem.customer.phoneNumber, status: 'SETTLED' });
        continue;
      }

      const formattedDueDate = rem.dueDate.toISOString().split('T')[0];
      const message = formatReminderText({
        storeName,
        nickname: rem.customer.nickname,
        balance,
        dueDate: formattedDueDate,
      });

      // Never mark REMINDED unless an SMS was really dispatched.
      if (!semaphoreApiKey) {
        results.push({
          id: rem.id,
          phone: rem.customer.phoneNumber,
          status: 'SKIPPED',
          error: 'SEMAPHORE_API_KEY not configured',
        });
        continue;
      }

      // Dispatch via Semaphore API
      {
        try {
          const semResponse = await fetch('https://api.semaphore.co/api/v4/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apikey: semaphoreApiKey,
              number: rem.customer.phoneNumber,
              message,
              sendername: process.env.SEMAPHORE_SENDER_NAME || 'SEMAPHORE',
            }),
          });

          if (!semResponse.ok) {
            const errBody = await semResponse.text();
            throw new Error(`Semaphore API returned ${semResponse.status}: ${errBody}`);
          }
        } catch (apiErr: any) {
          console.error(`[Cron SMS] Failed to send to ${rem.customer.phoneNumber}:`, apiErr);
          results.push({
            id: rem.id,
            phone: rem.customer.phoneNumber,
            status: 'FAILED',
            error: apiErr.message,
          });
          continue;
        }
      }

      // Mark reminder as REMINDED
      await prisma.paymentReminder.update({
        where: { id: rem.id },
        data: {
          status: 'REMINDED',
          remindedAt: new Date(),
        },
      });

      results.push({ id: rem.id, phone: rem.customer.phoneNumber, status: 'REMINDED' });
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[/api/cron/reminders] Cron job failure:', error);
    return NextResponse.json({ success: false, error: 'Cron execution failed' }, { status: 500 });
  }
}

