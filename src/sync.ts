import { db } from './db';
import type { Customer, Account, Transaction, LedgerEntry, TransactionItem, OutboxEntry } from './types';

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
}

export type SyncListener = (state: SyncState) => void;

export interface PushResponse {
  success: boolean;
  processedIds: string[];
  errors?: Record<string, string>;
}

export interface PullResponse {
  timestamp: string;
  customers: Customer[];
  accounts: Account[];
  transactions: Transaction[];
  ledgerEntries: LedgerEntry[];
  transactionItems: TransactionItem[];
}

export class SyncManager {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncedAt: number | null = null;
  private pushEndpoint = '/api/sync/push';
  private pullEndpoint = '/api/sync/pull';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notifyListeners();
        void this.sync();
      });
      window.addEventListener('offline', () => {
        this.notifyListeners();
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    void this.notifyListeners();
    return () => this.listeners.delete(listener);
  }

  public async getPendingCount(): Promise<number> {
    return await db.syncOutbox.where('status').equals('PENDING').count();
  }

  public getState(): SyncState {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    return {
      isOnline,
      isSyncing: this.isSyncing,
      pendingCount: 0,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  private async notifyListeners(): Promise<void> {
    const count = await this.getPendingCount();
    const state: SyncState = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      pendingCount: count,
      lastSyncedAt: this.lastSyncedAt,
    };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /**
   * Main sync loop: pushes outbox mutations, then pulls remote state.
   */
  public async sync(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isSyncing = true;
    await this.notifyListeners();

    try {
      await this.push();
      await this.pull();
      this.lastSyncedAt = Date.now();
    } catch (err) {
      console.error('[SyncManager] Sync failed:', err);
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
    }
  }

  /**
   * Batches PENDING outbox items and pushes upstream.
   */
  public async push(batchSize = 50): Promise<void> {
    const pending = await db.syncOutbox
      .where('status')
      .equals('PENDING')
      .limit(batchSize)
      .toArray();

    if (pending.length === 0) return;

    const ids = pending.map((item) => item.id);
    await db.syncOutbox.where('id').anyOf(ids).modify({ status: 'SYNCING' });

    try {
      const response = await fetch(this.pushEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: pending }),
      });

      if (!response.ok) {
        throw new Error(`Push failed with HTTP ${response.status}`);
      }

      const result = (await response.json()) as PushResponse;
      const processed = new Set(result.processedIds || []);

      await db.transaction('rw', db.syncOutbox, async () => {
        for (const item of pending) {
          if (processed.has(item.id)) {
            await db.syncOutbox.delete(item.id);
          } else {
            await db.syncOutbox.update(item.id, {
              status: item.retryCount >= 5 ? 'FAILED' : 'PENDING',
              retryCount: item.retryCount + 1,
            });
          }
        }
      });
    } catch (err) {
      // Revert status to PENDING on network failure
      await db.syncOutbox.where('id').anyOf(ids).modify((item) => {
        item.status = item.retryCount >= 5 ? 'FAILED' : 'PENDING';
        item.retryCount += 1;
      });
      throw err;
    }
  }

  /**
   * Pulls new/updated records from cloud since last sync cursor.
   */
  public async pull(): Promise<void> {
    const lastPullMeta = await db.syncMeta.get('last_pull_timestamp');
    const since = lastPullMeta?.value || new Date(0).toISOString();

    const response = await fetch(`${this.pullEndpoint}?since=${encodeURIComponent(since)}`);
    if (!response.ok) {
      throw new Error(`Pull failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as PullResponse;

    await db.transaction(
      'rw',
      [db.customers, db.accounts, db.transactions, db.ledgerEntries, db.transactionItems, db.syncMeta],
      async () => {
        if (data.customers?.length) await db.customers.bulkPut(data.customers);
        if (data.accounts?.length) await db.accounts.bulkPut(data.accounts);
        if (data.transactions?.length) await db.transactions.bulkPut(data.transactions);
        if (data.ledgerEntries?.length) await db.ledgerEntries.bulkPut(data.ledgerEntries);
        if (data.transactionItems?.length) await db.transactionItems.bulkPut(data.transactionItems);

        await db.syncMeta.put({ key: 'last_pull_timestamp', value: data.timestamp });
      }
    );
  }
}

export const syncManager = new SyncManager();

