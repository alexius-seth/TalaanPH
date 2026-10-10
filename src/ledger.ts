import { db } from './db';
import type {
  Account,
  Customer,
  CreateCustomerInput,
  LedgerEntry,
  OutboxEntry,
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
          id: crypto.randomUUID(),
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
    const customerId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const outboxId = crypto.randomUUID();
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

    const transactionId = crypto.randomUUID();
    const refNumber = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const transaction: Transaction = {
      id: transactionId,
      referenceNumber: refNumber,
      type: input.type,
      description: input.description,
      createdAt: now,
    };

    let entries: LedgerEntry[] = [];

    if (input.type === 'CREDIT_PURCHASE') {
      const salesAccount = await db.accounts.where('code').equals(SYSTEM_ACCOUNTS.SALES).first();
      if (!salesAccount) throw new Error('Sales account missing');

      entries = [
        {
          id: crypto.randomUUID(),
          transactionId,
          accountId: arAccount.id,
          amount,
          direction: 'DEBIT',
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          transactionId,
          accountId: cashAccount.id,
          amount,
          direction: 'DEBIT',
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          transactionId,
          accountId: adjAccount.id,
          amount,
          direction: 'DEBIT',
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
      transactionId,
      itemName: it.itemName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: roundToCentavos(it.quantity * it.unitPrice),
    }));

    const outboxEntry: OutboxEntry = {
      id: transactionId, // Idempotency key aligns with transaction UUID
      action: 'RECORD_TRANSACTION',
      payload: { transaction, entries, items },
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await db.transaction('rw', [db.transactions, db.ledgerEntries, db.transactionItems, db.syncOutbox], async () => {
      await db.transactions.add(transaction);
      await db.ledgerEntries.bulkAdd(entries);
      if (items.length > 0) {
        await db.transactionItems.bulkAdd(items);
      }
      await db.syncOutbox.add(outboxEntry);
    });

    const newBalance = await this.getCustomerBalance(input.customerId);
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

