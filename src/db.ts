import Dexie, { Table } from 'dexie';
import type {
  Customer,
  Account,
  Transaction,
  LedgerEntry,
  TransactionItem,
  PaymentReminder,
  Product,
  ProductPackageUnit,
  OutboxEntry,
  SyncMeta,
} from './types';

export class TalaanDatabase extends Dexie {
  customers!: Table<Customer, string>;
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  ledgerEntries!: Table<LedgerEntry, string>;
  transactionItems!: Table<TransactionItem, string>;
  paymentReminders!: Table<PaymentReminder, string>;
  products!: Table<Product, string>;
  packageUnits!: Table<ProductPackageUnit, string>;
  syncOutbox!: Table<OutboxEntry, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('talaan_db');

    this.version(1).stores({
      customers: 'id, phoneNumber, nickname, isActive, createdAt',
      accounts: 'id, &code, customerId, type',
      transactions: 'id, &referenceNumber, type, createdAt',
      ledgerEntries: 'id, transactionId, accountId, direction, createdAt',
      transactionItems: 'id, transactionId',
      syncOutbox: 'id, action, status, timestamp, retryCount',
      syncMeta: 'key',
    });

    this.version(2).stores({
      transactions: 'id, &referenceNumber, type, dueDate, createdAt',
      paymentReminders: 'id, customerId, transactionId, dueDate, status, createdAt',
    });

    this.version(3).stores({
      transactionItems: 'id, transactionId, productId',
      products: 'id, name, category, currentStock, createdAt',
      packageUnits: 'id, productId, unitName',
    });
  }
}

export const db = new TalaanDatabase();

/**
 * Opens IndexedDB and reports why it is unusable (private-browsing, blocked storage, quota)
 * so the UI can warn the user instead of crashing. Returns null when storage is healthy.
 */
export async function checkStorage(): Promise<'unavailable' | 'quota' | null> {
  try {
    if (typeof indexedDB === 'undefined') return 'unavailable';
    await db.open();
    return null;
  } catch (err: any) {
    return err?.name === 'QuotaExceededError' ? 'quota' : 'unavailable';
  }
}
