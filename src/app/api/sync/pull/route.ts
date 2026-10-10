import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    const sinceDate = sinceParam ? new Date(sinceParam) : new Date(0);

    const [customers, accounts, transactions, ledgerEntries, transactionItems] =
      await Promise.all([
        prisma.customer.findMany({
          where: { updatedAt: { gt: sinceDate } },
        }),
        prisma.account.findMany({
          where: { createdAt: { gt: sinceDate } },
        }),
        prisma.transaction.findMany({
          where: { createdAt: { gt: sinceDate } },
        }),
        prisma.ledgerEntry.findMany({
          where: { createdAt: { gt: sinceDate } },
        }),
        prisma.transactionItem.findMany({
          where: {
            transaction: {
              createdAt: { gt: sinceDate },
            },
          },
        }),
      ]);

    const formattedCustomers = customers.map((c) => ({
      ...c,
      creditLimit: Number(c.creditLimit),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    const formattedAccounts = accounts.map((a) => ({
      ...a,
      customerId: a.customerId ?? undefined,
      createdAt: a.createdAt.toISOString(),
    }));

    const formattedTransactions = transactions.map((t) => ({
      ...t,
      description: t.description ?? undefined,
      createdAt: t.createdAt.toISOString(),
    }));

    const formattedLedgerEntries = ledgerEntries.map((l) => ({
      ...l,
      amount: Number(l.amount),
      createdAt: l.createdAt.toISOString(),
    }));

    const formattedItems = transactionItems.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      customers: formattedCustomers,
      accounts: formattedAccounts,
      transactions: formattedTransactions,
      ledgerEntries: formattedLedgerEntries,
      transactionItems: formattedItems,
    });
  } catch (error: any) {
    console.error('[/api/sync/pull] Pull error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync pull failed' },
      { status: 500 }
    );
  }
}

