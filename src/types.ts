export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type TransactionType = 'CREDIT_PURCHASE' | 'PAYMENT' | 'ADJUSTMENT';
export type EntryDirection = 'DEBIT' | 'CREDIT';
export type OutboxAction = 'CREATE_CUSTOMER' | 'RECORD_TRANSACTION';
export type OutboxStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phoneNumber: string;
  creditLimit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  code: string;
  type: AccountType;
  customerId?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  referenceNumber: string;
  type: TransactionType;
  description?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  amount: number;
  direction: EntryDirection;
  createdAt: string;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OutboxEntry {
  id: string;
  action: OutboxAction;
  payload: Record<string, unknown>;
  timestamp: number;
  status: OutboxStatus;
  retryCount: number;
}

export interface SyncMeta {
  key: string;
  value: string;
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  nickname: string;
  phoneNumber: string;
  creditLimit?: number;
}

export interface LineItemInput {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface RecordTransactionInput {
  type: TransactionType;
  customerId: string;
  amount: number;
  description?: string;
  items?: LineItemInput[];
}

