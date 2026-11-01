import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    const sinceDate = sinceParam ? new Date(sinceParam) : new Date(0);
    if (Number.isNaN(sinceDate.getTime())) {
      return NextResponse.json({ error: 'Invalid since parameter' }, { status: 400 });
    }
    // Snapshot BEFORE querying so rows committed mid-request are re-sent next pull, never lost.
    const snapshotAt = new Date();

    const [
      customers,
      accounts,
      transactions,
      ledgerEntries,
      transactionItems,
      paymentReminders,
      products,
      packageUnits,
      storeSettings,
    ] = await Promise.all([
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
      prisma.paymentReminder.findMany({
        where: { createdAt: { gt: sinceDate } },
      }),
      prisma.product.findMany({
        where: { updatedAt: { gt: sinceDate } },
      }),
      prisma.productPackageUnit.findMany(),
      prisma.storeSetting.findMany({
        where: { updatedAt: { gt: sinceDate } },
      }),
    ]);

    const formattedCustomers = customers.map((c: any) => ({
      ...c,
      creditLimit: Number(c.creditLimit),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    const formattedAccounts = accounts.map((a: any) => ({
      ...a,
      customerId: a.customerId ?? undefined,
      createdAt: a.createdAt.toISOString(),
    }));

    const formattedTransactions = transactions.map((t: any) => ({
      ...t,
      description: t.description ?? undefined,
      dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : undefined,
      createdAt: t.createdAt.toISOString(),
    }));

    const formattedLedgerEntries = ledgerEntries.map((l: any) => ({
      ...l,
      amount: Number(l.amount),
      createdAt: l.createdAt.toISOString(),
    }));

    const formattedItems = transactionItems.map((item: any) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    }));

    const formattedReminders = paymentReminders.map((r: any) => ({
      ...r,
      dueDate: r.dueDate.toISOString().split('T')[0],
      remindedAt: r.remindedAt ? r.remindedAt.toISOString() : undefined,
      createdAt: r.createdAt.toISOString(),
    }));

    const formattedProducts = products.map((p: any) => ({
      ...p,
      currentStock: Number(p.currentStock),
      lowStockThreshold: Number(p.lowStockThreshold),
      costPerBaseUnit: Number(p.costPerBaseUnit),
      retailPrice: Number(p.retailPrice),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    const formattedUnits = packageUnits.map((u: any) => ({
      ...u,
      multiplier: Number(u.multiplier),
      packageCost: Number(u.packageCost),
    }));

    const formattedStoreSettings = storeSettings.map((s: any) => ({
      id: s.id,
      storeName: s.storeName,
      pinHash: s.pinHash,
      updatedAt: s.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      timestamp: snapshotAt.toISOString(),
      customers: formattedCustomers,
      accounts: formattedAccounts,
      transactions: formattedTransactions,
      ledgerEntries: formattedLedgerEntries,
      transactionItems: formattedItems,
      paymentReminders: formattedReminders,
      products: formattedProducts,
      packageUnits: formattedUnits,
      storeSettings: formattedStoreSettings,
    });
  } catch (error: any) {
    console.error('[/api/sync/pull] Pull error:', error);
    return NextResponse.json({ error: 'Sync pull failed' }, { status: 500 });
  }
}
