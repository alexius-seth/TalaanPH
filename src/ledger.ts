import { db } from './db';
import { generateUUID } from './lib/uuid';
import type {
  Account,
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  LedgerEntry,
  OutboxEntry,
  PaymentReminder,
  RecordTransactionInput,
  Transaction,
  TransactionItem,
} from './types';

export const SYSTEM_ACCOUNTS = {
  SALES: 'REVENUE:SALES',
  CASH: 'ASSET:CASH',
  ADJUSTMENT: 'EXPENSE:ADJUSTMENT',
} as const;

export function getCustomerAccountCode(customerId: string): string {
  return `ASSET:AR:${customerId}`;
}

function roundToCentavos(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export class LedgerService {
  /**
   * Ensures system core accounts (CASH, SALES, ADJUSTMENT) exist in local DB.
   */
  async ensureSystemAccounts(): Promise<void> {
    const defaultAccounts = [
      { code: SYSTEM_ACCOUNTS.SALES, type: 'REVENUE' as const },
      { code: SYSTEM_ACCOUNTS.CASH, type: 'ASSET' as const },
      { code: SYSTEM_ACCOUNTS.ADJUSTMENT, type: 'EXPENSE' as const },
    ];

    for (const acc of defaultAccounts) {
      const existing = await db.accounts.where('code').equals(acc.code).first();
      if (!existing) {
        await db.accounts.add({
          id: generateUUID(),
          code: acc.code,
          type: acc.type,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Creates customer, their AR account, and an outbox queue entry in a single atomic transaction.
   */
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const customerId = generateUUID();
    const accountId = generateUUID();
    const outboxId = generateUUID();
    const now = new Date().toISOString();

    const customer: Customer = {
      id: customerId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      nickname: input.nickname.trim(),
      phoneNumber: input.phoneNumber.trim(),
      creditLimit: roundToCentavos(input.creditLimit ?? 0),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const arAccount: Account = {
      id: accountId,
      code: getCustomerAccountCode(customerId),
      type: 'ASSET',
      customerId,
      createdAt: now,
    };

    const outboxEntry: OutboxEntry = {
      id: outboxId,
      action: 'CREATE_CUSTOMER',
      payload: { customer, account: arAccount },
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await db.transaction('rw', [db.customers, db.accounts, db.syncOutbox], async () => {
      await db.customers.add(customer);
      await db.accounts.add(arAccount);
      await db.syncOutbox.add(outboxEntry);
    });

    return customer;
  }

  /**
   * Updates an existing customer's contact and credit limit details.
   */
  async updateCustomer(customerId: string, input: UpdateCustomerInput): Promise<Customer> {
    const existing = await db.customers.get(customerId);
    if (!existing) throw new Error(`Customer not found: ${customerId}`);

    const now = new Date().toISOString();
    const updatedCustomer: Customer = {
      ...existing,
      nickname: input.nickname.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phoneNumber: (input.phoneNumber ?? existing.phoneNumber).trim(),
      creditLimit: roundToCentavos(input.creditLimit ?? existing.creditLimit),
      updatedAt: now,
    };

    const outboxEntry: OutboxEntry = {
      id: generateUUID(),
      action: 'UPDATE_CUSTOMER',
      payload: {
        customerId,
        nickname: updatedCustomer.nickname,
        firstName: updatedCustomer.firstName,
        lastName: updatedCustomer.lastName,
        phoneNumber: updatedCustomer.phoneNumber,
        creditLimit: updatedCustomer.creditLimit,
        updatedAt: now,
      },
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await db.transaction('rw', [db.customers, db.syncOutbox], async () => {
      await db.customers.put(updatedCustomer);
      await db.syncOutbox.add(outboxEntry);
    });

    return updatedCustomer;
  }

  /**
   * Soft-deletes / archives a customer only if their debt balance is exactly 0.
   */
  async archiveCustomer(customerId: string): Promise<void> {
    const existing = await db.customers.get(customerId);
    if (!existing) throw new Error(`Customer not found: ${customerId}`);

    const balance = await this.getCustomerBalance(customerId);
    if (balance !== 0) {
      throw new Error(
        `Hindi pwedeng burahin ang suki na may natitirang utang (₱${balance.toFixed(2)}). Kailangan munang ma-settle o maging ₱0.00.`
      );
    }

    const now = new Date().toISOString();
    const outboxEntry: OutboxEntry = {
      id: generateUUID(),
      action: 'ARCHIVE_CUSTOMER',
      payload: {
        customerId,
        updatedAt: now,
      },
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await db.transaction('rw', [db.customers, db.syncOutbox], async () => {
      await db.customers.update(customerId, {
        isActive: false,
        updatedAt: now,
      });
      await db.syncOutbox.add(outboxEntry);
    });
  }

  /**
   * Records a double-entry transaction (CREDIT_PURCHASE, PAYMENT, or ADJUSTMENT).
   * Enforces Debits = Credits and persists to outbox in one atomic write.
   */
  async recordTransaction(input: RecordTransactionInput): Promise<{
    transaction: Transaction;
    entries: LedgerEntry[];
    newBalance: number;
  }> {
    await this.ensureSystemAccounts();

    const amount = roundToCentavos(input.amount);
    if (amount <= 0) {
      throw new Error('Transaction amount must be greater than zero');
    }

    const customerArCode = getCustomerAccountCode(input.customerId);
    const arAccount = await db.accounts.where('code').equals(customerArCode).first();
    if (!arAccount) {
      throw new Error(`Account not found for customer: ${input.customerId}`);
    }

    const transactionId = generateUUID();
    const refNumber = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const transaction: Transaction = {
      id: transactionId,
      referenceNumber: refNumber,
      type: input.type,
      description: input.description,
      dueDate: input.dueDate || undefined,
      createdAt: now,
    };

    let entries: LedgerEntry[] = [];

    if (input.type === 'CREDIT_PURCHASE') {
      const salesAccount = await db.accounts.where('code').equals(SYSTEM_ACCOUNTS.SALES).first();
      if (!salesAccount) throw new Error('Sales account missing');

      entries = [
        {
          id: generateUUID(),
          transactionId,
          accountId: arAccount.id,
          amount,
          direction: 'DEBIT',
          createdAt: now,
        },
        {
          id: generateUUID(),
          transactionId,
          accountId: salesAccount.id,
          amount,
          direction: 'CREDIT',
          createdAt: now,
        },
      ];
    } else if (input.type === 'PAYMENT') {
      const cashAccount = await db.accounts.where('code').equals(SYSTEM_ACCOUNTS.CASH).first();
      if (!cashAccount) throw new Error('Cash account missing');

      entries = [
        {
          id: generateUUID(),
          transactionId,
          accountId: cashAccount.id,
          amount,
          direction: 'DEBIT',
          createdAt: now,
        },
        {
          id: generateUUID(),
          transactionId,
          accountId: arAccount.id,
          amount,
          direction: 'CREDIT',
          createdAt: now,
        },
      ];
    } else if (input.type === 'ADJUSTMENT') {
      const adjAccount = await db.accounts.where('code').equals(SYSTEM_ACCOUNTS.ADJUSTMENT).first();
      if (!adjAccount) throw new Error('Adjustment account missing');

      entries = [
        {
          id: generateUUID(),
          transactionId,
          accountId: adjAccount.id,
          amount,
          direction: 'DEBIT',
          createdAt: now,
        },
        {
          id: generateUUID(),
          transactionId,
          accountId: arAccount.id,
          amount,
          direction: 'CREDIT',
          createdAt: now,
        },
      ];
    }

    // Verify double-entry constraint: sum(debits) === sum(credits)
    const totalDebit = roundToCentavos(
      entries.filter((e) => e.direction === 'DEBIT').reduce((acc, e) => acc + e.amount, 0)
    );
    const totalCredit = roundToCentavos(
      entries.filter((e) => e.direction === 'CREDIT').reduce((acc, e) => acc + e.amount, 0)
    );

    if (totalDebit !== totalCredit) {
      throw new Error(`Double-entry balance check failed: Debits (${totalDebit}) !== Credits (${totalCredit})`);
    }

    const items: TransactionItem[] = (input.items ?? []).map((it) => ({
      id: generateUUID(),
      transactionId,
      productId: it.productId,
      itemName: it.itemName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: roundToCentavos(it.quantity * it.unitPrice),
    }));

    let reminder: PaymentReminder | undefined;
    if (input.type === 'CREDIT_PURCHASE' && input.dueDate) {
      reminder = {
        id: generateUUID(),
        customerId: input.customerId,
        transactionId,
        dueDate: input.dueDate,
        status: 'PENDING',
        createdAt: now,
      };
    }

    const outboxEntry: OutboxEntry = {
      id: transactionId, // Idempotency key aligns with transaction UUID
      action: 'RECORD_TRANSACTION',
      payload: { transaction, entries, items, reminder },
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await db.transaction(
      'rw',
      [db.transactions, db.ledgerEntries, db.transactionItems, db.paymentReminders, db.products, db.syncOutbox],
      async () => {
        await db.transactions.add(transaction);
        await db.ledgerEntries.bulkAdd(entries);
        if (items.length > 0) {
          await db.transactionItems.bulkAdd(items);
          // Concurrently deduct inventory stock for purchased products
          for (const it of items) {
            if (it.productId) {
              const prod = await db.products.get(it.productId);
              if (prod) {
                const newStock = Math.round((prod.currentStock - it.quantity) * 100) / 100;
                await db.products.update(it.productId, {
                  currentStock: newStock,
                  updatedAt: now,
                });
              }
            }
          }
        }
        if (reminder) {
          await db.paymentReminders.add(reminder);
        }
        await db.syncOutbox.add(outboxEntry);
      }
    );

    const newBalance = await this.getCustomerBalance(input.customerId);

    // If customer has fully paid their debt, settle all pending reminders
    if (newBalance <= 0) {
      await db.paymentReminders
        .where('customerId')
        .equals(input.customerId)
        .modify((r) => {
          if (r.status === 'PENDING') {
            r.status = 'SETTLED';
          }
        });
    }

    return { transaction, entries, newBalance };
  }

  /**
   * Derives real-time customer balance dynamically from immutable ledger entries.
   * AR Account: Balance = Sum(Debits) - Sum(Credits)
   */
  async getCustomerBalance(customerId: string): Promise<number> {
    const arCode = getCustomerAccountCode(customerId);
    const account = await db.accounts.where('code').equals(arCode).first();
    if (!account) return 0;

    const entries = await db.ledgerEntries.where('accountId').equals(account.id).toArray();
    let balance = 0;
    for (const entry of entries) {
      if (entry.direction === 'DEBIT') {
        balance += entry.amount;
      } else {
        balance -= entry.amount;
      }
    }
    return roundToCentavos(balance);
  }
}

export const ledgerService = new LedgerService();

