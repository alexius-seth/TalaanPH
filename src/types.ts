export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type TransactionType = 'CREDIT_PURCHASE' | 'PAYMENT' | 'ADJUSTMENT';
export type EntryDirection = 'DEBIT' | 'CREDIT';
export type OutboxAction =
  | 'CREATE_CUSTOMER'
  | 'UPDATE_CUSTOMER'
  | 'ARCHIVE_CUSTOMER'
  | 'RECORD_TRANSACTION'
  | 'CREATE_PRODUCT'
  | 'RESTOCK_PRODUCT'
  | 'UPDATE_PRODUCT';
export type OutboxStatus = 'PENDING' | 'SYNCING' | 'FAILED';
export type ReminderStatus = 'PENDING' | 'SETTLED' | 'REMINDED';

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
  dueDate?: string;
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
  productId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentReminder {
  id: string;
  customerId: string;
  transactionId: string;
  dueDate: string;
  status: ReminderStatus;
  remindedAt?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  currentStock: number;
  lowStockThreshold: number;
  costPerBaseUnit: number;
  retailPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPackageUnit {
  id: string;
  productId: string;
  unitName: string;
  multiplier: number;
  packageCost: number;
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

export interface UpdateCustomerInput {
  nickname: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  creditLimit?: number;
}

export interface LineItemInput {
  productId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface RecordTransactionInput {
  type: TransactionType;
  customerId: string;
  amount: number;
  description?: string;
  dueDate?: string;
  items?: LineItemInput[];
}

export interface CreateProductInput {
  name: string;
  category: string;
  baseUnit: string;
  initialStock?: number;
  lowStockThreshold?: number;
  costPerBaseUnit?: number;
  retailPrice: number;
  packageUnits?: Array<{
    unitName: string;
    multiplier: number;
    packageCost: number;
  }>;
}
