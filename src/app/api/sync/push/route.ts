import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isSessionAuthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Tx = Prisma.TransactionClient;

const MAX_BATCH = 100;
const MAX_BODY_BYTES = 2_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_ACCOUNTS = [
  { code: 'REVENUE:SALES', type: 'REVENUE' },
  { code: 'ASSET:CASH', type: 'ASSET' },
  { code: 'EXPENSE:ADJUSTMENT', type: 'EXPENSE' },
] as const;

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
const TXN_TYPES = ['CREDIT_PURCHASE', 'PAYMENT', 'ADJUSTMENT'] as const;
const DIRECTIONS = ['DEBIT', 'CREDIT'] as const;
const REMINDER_STATUSES = ['PENDING', 'SETTLED', 'REMINDED'] as const;

// Topological order: parents before dependents so foreign keys never fail.
// UPDATE_STORE_SETTINGS -> CREATE_CUSTOMER -> UPDATE_CUSTOMER -> CREATE_PRODUCT -> UPDATE_PRODUCT
//   -> RECORD_TRANSACTION / RESTOCK_PRODUCT (+ embedded PaymentReminder) -> ARCHIVE_CUSTOMER / ARCHIVE_PRODUCT
const ACTION_PRIORITY: Record<string, number> = {
  UPDATE_STORE_SETTINGS: 1,
  CREATE_CUSTOMER: 2,
  UPDATE_CUSTOMER: 3,
  CREATE_PRODUCT: 4,
  UPDATE_PRODUCT: 5,
  RECORD_TRANSACTION: 6,
  RESTOCK_PRODUCT: 6,
  ARCHIVE_CUSTOMER: 7,
  ARCHIVE_PRODUCT: 7,
};

// ---------- Input validation (trust boundary) ----------
function bad(field: string): never {
  throw new Error(`Invalid payload: ${field}`);
}
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const obj = (v: unknown, f: string) => (isObj(v) ? v : bad(f));
const uuid = (v: unknown, f: string) => (typeof v === 'string' && UUID_RE.test(v) ? v : bad(f));
const str = (v: unknown, f: string, max = 200) =>
  typeof v === 'string' && v.length <= max ? v : bad(f);
const optStr = (v: unknown, f: string, max = 500) =>
  v === undefined || v === null ? undefined : str(v, f, max);
const num = (v: unknown, f: string, min = 0) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v < 1e9 ? v : bad(f);
const oneOf = <T extends string>(v: unknown, list: readonly T[], f: string): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : bad(f);
const date = (v: unknown, f: string) => {
  const d = typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : bad(f);
};
const arr = (v: unknown, f: string, max: number) =>
  Array.isArray(v) && v.length <= max ? v : bad(f);

const toCents = (n: number) => Math.round((n + Number.EPSILON) * 100);

// ---------- Handlers (each runs inside its own DB transaction) ----------
async function createCustomer(tx: Tx, p: Record<string, unknown>) {
  const c = obj(p.customer, 'customer');
  const a = obj(p.account, 'account');
  const customerId = uuid(c.id, 'customer.id');
  if (uuid(a.customerId, 'account.customerId') !== customerId) bad('account.customerId mismatch');

  const data = {
    firstName: str(c.firstName, 'customer.firstName'),
    lastName: str(c.lastName, 'customer.lastName'),
    nickname: str(c.nickname, 'customer.nickname'),
    phoneNumber: str(c.phoneNumber, 'customer.phoneNumber', 32),
    creditLimit: num(c.creditLimit, 'customer.creditLimit'),
    isActive: c.isActive !== false,
  };

  await tx.customer.upsert({
    where: { id: customerId },
    update: data,
    create: {
      id: customerId,
      ...data,
      createdAt: date(c.createdAt, 'customer.createdAt'),
      updatedAt: date(c.updatedAt, 'customer.updatedAt'),
    },
  });

  // Keeps the client-supplied account UUID so client and server IDs match.
  await tx.account.upsert({
    where: { code: str(a.code, 'account.code') },
    update: { customerId },
    create: {
      id: uuid(a.id, 'account.id'),
      code: str(a.code, 'account.code'),
      type: oneOf(a.type, ACCOUNT_TYPES, 'account.type'),
      customerId,
      createdAt: date(a.createdAt, 'account.createdAt'),
    },
  });
}

async function updateCustomer(tx: Tx, p: Record<string, unknown>) {
  await tx.customer.update({
    where: { id: uuid(p.customerId, 'customerId') },
    data: {
      nickname: str(p.nickname, 'nickname'),
      firstName: str(p.firstName, 'firstName'),
      lastName: str(p.lastName, 'lastName'),
      phoneNumber: str(p.phoneNumber, 'phoneNumber', 32),
      creditLimit: num(p.creditLimit, 'creditLimit'),
      updatedAt: date(p.updatedAt, 'updatedAt'),
    },
  });
}

async function archiveCustomer(tx: Tx, p: Record<string, unknown>) {
  await tx.customer.update({
    where: { id: uuid(p.customerId, 'customerId') },
    data: { isActive: false, updatedAt: date(p.updatedAt, 'updatedAt') },
  });
}

async function createProduct(tx: Tx, p: Record<string, unknown>) {
  const pr = obj(p.product, 'product');
  const id = uuid(pr.id, 'product.id');
  const common = {
    name: str(pr.name, 'product.name'),
    category: str(pr.category, 'product.category'),
    baseUnit: str(pr.baseUnit, 'product.baseUnit', 50),
    lowStockThreshold: num(pr.lowStockThreshold, 'product.lowStockThreshold'),
    retailPrice: num(pr.retailPrice, 'product.retailPrice'),
    isActive: pr.isActive !== false,
  };

  await tx.product.upsert({
    where: { id },
    // Stock is intentionally NOT overwritten on update: RESTOCK/RECORD_TRANSACTION own it.
    update: common,
    create: {
      id,
      ...common,
      currentStock: num(pr.currentStock, 'product.currentStock'),
      costPerBaseUnit: num(pr.costPerBaseUnit ?? 0, 'product.costPerBaseUnit'),
      createdAt: date(pr.createdAt, 'product.createdAt'),
      updatedAt: date(pr.updatedAt, 'product.updatedAt'),
    },
  });

  for (const raw of arr(p.packageUnits ?? [], 'packageUnits', 20)) {
    const u = obj(raw, 'packageUnit');
    const fields = {
      unitName: str(u.unitName, 'packageUnit.unitName', 100),
      multiplier: num(u.multiplier, 'packageUnit.multiplier', 0.01),
      packageCost: num(u.packageCost, 'packageUnit.packageCost'),
    };
    await tx.productPackageUnit.upsert({
      where: { id: uuid(u.id, 'packageUnit.id') },
      update: fields,
      create: { id: uuid(u.id, 'packageUnit.id'), productId: id, ...fields },
    });
  }
}

async function restockProduct(tx: Tx, p: Record<string, unknown>) {
  // Atomic increment (commutative) instead of overwriting with a client-computed absolute value.
  await tx.product.update({
    where: { id: uuid(p.productId, 'productId') },
    data: { currentStock: { increment: num(p.addedStock, 'addedStock') } },
  });
}

async function resolveAccountId(
  tx: Tx,
  accountId: string,
  txnType: (typeof TXN_TYPES)[number],
  direction: (typeof DIRECTIONS)[number],
  customerId: string | undefined
): Promise<string> {
  const byId = await tx.account.findUnique({ where: { id: accountId }, select: { id: true } });
  if (byId) return byId.id;

  // Double-entry pattern: AR is debited on credit purchases, credited otherwise.
  const isAr =
    (txnType === 'CREDIT_PURCHASE' && direction === 'DEBIT') ||
    (txnType !== 'CREDIT_PURCHASE' && direction === 'CREDIT');

  let code: string;
  let type: (typeof ACCOUNT_TYPES)[number] = 'ASSET';
  if (isAr) {
    if (!customerId) bad('customerId required to resolve AR account');
    code = `ASSET:AR:${customerId}`;
  } else if (txnType === 'CREDIT_PURCHASE') {
    code = 'REVENUE:SALES';
    type = 'REVENUE';
  } else if (txnType === 'PAYMENT') {
    code = 'ASSET:CASH';
  } else {
    code = 'EXPENSE:ADJUSTMENT';
    type = 'EXPENSE';
  }

  const byCode = await tx.account.findUnique({ where: { code }, select: { id: true } });
  if (byCode) return byCode.id;

  if (isAr) {
    // Customer must already be synced (CREATE_CUSTOMER sorts first); otherwise retry later.
    const cust = await tx.customer.findUnique({ where: { id: customerId! }, select: { id: true } });
    if (!cust) bad(`customer ${customerId} not synced yet`);
  }
  const created = await tx.account.create({
    data: { id: accountId, code, type, customerId: isAr ? customerId : undefined },
  });
  return created.id;
}

async function recordTransaction(tx: Tx, p: Record<string, unknown>) {
  const t = obj(p.transaction, 'transaction');
  const txnId = uuid(t.id, 'transaction.id');
  const txnType = oneOf(t.type, TXN_TYPES, 'transaction.type');
  const customerId =
    p.customerId !== undefined
      ? uuid(p.customerId, 'customerId')
      : isObj(p.reminder)
      ? uuid(p.reminder.customerId, 'reminder.customerId')
      : undefined;

  // Idempotency: an already-ingested ledger transaction is immutable; never rewrite it.
  if (await tx.transaction.findUnique({ where: { id: txnId }, select: { id: true } })) return;

  const rawEntries = arr(p.entries, 'entries', 10).map((e) => obj(e, 'entry'));
  if (rawEntries.length < 2) bad('entries must contain at least 2 lines');

  const entries = rawEntries.map((e) => ({
    id: uuid(e.id, 'entry.id'),
    accountId: uuid(e.accountId, 'entry.accountId'),
    amount: num(e.amount, 'entry.amount', 0.01),
    direction: oneOf(e.direction, DIRECTIONS, 'entry.direction'),
    createdAt: date(e.createdAt, 'entry.createdAt'),
  }));

  // Double-entry invariant in integer cents: sum(debits) - sum(credits) === 0
  const net = entries.reduce(
    (sum, e) => sum + (e.direction === 'DEBIT' ? toCents(e.amount) : -toCents(e.amount)),
    0
  );
  if (net !== 0) bad(`accounting imbalance for txn ${txnId}`);

  await tx.transaction.create({
    data: {
      id: txnId,
      referenceNumber: str(t.referenceNumber, 'transaction.referenceNumber', 100),
      type: txnType,
      description: optStr(t.description, 'transaction.description'),
      dueDate: t.dueDate ? date(t.dueDate, 'transaction.dueDate') : undefined,
      createdAt: date(t.createdAt, 'transaction.createdAt'),
    },
  });

  const resolved = [];
  for (const e of entries) {
    resolved.push({
      id: e.id,
      transactionId: txnId,
      accountId: await resolveAccountId(tx, e.accountId, txnType, e.direction, customerId),
      amount: e.amount,
      direction: e.direction,
      createdAt: e.createdAt,
    });
  }
  await tx.ledgerEntry.createMany({ data: resolved });

  const items = arr(p.items ?? [], 'items', 100).map((raw) => {
    const i = obj(raw, 'item');
    return {
      id: uuid(i.id, 'item.id'),
      transactionId: txnId,
      productId: i.productId ? uuid(i.productId, 'item.productId') : undefined,
      itemName: str(i.itemName, 'item.itemName'),
      quantity: num(i.quantity, 'item.quantity', 0.01),
      unitPrice: num(i.unitPrice, 'item.unitPrice'),
      totalPrice: num(i.totalPrice, 'item.totalPrice'),
    };
  });

  if (items.length > 0) {
    await tx.transactionItem.createMany({ data: items });
    // Atomic, non-negative stock deduction (runs once thanks to the processed-event guard).
    for (const it of items) {
      if (!it.productId) continue;
      const done = await tx.product.updateMany({
        where: { id: it.productId, currentStock: { gte: it.quantity } },
        data: { currentStock: { decrement: it.quantity } },
      });
      if (done.count === 0) {
        await tx.product.updateMany({ where: { id: it.productId }, data: { currentStock: 0 } });
      }
    }
  }

  if (isObj(p.reminder)) {
    const r = p.reminder;
    const reminderCustomerId = uuid(r.customerId, 'reminder.customerId');
    const customerExists = await tx.customer.findUnique({
      where: { id: reminderCustomerId },
      select: { id: true },
    });
    if (!customerExists) {
      console.warn(`[Sync Push] Skipping PaymentReminder: Customer ${reminderCustomerId} not found.`);
    } else {
      const status = oneOf(r.status ?? 'PENDING', REMINDER_STATUSES, 'reminder.status');
      await tx.paymentReminder.upsert({
        where: { id: uuid(r.id, 'reminder.id') },
        update: { status, dueDate: date(r.dueDate, 'reminder.dueDate') },
        create: {
          id: uuid(r.id, 'reminder.id'),
          customerId: reminderCustomerId,
          transactionId: txnId,
          dueDate: date(r.dueDate, 'reminder.dueDate'),
          status,
          createdAt: date(r.createdAt, 'reminder.createdAt'),
        },
      });
    }
  }
}

async function updateStoreSettings(tx: Tx, p: Record<string, unknown>) {
  const s = obj(p.settings, 'settings');
  const storeName = str(s.storeName, 'settings.storeName', 100);
  const pinHash = str(s.pinHash, 'settings.pinHash', 128);
  const updatedAt = s.updatedAt ? date(s.updatedAt, 'settings.updatedAt') : new Date();

  await tx.storeSetting.upsert({
    where: { id: 'default_store' },
    update: {
      storeName,
      pinHash,
      updatedAt,
    },
    create: {
      id: 'default_store',
      storeName,
      pinHash,
      updatedAt,
    },
  });
}

async function archiveProduct(tx: Tx, p: Record<string, unknown>) {
  const productId = uuid(p.productId, 'productId');
  await tx.product.update({
    where: { id: productId },
    data: {
      isActive: false,
      updatedAt: p.updatedAt ? date(p.updatedAt, 'updatedAt') : new Date(),
    },
  });
}

const HANDLERS: Record<string, (tx: Tx, p: Record<string, unknown>) => Promise<void>> = {
  UPDATE_STORE_SETTINGS: updateStoreSettings,
  CREATE_CUSTOMER: createCustomer,
  UPDATE_CUSTOMER: updateCustomer,
  ARCHIVE_CUSTOMER: archiveCustomer,
  CREATE_PRODUCT: createProduct,
  RESTOCK_PRODUCT: restockProduct,
  ARCHIVE_PRODUCT: archiveProduct,
  RECORD_TRANSACTION: recordTransaction,
};

function safeMessage(err: unknown): string {
  if (err instanceof Error && err.message.startsWith('Invalid payload:')) return err.message;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return `Database error (${err.code})`;
  return 'Processing failed';
}

export async function POST(req: Request) {
  try {
    if (!isSessionAuthorized(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized session' }, { status: 401 });
    }

    const declaredLength = Number(req.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const rawBatch = isObj(body) ? body.batch : undefined;
    if (!Array.isArray(rawBatch)) {
      return NextResponse.json({ success: false, error: 'batch must be an array' }, { status: 400 });
    }
    if (rawBatch.length === 0) return NextResponse.json({ success: true, processedIds: [] });
    if (rawBatch.length > MAX_BATCH) {
      return NextResponse.json({ success: false, error: `batch exceeds ${MAX_BATCH}` }, { status: 413 });
    }

    const processedIds: string[] = [];
    const errors: Record<string, string> = {};

    // Validate envelope; sort topologically (priority, then client timestamp).
    const batch: Array<{ id: string; action: string; payload: Record<string, unknown>; timestamp: number }> = [];
    for (const raw of rawBatch) {
      if (!isObj(raw) || typeof raw.id !== 'string' || !UUID_RE.test(raw.id)) continue;
      if (typeof raw.action !== 'string' || !HANDLERS[raw.action] || !isObj(raw.payload)) {
        errors[raw.id] = 'Invalid payload: unsupported action or payload';
        continue;
      }
      batch.push({
        id: raw.id,
        action: raw.action,
        payload: raw.payload,
        timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : 0,
      });
    }
    batch.sort(
      (a, b) =>
        (ACTION_PRIORITY[a.action] ?? 99) - (ACTION_PRIORITY[b.action] ?? 99) ||
        a.timestamp - b.timestamp
    );

    // Seed core system accounts in a single idempotent statement.
    await prisma.account.createMany({
      data: SYSTEM_ACCOUNTS.map((a) => ({ id: randomUUID(), code: a.code, type: a.type })),
      skipDuplicates: true,
    });

    // One transaction per entry: a poison entry cannot roll back the rest of the batch,
    // and short transactions stay well under serverless / Neon timeouts.
    for (const entry of batch) {
      try {
        await prisma.$transaction(
          async (tx) => {
            const seen = await tx.processedSyncEvent.findUnique({
              where: { id: entry.id },
              select: { id: true },
            });
            if (seen) return;
            await HANDLERS[entry.action](tx, entry.payload);
            await tx.processedSyncEvent.create({ data: { id: entry.id, action: entry.action } });
          },
          { maxWait: 10_000, timeout: 20_000 }
        );
        processedIds.push(entry.id);
      } catch (err) {
        // A concurrent duplicate push may have committed first: that is success, not failure.
        const done = await prisma.processedSyncEvent.findUnique({
          where: { id: entry.id },
          select: { id: true },
        });
        if (done) {
          processedIds.push(entry.id);
          continue;
        }
        console.error(`[/api/sync/push] Entry ${entry.id} (${entry.action}) failed:`, err);
        errors[entry.id] = safeMessage(err);
      }
    }

    return NextResponse.json({ success: Object.keys(errors).length === 0, processedIds, errors });
  } catch (error) {
    console.error('[/api/sync/push] Ingestion error:', error);
    return NextResponse.json({ success: false, error: 'Sync push failed' }, { status: 500 });
  }
}
