import Dexie, { Table } from 'dexie';
import type {
  Customer,
  Account,
  Transaction,
  LedgerEntry,
  TransactionItem,
  OutboxEntry,
  SyncMeta,
} from './types';

export class TalaanDatabase extends Dexie {
  customers!: Table<Customer, string>;
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  ledgerEntries!: Table<LedgerEntry, string>;
  transactionItems!: Table<TransactionItem, string>;
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
  }
}

export const db = new TalaanDatabase();

