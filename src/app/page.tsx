'use client';

import React, { useState, useEffect } from 'react';
import { Store, Edit3, Users, DollarSign, ArrowRight, UserCheck, Package, Settings, Lock } from 'lucide-react';
import { SyncBadge } from '../components/SyncBadge';
import { CustomerList, type CustomerWithBalance } from '../components/CustomerList';
import { DueTodayBanner } from '../components/DueTodayBanner';
import { CustomerDetail } from '../components/CustomerDetail';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { EditCustomerModal } from '../components/EditCustomerModal';
import { TransactionModal } from '../components/TransactionModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { InventoryModal } from '../components/InventoryModal';
import { SettingsModal } from '../components/SettingsModal';
import { PinLockScreen } from '../components/PinLockScreen';
import { checkStorage } from '../db';
import { getStoreSettings } from '../settings';
import { useLanguage, LanguageToggle } from '../i18n';
import type { Customer, TransactionType } from '../types';
import type { ReceiptParams } from '../sms';

export default function TalaanDashboard() {
  const { t, lang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [storeName, setStoreName] = useState('Talaan Store');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Metrics
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [activeCustomerCount, setActiveCustomerCount] = useState(0);

  // Selection & Modals
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<number>(0);
  const [modalTxnType, setModalTxnType] = useState<TransactionType>('CREDIT_PURCHASE');
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [editCustomerBalance, setEditCustomerBalance] = useState<number>(0);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptParams | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [storageIssue, setStorageIssue] = useState<'unavailable' | 'quota' | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const unlocked = sessionStorage.getItem('talaan_session_unlocked') === 'true';
      setIsUnlocked(unlocked);
    }
    void checkStorage().then(setStorageIssue);
    void getStoreSettings().then((s) => {
      if (s?.storeName) setStoreName(s.storeName);
    });
  }, []);

  const handleUnlock = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('talaan_session_unlocked', 'true');
    }
    setIsUnlocked(true);
  };

  const handleLock = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('talaan_session_unlocked');
    }
    setIsUnlocked(false);
  };

  const handleCustomersLoaded = (customers: CustomerWithBalance[]) => {
    const total = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
    setTotalReceivables(total);
    setActiveCustomerCount(customers.length);

    // Keep selected customer balance up-to-date
    if (selectedCustomer) {
      const updated = customers.find((c) => c.id === selectedCustomer.id);
      if (updated) setSelectedBalance(updated.balance);
    }
  };

  const handleCustomerSelect = (customer: Customer, balance: number) => {
    setSelectedCustomer(customer);
    setSelectedBalance(balance);

    // On mobile screens (< 768px), open transaction modal on tap
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setModalTxnType('CREDIT_PURCHASE');
      setIsTransactionOpen(true);
    }
  };

  const handleOpenTransaction = (type: TransactionType) => {
    setModalTxnType(type);
    setIsTransactionOpen(true);
  };

  const handleTransactionSuccess = (receipt: ReceiptParams) => {
    setReceiptData(receipt);
    setIsReceiptOpen(true);
    setRefreshKey((k: number) => k + 1);
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    setRefreshKey((k: number) => k + 1);
    setSelectedCustomer(newCustomer);
    setSelectedBalance(0);
    setModalTxnType('CREDIT_PURCHASE');
    setIsTransactionOpen(true);
  };

  const handleOpenEditCustomer = (customer: Customer, balance?: number) => {
    setCustomerToEdit(customer);
    setEditCustomerBalance(balance ?? (customer.id === selectedCustomer?.id ? selectedBalance : 0));
  };

  const handleCustomerUpdated = (updated: Customer) => {
    if (selectedCustomer?.id === updated.id) {
      setSelectedCustomer(updated);
    }
    setRefreshKey((k: number) => k + 1);
  };

  const handleCustomerArchived = (customerId: string) => {
    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer(null);
      setSelectedBalance(0);
    }
    setRefreshKey((k: number) => k + 1);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-md">
            <Store className="w-6 h-6 text-white" />
          </div>
          <span className="text-emerald-800 font-black text-sm tracking-widest">TALAAN</span>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <PinLockScreen
        storeName={storeName}
        onUnlocked={handleUnlock}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" suppressHydrationWarning>
      {/* Top Header / App Bar */}
      <header className="sticky top-0 z-40 bg-emerald-600 text-white shadow-md">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Store title & branding */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-700/90 flex items-center justify-center text-white shadow-inner">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-base font-black tracking-tight text-white">TALAAN</h1>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-800 text-emerald-100 px-1.5 py-0.2 rounded">
                      PWA
                    </span>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-1 text-xs text-emerald-100 hover:text-white font-medium transition"
                    title={t('settingsBtn')}
                  >
                    <span suppressHydrationWarning>{storeName}</span>
                    <Edit3 className="w-3 h-3 text-emerald-200" />
                  </button>
                </div>
              </div>

              {/* Header actions on mobile right */}
              <div className="flex items-center gap-1.5 sm:hidden">
                <button
                  onClick={() => setIsInventoryOpen(true)}
                  className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg active:scale-95 transition"
                  title={t('inventoryBtn')}
                >
                  <Package className="w-4 h-4 text-emerald-200" />
                </button>
                <LanguageToggle />
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg active:scale-95 transition"
                  title={t('settingsBtn')}
                >
                  <Settings className="w-4 h-4 text-emerald-200" />
                </button>
                <button
                  onClick={handleLock}
                  className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg active:scale-95 transition"
                  title={t('lockBtn')}
                >
                  <Lock className="w-4 h-4 text-emerald-200" />
                </button>
                <SyncBadge />
              </div>
            </div>

            {/* Quick Metrics & Desktop Actions */}
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-500/50">
              <div className="flex items-center gap-4 sm:gap-6 text-xs">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-200" />
                  <div>
                    <span className="text-emerald-200 text-[10px] block leading-none">{t('totalReceivables')}</span>
                    <span className="font-extrabold text-sm text-white" suppressHydrationWarning>
                      ₱{mounted ? totalReceivables.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-200" />
                  <div>
                    <span className="text-emerald-200 text-[10px] block leading-none">{t('activeCustomers')}</span>
                    <span className="font-extrabold text-sm text-white" suppressHydrationWarning>
                      {mounted ? activeCustomerCount : 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => setIsInventoryOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-800 text-white active:scale-95 text-xs font-bold rounded-full border border-emerald-500/50 shadow-xs transition"
                  title={t('inventoryBtn')}
                >
                  <Package className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{t('inventoryBtn')}</span>
                </button>
                <LanguageToggle />
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 bg-emerald-700/80 hover:bg-emerald-800 text-white rounded-full border border-emerald-500/50 active:scale-95 transition"
                  title={t('settingsBtn')}
                >
                  <Settings className="w-3.5 h-3.5 text-emerald-200" />
                </button>
                <button
                  onClick={handleLock}
                  className="p-1.5 bg-emerald-700/80 hover:bg-emerald-800 text-white rounded-full border border-emerald-500/50 active:scale-95 transition"
                  title={t('lockBtn')}
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-200" />
                </button>
                <SyncBadge />
              </div>
            </div>
          </div>
        </div>
      </header>

      {storageIssue && (
        <div role="alert" className="bg-red-600 text-white text-xs font-semibold px-4 py-2 text-center">
          {t(storageIssue === 'quota' ? 'storageQuota' : 'storageUnavailable')}
        </div>
      )}

      {/* Due Today / Overdue Alert Banner */}
      <DueTodayBanner
        storeName={storeName}
        refreshKey={refreshKey}
        onReminderSent={() => setRefreshKey((k: number) => k + 1)}
      />

      {/* Main Content: Responsive Master-Detail Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Left Column: Customer Directory (approx. 380px - 420px on desktop) */}
          <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 bg-white md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-none border-gray-200 shadow-xs md:shadow-none">
            <CustomerList
              refreshKey={refreshKey}
              selectedCustomerId={selectedCustomer?.id}
              onSelectCustomer={handleCustomerSelect}
              onAddNewCustomer={() => setIsAddCustomerOpen(true)}
              onEditCustomer={handleOpenEditCustomer}
              onCustomersLoaded={handleCustomersLoaded}
            />
          </div>

          {/* Right Column: Suki Detail & Ledger (visible on tablet/desktop) */}
          <div className="hidden md:block flex-1 min-w-0 w-full">
            {selectedCustomer ? (
              <CustomerDetail
                customer={selectedCustomer}
                balance={selectedBalance}
                refreshKey={refreshKey}
                onOpenTransaction={handleOpenTransaction}
                onEditCustomer={handleOpenEditCustomer}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-xs flex flex-col items-center justify-center min-h-[420px] space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">{t('selectCustomerPrompt')}</h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  {t('selectCustomerSub')}
                </p>
                <button
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  <span>{t('registerNewCustomer')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={handleCustomerCreated}
      />

      {customerToEdit && (
        <EditCustomerModal
          isOpen={!!customerToEdit}
          customer={customerToEdit}
          currentBalance={editCustomerBalance}
          onClose={() => setCustomerToEdit(null)}
          onCustomerUpdated={handleCustomerUpdated}
          onCustomerArchived={handleCustomerArchived}
        />
      )}

      {selectedCustomer && (
        <TransactionModal
          isOpen={isTransactionOpen}
          customer={selectedCustomer}
          currentBalance={selectedBalance}
          initialType={modalTxnType}
          storeName={storeName}
          onClose={() => setIsTransactionOpen(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {receiptData && (
        <ReceiptModal
          isOpen={isReceiptOpen}
          receiptParams={receiptData}
          onClose={() => {
            setIsReceiptOpen(false);
            setReceiptData(null);
          }}
        />
      )}

      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onInventoryChanged={() => setRefreshKey((k: number) => k + 1)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(name) => setStoreName(name)}
      />
    </div>
  );
}
