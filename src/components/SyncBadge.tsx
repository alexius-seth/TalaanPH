'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { syncManager, type SyncState } from '../sync';

export const SyncBadge: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState());

  useEffect(() => {
    return syncManager.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  const handleManualSync = () => {
    if (!syncState.isSyncing) {
      void syncManager.sync();
    }
  };

  return (
    <button
      onClick={handleManualSync}
      disabled={syncState.isSyncing}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition active:scale-95 ${
        !syncState.isOnline
          ? 'bg-amber-100 text-amber-900 border border-amber-300'
          : syncState.isSyncing
          ? 'bg-blue-100 text-blue-900 border border-blue-300'
          : syncState.pendingCount > 0
          ? 'bg-orange-100 text-orange-900 border border-orange-300'
          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
      }`}
    >
      {!syncState.isOnline ? (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline</span>
        </>
      ) : syncState.isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing...</span>
        </>
      ) : (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Online</span>
        </>
      )}

      {syncState.pendingCount > 0 && (
        <span className="ml-1 bg-black/10 px-1.5 py-0.2 rounded-full text-[10px]">
          {syncState.pendingCount}
        </span>
      )}
    </button>
  );
};

