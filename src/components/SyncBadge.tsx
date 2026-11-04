'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { syncManager, type SyncState } from '../sync';
import { useLanguage } from '../i18n';

export const SyncBadge: React.FC = () => {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    setMounted(true);
    setSyncState(syncManager.getState());
    return syncManager.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-700/60 text-emerald-100">
        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
        <span>Sync</span>
      </div>
    );
  }

  const handleManualSync = () => {
    if (!syncState.isSyncing) {
      void syncManager.sync();
    }
  };

  return (
    <button
      onClick={handleManualSync}
      disabled={syncState.isSyncing}
      title={
        !syncState.isOnline
          ? t('offline')
          : syncState.isSyncing
          ? t('syncing')
          : syncState.pendingCount > 0
          ? `${t('online')} (${syncState.pendingCount})`
          : t('online')
      }
      className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold shadow-xs transition active:scale-95 shrink-0 ${
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
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden min-[420px]:inline sm:inline">{t('offline')}</span>
        </>
      ) : syncState.isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-blue-700" />
          <span className="hidden min-[420px]:inline sm:inline">{t('syncing')}</span>
        </>
      ) : (
        <>
          <Wifi className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
          <span className="hidden min-[420px]:inline sm:inline">{t('online')}</span>
        </>
      )}

      {syncState.pendingCount > 0 && (
        <span className="bg-black/10 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
          {syncState.pendingCount}
        </span>
      )}
    </button>
  );
};
