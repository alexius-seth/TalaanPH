import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatReminderText } from '@/sms';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // 1. Security Check: verify CRON_SECRET if set in environment
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

      let balance = 0;
      if (arAccount && arAccount.entries) {
        for (const entry of arAccount.entries) {
          balance += entry.direction === 'DEBIT' ? Number(entry.amount) : -Number(entry.amount);
        }
      }

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

      // Dispatch via Semaphore API if API key is configured
      if (semaphoreApiKey) {
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
    return NextResponse.json(
      { success: false, error: error.message || 'Cron execution failed' },
      { status: 500 }
    );
  }
}

