import { db } from './db';
import { hashPin } from './lib/hash';
import { generateUUID } from './lib/uuid';
import { syncManager } from './sync';
import type { StoreSetting, UpdateStoreSettingsInput } from './types';

export const DEFAULT_STORE_ID = 'default_store';
export const DEFAULT_STORE_NAME = 'Talaan Store';
const DEFAULT_PIN = '1234';

let cachedStoreName: string = DEFAULT_STORE_NAME;

// Hydrate cachedStoreName from localStorage if available
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('talaan_store_name');
  if (saved) cachedStoreName = saved;
}

export function getCachedStoreName(): string {
  return cachedStoreName;
}

export function setCachedStoreName(name: string): void {
  cachedStoreName = name;
  if (typeof window !== 'undefined') {
    localStorage.setItem('talaan_store_name', name);
  }
}

/**
 * Retrieves the store settings singleton from IndexedDB.
 * If not yet initialized, seeds the default record.
 */
export async function getStoreSettings(): Promise<StoreSetting> {
  try {
    const existing = await db.settings.get(DEFAULT_STORE_ID);
    if (existing) {
      setCachedStoreName(existing.storeName);
      return existing;
    }

    const defaultRecord: StoreSetting = {
      id: DEFAULT_STORE_ID,
      storeName: cachedStoreName || DEFAULT_STORE_NAME,
      pinHash: hashPin(DEFAULT_PIN),
      updatedAt: new Date().toISOString(),
    };

    await db.settings.put(defaultRecord);
    setCachedStoreName(defaultRecord.storeName);
    return defaultRecord;
  } catch (err) {
    console.warn('[getStoreSettings] Failed to read settings from db, using fallback:', err);
    return {
      id: DEFAULT_STORE_ID,
      storeName: cachedStoreName,
      pinHash: hashPin(DEFAULT_PIN),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Updates store name and/or PIN after validating current PIN.
 * Queues an UPDATE_STORE_SETTINGS mutation into syncOutbox.
 */
export async function updateStoreSettings(
  input: UpdateStoreSettingsInput
): Promise<StoreSetting> {
  const current = await getStoreSettings();

  // Verify current PIN
  if (!input.currentPin || hashPin(input.currentPin) !== current.pinHash) {
    throw new Error('Maling PIN / Invalid current PIN');
  }

  // Validate new PIN if supplied
  let newPinHash = current.pinHash;
  if (input.newPin !== undefined && input.newPin !== '') {
    const trimmedPin = input.newPin.trim();
    if (!/^\d{4,6}$/.test(trimmedPin)) {
      throw new Error('Ang PIN ay dapat 4 hanggang 6 na numero / PIN must be 4 to 6 digits');
    }
    newPinHash = hashPin(trimmedPin);
  }

  const updatedName = input.storeName?.trim() || current.storeName;
  const updated: StoreSetting = {
    id: DEFAULT_STORE_ID,
    storeName: updatedName,
    pinHash: newPinHash,
    updatedAt: new Date().toISOString(),
  };

  await db.settings.put(updated);
  setCachedStoreName(updated.storeName);

  // Queue to sync outbox
  await db.syncOutbox.add({
    id: generateUUID(),
    action: 'UPDATE_STORE_SETTINGS',
    payload: { settings: updated },
    timestamp: Date.now(),
    status: 'PENDING',
    retryCount: 0,
  });

  // Attempt non-blocking push if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void syncManager.push().catch(() => {});
  }

  return updated;
}

