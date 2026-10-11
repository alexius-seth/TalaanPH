import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { OutboxEntry } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { batch: OutboxEntry[] };
    const batch = body?.batch ?? [];

    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ processedIds: [] });
    }

    const processedIds: string[] = [];

    await prisma.$transaction(async (tx: any) => {
      // 1. Gather existing processed IDs in one query
      const existingEvents = await tx.processedSyncEvent.findMany({
        where: { id: { in: batch.map((b) => b.id) } },
        select: { id: true },
      });
      const existingIdSet = new Set(existingEvents.map((e: { id: string }) => e.id));

      for (const entry of batch) {
        if (existingIdSet.has(entry.id)) {
          processedIds.push(entry.id);
          continue;
        }

        if (entry.action === 'CREATE_CUSTOMER') {
          const payload = entry.payload as {
            customer: {
              id: string;
              firstName: string;
              lastName: string;
              nickname: string;
              phoneNumber: string;
              creditLimit: number;
              isActive: boolean;
              createdAt: string;
              updatedAt: string;
            };
            account: {
              id: string;
              code: string;
              type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
              customerId: string;
              createdAt: string;
            };
          };

          await tx.customer.upsert({
            where: { id: payload.customer.id },
            update: {
              firstName: payload.customer.firstName,
              lastName: payload.customer.lastName,
              nickname: payload.customer.nickname,
              phoneNumber: payload.customer.phoneNumber,
              creditLimit: payload.customer.creditLimit,
              isActive: payload.customer.isActive,
            },
            create: {
              id: payload.customer.id,
              firstName: payload.customer.firstName,
              lastName: payload.customer.lastName,
              nickname: payload.customer.nickname,
              phoneNumber: payload.customer.phoneNumber,
              creditLimit: payload.customer.creditLimit,
              isActive: payload.customer.isActive,
              createdAt: new Date(payload.customer.createdAt),
              updatedAt: new Date(payload.customer.updatedAt),
            },
          });

          await tx.account.upsert({
            where: { code: payload.account.code },
            update: {},
            create: {
              id: payload.account.id,
              code: payload.account.code,
              type: payload.account.type,
              customerId: payload.account.customerId,
              createdAt: new Date(payload.account.createdAt),
            },
          });
        } else if (entry.action === 'RECORD_TRANSACTION') {
          const payload = entry.payload as {
            transaction: {
              id: string;
              referenceNumber: string;
              type: 'CREDIT_PURCHASE' | 'PAYMENT' | 'ADJUSTMENT';
              description?: string;
              dueDate?: string;
              createdAt: string;
            };
            entries: Array<{
              id: string;
              transactionId: string;
              accountId: string;
              amount: number;
              direction: 'DEBIT' | 'CREDIT';
              createdAt: string;
            }>;
            items?: Array<{
              id: string;
              transactionId: string;
              productId?: string;
              itemName: string;
              quantity: number;
              unitPrice: number;
              totalPrice: number;
            }>;
            reminder?: {
              id: string;
              customerId: string;
              transactionId: string;
              dueDate: string;
              status: 'PENDING' | 'SETTLED' | 'REMINDED';
              createdAt: string;
            };
          };

          // Double-entry validation on server boundary
          const totalDebit = payload.entries
            .filter((e) => e.direction === 'DEBIT')
            .reduce((sum, e) => sum + Number(e.amount), 0);
          const totalCredit = payload.entries
            .filter((e) => e.direction === 'CREDIT')
            .reduce((sum, e) => sum + Number(e.amount), 0);

          if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
            throw new Error(`Accounting imbalance for txn ${payload.transaction.id}: Debits !== Credits`);
          }

          // Create transaction
          await tx.transaction.create({
            data: {
              id: payload.transaction.id,
              referenceNumber: payload.transaction.referenceNumber,
              type: payload.transaction.type,
              description: payload.transaction.description,
              dueDate: payload.transaction.dueDate ? new Date(payload.transaction.dueDate) : undefined,
              createdAt: new Date(payload.transaction.createdAt),
            },
          });

          // Create ledger entries
          await tx.ledgerEntry.createMany({
            data: payload.entries.map((e) => ({
              id: e.id,
              transactionId: e.transactionId,
              accountId: e.accountId,
              amount: e.amount,
              direction: e.direction,
              createdAt: new Date(e.createdAt),
            })),
          });

          // Create items if present
          if (payload.items && payload.items.length > 0) {
            await tx.transactionItem.createMany({
              data: payload.items.map((item) => ({
                id: item.id,
                transactionId: item.transactionId,
                productId: item.productId,
                itemName: item.itemName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
            });
          }

          // Create reminder if present
          if (payload.reminder) {
            await tx.paymentReminder.upsert({
              where: { id: payload.reminder.id },
              update: {
                status: payload.reminder.status,
                dueDate: new Date(payload.reminder.dueDate),
              },
              create: {
                id: payload.reminder.id,
                customerId: payload.reminder.customerId,
                transactionId: payload.reminder.transactionId,
                dueDate: new Date(payload.reminder.dueDate),
                status: payload.reminder.status || 'PENDING',
                createdAt: new Date(payload.reminder.createdAt),
              },
            });
          }
        } else if (entry.action === 'CREATE_PRODUCT') {
          const payload = entry.payload as any;
          await tx.product.upsert({
            where: { id: payload.product.id },
            update: {
              name: payload.product.name,
              category: payload.product.category,
              baseUnit: payload.product.baseUnit,
              currentStock: payload.product.currentStock,
              lowStockThreshold: payload.product.lowStockThreshold,
              retailPrice: payload.product.retailPrice,
            },
            create: {
              id: payload.product.id,
              name: payload.product.name,
              category: payload.product.category,
              baseUnit: payload.product.baseUnit,
              currentStock: payload.product.currentStock,
              lowStockThreshold: payload.product.lowStockThreshold,
              costPerBaseUnit: payload.product.costPerBaseUnit ?? 0,
              retailPrice: payload.product.retailPrice,
              createdAt: new Date(payload.product.createdAt),
              updatedAt: new Date(payload.product.updatedAt),
            },
          });

          if (payload.packageUnits && payload.packageUnits.length > 0) {
            for (const pkg of payload.packageUnits) {
              await tx.productPackageUnit.upsert({
                where: { id: pkg.id },
                update: {
                  unitName: pkg.unitName,
                  multiplier: pkg.multiplier,
                  packageCost: pkg.packageCost,
                },
                create: {
                  id: pkg.id,
                  productId: pkg.productId,
                  unitName: pkg.unitName,
                  multiplier: pkg.multiplier,
                  packageCost: pkg.packageCost,
                },
              });
            }
          }
        } else if (entry.action === 'RESTOCK_PRODUCT') {
          const payload = entry.payload as any;
          await tx.product.update({
            where: { id: payload.productId },
            data: {
              currentStock: payload.newStock,
              updatedAt: new Date(payload.timestamp),
            },
          });
        } else if (entry.action === 'UPDATE_CUSTOMER') {
          const payload = entry.payload as {
            customerId: string;
            nickname: string;
            firstName: string;
            lastName: string;
            phoneNumber: string;
            creditLimit: number;
            updatedAt: string;
          };
          await tx.customer.update({
            where: { id: payload.customerId },
            data: {
              nickname: payload.nickname,
              firstName: payload.firstName,
              lastName: payload.lastName,
              phoneNumber: payload.phoneNumber,
              creditLimit: payload.creditLimit,
              updatedAt: new Date(payload.updatedAt),
            },
          });
        } else if (entry.action === 'ARCHIVE_CUSTOMER') {
          const payload = entry.payload as {
            customerId: string;
            updatedAt: string;
          };
          await tx.customer.update({
            where: { id: payload.customerId },
            data: {
              isActive: false,
              updatedAt: new Date(payload.updatedAt),
            },
          });
        }

        // Mark processed for idempotency
        await tx.processedSyncEvent.create({
          data: {
            id: entry.id,
            action: entry.action,
          },
        });

        processedIds.push(entry.id);
      }
    });

    return NextResponse.json({ success: true, processedIds });
  } catch (error: any) {
    console.error('[/api/sync/push] Ingestion error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Sync push failed' },
      { status: 500 }
    );
  }
}

