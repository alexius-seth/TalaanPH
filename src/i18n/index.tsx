'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'tl' | 'en';

export const translations = {
  tl: {
    // Header & App
    appTitle: 'TALAAN',
    pwaBadge: 'PWA',
    storeDefault: 'Sari-Sari Store',
    activeCustomers: 'Aktibong Suki',
    totalReceivables: 'Kabuuang Utang',
    inventoryBtn: 'Paninda',
    online: 'Online',
    offline: 'Offline',
    syncing: 'Syncing...',
    allSynced: 'Lahat Nai-sync',
    unsyncedCount: '{count} Hinihintay',
    syncFailed: 'May Error sa Sync',
    saveStore: 'I-save ang Tindahan',

    // Search & Directory
    searchPlaceholder: 'Hanapin si Suki (Palayaw o Pangalan)...',
    noCustomers: 'Walang natagpuang suki',
    startByRegistering: 'Magsimula sa pamamagitan ng paglista sa unang suki',
    registerNewCustomer: '+ Ilista bilang bagong suki',
    limitLabel: 'Limit:',
    debtLabel: 'Utang',
    loadingCustomers: 'Kinukuha ang talaan...',
    addCustomerBtn: '+ Bagong Suki',
    sukiDirectory: 'Listahan ng mga Suki',

    // Customer Detail
    selectCustomerPrompt: 'Pumili ng Suki',
    selectCustomerSub:
      'Piliin ang isang suki mula sa kaliwa upang matingnan ang buong talaan ng utang, mga nakaraang bayad, o magtala ng bagong transaksyon.',
    activeBadge: 'Aktibo',
    addCredit: '+ Bagong Utang',
    recordPayment: 'Magbayad',
    currentBalance: 'Kasalukuyang Utang',
    creditLimitStatus: 'Credit Limit Status',
    noCreditLimit: 'Walang itinakdang limit',
    maxLimitReached: 'Nasa limit na ang utang!',
    transactionHistory: 'Talaan ng mga Transaksyon',
    noTransactions: 'Wala pang transaksyon ang suki na ito.',
    creditTag: 'Utang',
    paymentTag: 'Bayad',
    adjustmentTag: 'Adjustment',
    editSuki: 'I-edit si Suki',

    // Transaction Modal
    newCredit: 'Bagong Utang',
    payment: 'Bayad',
    current: 'Kasalukuyan:',
    newBalance: 'Bagong Balanse:',
    amount: 'Halaga (₱)',
    dueDatePrompt: 'Kailan Magbabayad? (Due Date)',
    selectInventoryItems: 'Pumili ng Paninda (Cart)',
    quickAmounts: 'Mabilisang Halaga:',
    descriptionPlaceholder: 'Deskripsyon / Tindang Kinuha',
    recordTxnBtn: 'Itala ang Transaksyon',
    recordingTxn: 'Itinatala...',
    outOfStock: 'Ubos na',
    stockLeft: 'stock',
    cartSummary: 'Kabuuan ng mga kinuha:',
    nextFriday: 'Sa Biyernes',
    endOfMonth: 'Katapusan',
    oneWeek: '1 Linggo',
    fullPayment: 'Buong Bayad',
    enterAmountPrompt: 'Maglagay ng halaga o pumili ng paninda',

    // Receipt Modal
    receiptTitle: 'Resibo ng Transaksyon',
    sendSms: 'I-text ang Resibo (Libre via SIM)',
    doneClose: 'Tapos Na / Isara',
    totalBalance: 'Kabuuang Utang:',
    thankYou: 'Salamat po!',
    refNumberLabel: 'Ref #:',
    customerLabel: 'Suki:',
    smsNotice: 'Walang bayad! Gagamitin ang default SMS app ng iyong cellphone.',

    // Due Today Banner
    dueTodayTitle: 'Mga Dapat Maningil Ngayong Araw',
    dueTodayDesc: 'May {count} suki na may nakatakdang bayad ngayong araw.',
    sendReminder: 'I-text ang Paalala',
    viewDue: 'Tingnan',

    // Customer Add / Edit
    newCustomerTitle: 'Bagong Suki',
    editCustomerTitle: 'I-edit si {name}',
    nicknameLabel: 'Palayaw / Nickname *',
    firstNameLabel: 'Pangalan (First)',
    lastNameLabel: 'Apelyido (Last)',
    phoneLabel: 'Cellphone Number',
    creditLimitLabel: 'Credit Limit (₱)',
    noLimitHelp: '0 (Walang limit)',
    saveChanges: 'I-save ang Pagbabago',
    saving: 'Inililigtas...',
    cancel: 'Kanselahin',
    archiveCustomerTitle: 'I-archive si Suki',
    archiveCustomerHelp: 'Maaari lamang kung ₱0.00 ang kasalukuyang utang.',
    archiveBtn: 'Burahin / I-archive',
    archiveConfirm:
      'Sigurado ka bang nais mong i-archive si {name}? Hindi na siya lalabas sa aktibong listahan ngunit mananatili ang nakaraang talaan.',
    cannotArchiveDebt:
      'Hindi pwedeng burahin ang suki na may natitirang utang (₱{balance}). Kailangan munang ma-settle o maging ₱0.00.',
    requiredNickname: 'Kailangan ang palayaw o nickname ni suki.',
    invalidPhone: 'Maling numero. Gamitin ang 09xxxxxxxxx o +639xxxxxxxxx.',

    // Inventory Modal
    storageUnavailable:
      'Hindi magamit ang storage ng browser (private mode?). Hindi mase-save ang datos offline. Gumamit ng normal na tab.',
    storageQuota: 'Puno na ang storage ng device. Magbakante ng espasyo para patuloy na makapag-save.',
    inventoryTitle: 'Pamamahala ng Paninda',
    productListTab: 'Talaan ng Paninda',
    restockTab: 'Break-Bulk Restock',
    addProductTab: '+ Bagong Paninda',
    lowStockBadge: 'Mababang Stock',
    inStock: 'May Stock',
    costPerUnit: 'Puhunan:',
    retailPrice: 'Presyo:',
    wholesaleConversion: 'Wholesale Break-Bulk Conversion:',
    bulkRestockBtn: 'I-restock ang Paninda',
    productName: 'Pangalan ng Paninda',
    category: 'Kategorya',
    baseUnit: 'Unit (Pira-piraso)',
    initialStock: 'Paunang Dami (Initial Stock)',
    saveProductBtn: 'I-save ang Bagong Paninda',
    unitBox: 'Kahon/Sako',
    unitPieces: 'piraso',
    stockAddedPreview: 'Dagdagan ng {count} {unit}',
  },
  en: {
    // Header & App
    appTitle: 'TALAAN',
    pwaBadge: 'PWA',
    storeDefault: 'Sari-Sari Store',
    activeCustomers: 'Active Customers',
    totalReceivables: 'Total Receivables',
    inventoryBtn: 'Inventory',
    online: 'Online',
    offline: 'Offline',
    syncing: 'Syncing...',
    allSynced: 'All Synced',
    unsyncedCount: '{count} Pending',
    syncFailed: 'Sync Error',
    saveStore: 'Save Store Name',

    // Search & Directory
    searchPlaceholder: 'Search customer (Nickname or Name)...',
    noCustomers: 'No customers found',
    startByRegistering: 'Start by registering your first customer',
    registerNewCustomer: '+ Register new customer',
    limitLabel: 'Limit:',
    debtLabel: 'Balance',
    loadingCustomers: 'Loading customers...',
    addCustomerBtn: '+ New Customer',
    sukiDirectory: 'Customer Directory',

    // Customer Detail
    selectCustomerPrompt: 'Select a Customer',
    selectCustomerSub:
      'Select a customer from the left to view their full ledger, past payments, or record a new transaction.',
    activeBadge: 'Active',
    addCredit: '+ Add Credit',
    recordPayment: 'Record Payment',
    currentBalance: 'Current Balance',
    creditLimitStatus: 'Credit Limit Status',
    noCreditLimit: 'No credit limit set',
    maxLimitReached: 'Credit limit reached!',
    transactionHistory: 'Transaction History',
    noTransactions: 'No transactions recorded yet for this customer.',
    creditTag: 'Credit',
    paymentTag: 'Payment',
    adjustmentTag: 'Adjustment',
    editSuki: 'Edit Customer',

    // Transaction Modal
    newCredit: 'New Credit',
    payment: 'Payment',
    current: 'Current:',
    newBalance: 'New Balance:',
    amount: 'Amount (₱)',
    dueDatePrompt: 'Payment Due Date',
    selectInventoryItems: 'Select Inventory Items (Cart)',
    quickAmounts: 'Quick Amounts:',
    descriptionPlaceholder: 'Description / Items taken',
    recordTxnBtn: 'Record Transaction',
    recordingTxn: 'Recording...',
    outOfStock: 'Out of stock',
    stockLeft: 'in stock',
    cartSummary: 'Cart subtotal:',
    nextFriday: 'Next Friday',
    endOfMonth: 'End of Month',
    oneWeek: '1 Week',
    fullPayment: 'Full Payment',
    enterAmountPrompt: 'Enter an amount or select inventory items',

    // Receipt Modal
    receiptTitle: 'Transaction Receipt',
    sendSms: 'Send SMS Receipt (Free via SIM)',
    doneClose: 'Done / Close',
    totalBalance: 'Total Balance:',
    thankYou: 'Thank you!',
    refNumberLabel: 'Ref #:',
    customerLabel: 'Customer:',
    smsNotice: 'Free! Uses your phone\'s native SMS messaging app.',

    // Due Today Banner
    dueTodayTitle: 'Due for Collection Today',
    dueTodayDesc: '{count} customers have payments due today.',
    sendReminder: 'Send SMS Reminder',
    viewDue: 'View',

    // Customer Add / Edit
    newCustomerTitle: 'New Customer',
    editCustomerTitle: 'Edit {name}',
    nicknameLabel: 'Nickname *',
    firstNameLabel: 'First Name',
    lastNameLabel: 'Last Name',
    phoneLabel: 'Mobile Phone Number',
    creditLimitLabel: 'Credit Limit (₱)',
    noLimitHelp: '0 (No limit)',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    cancel: 'Cancel',
    archiveCustomerTitle: 'Archive Customer',
    archiveCustomerHelp: 'Only allowed if current balance is ₱0.00.',
    archiveBtn: 'Delete / Archive',
    archiveConfirm:
      'Are you sure you want to archive {name}? They will no longer appear in the active list, but ledger records are kept.',
    cannotArchiveDebt:
      'Cannot archive customer with remaining debt (₱{balance}). Must be settled to ₱0.00 first.',
    requiredNickname: 'Customer nickname is required.',
    invalidPhone: 'Invalid number. Use 09xxxxxxxxx or +639xxxxxxxxx.',

    // Inventory Modal
    storageUnavailable:
      'Browser storage is unavailable (private mode?). Data cannot be saved offline. Please use a normal tab.',
    storageQuota: 'Device storage is full. Free up space to keep saving records.',
    inventoryTitle: 'Inventory Management',
    productListTab: 'Product List',
    restockTab: 'Break-Bulk Restock',
    addProductTab: '+ New Product',
    lowStockBadge: 'Low Stock',
    inStock: 'In Stock',
    costPerUnit: 'Cost:',
    retailPrice: 'Retail Price:',
    wholesaleConversion: 'Wholesale Break-Bulk Conversion:',
    bulkRestockBtn: 'Restock Product',
    productName: 'Product Name',
    category: 'Category',
    baseUnit: 'Retail Unit (Pieces/Sachet)',
    initialStock: 'Initial Stock',
    saveProductBtn: 'Save Product',
    unitBox: 'Box/Sack',
    unitPieces: 'pieces',
    stockAddedPreview: 'Add {count} {unit}',
  },
} as const;

export type TranslationKey = keyof typeof translations.tl;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'tl',
  setLang: () => {},
  t: (key) => translations.tl[key] || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('tl');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('talaan_lang') as Language;
      if (stored === 'tl' || stored === 'en') {
        setLangState(stored);
      }
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('talaan_lang', newLang);
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[lang] || translations.tl;
    let text: string = dict[key] || translations.tl[key] || key;

    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      }
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}

export { LanguageToggle } from '../components/LanguageToggle';

