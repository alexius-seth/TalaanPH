'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { db } from '../db';
import { ledgerService } from '../ledger';
import { ReminderModal } from './ReminderModal';
import { useLanguage } from '../i18n';
import type { Customer, PaymentReminder } from '../types';

interface DueCustomerItem {
  reminder: PaymentReminder;
  customer: Customer;
  balance: number;
}

interface DueTodayBannerProps {
  storeName: string;
  refreshKey?: number;
  onReminderSent?: () => void;
}

export const DueTodayBanner: React.FC<DueTodayBannerProps> = ({
  storeName,
  refreshKey = 0,
  onReminderSent,
}) => {
  const { t, lang } = useLanguage();
  const [dueItems, setDueItems] = useState<DueCustomerItem[]>([]);
  const [isOpenDialog, setIsOpenDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DueCustomerItem | null>(null);
  const [sentReminderIds, setSentReminderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const pendingReminders = await db.paymentReminders
          .where('status')
          .equals('PENDING')
          .filter((r) => r.dueDate <= todayStr)
          .toArray();

        if (pendingReminders.length === 0) {
          if (isMounted) setDueItems([]);
          return;
        }

        const items: DueCustomerItem[] = [];
        for (const rem of pendingReminders) {
          const customer = await db.customers.get(rem.customerId);
          if (!customer || !customer.isActive) continue;

          const balance = await ledgerService.getCustomerBalance(customer.id);
          if (balance > 0) {
            items.push({ reminder: rem, customer, balance });
          } else {
            // Settle reminder if debt is already 0
            await db.paymentReminders.update(rem.id, { status: 'SETTLED' });
          }
        }

        if (isMounted) {
          setDueItems(items);
          if (items.length > 0 && !selectedItem) {
            setSelectedItem(items[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load due reminders:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  if (dueItems.length === 0) return null;

  const activeTarget = selectedItem || dueItems[0];

  const handleReminderSent = async (reminderId?: string) => {
    if (reminderId) {
      await db.paymentReminders.update(reminderId, {
        status: 'REMINDED',
        remindedAt: new Date().toISOString(),
      });
      setSentReminderIds((prev) => new Set(prev).add(reminderId));
      onReminderSent?.();
    }
  };

  return (
    <>
      {/* Top Banner Alert Bar */}
      <div className="w-full bg-amber-500 text-amber-950 px-3 sm:px-4 py-2 text-xs font-bold shadow-xs flex items-center justify-between gap-2 transition animate-in fade-in overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-amber-950 shrink-0" />
          <span className="truncate">
            ⚠️ {t('dueTodayDesc', { count: dueItems.length })}
          </span>
        </div>
        <button
          onClick={() => setIsOpenDialog(true)}
          className="px-2 sm:px-2.5 py-1 bg-amber-950 text-amber-100 hover:bg-black active:scale-95 text-[11px] font-extrabold rounded-lg transition shrink-0"
        >
          {t('viewDue')}
        </button>
      </div>

      {/* Reminder Dialog / Modal with Tone Selection */}
      {activeTarget && (
        <ReminderModal
          isOpen={isOpenDialog}
          onClose={() => setIsOpenDialog(false)}
          customerItem={{
            reminderId: activeTarget.reminder.id,
            customer: activeTarget.customer,
            balance: activeTarget.balance,
            dueDate: activeTarget.reminder.dueDate,
          }}
          storeName={storeName}
          dueItems={dueItems.map((item) => ({
            reminderId: item.reminder.id,
            customer: item.customer,
            balance: item.balance,
            dueDate: item.reminder.dueDate,
          }))}
          onSelectCustomer={(item) => {
            const found = dueItems.find((d) => d.reminder.id === item.reminderId);
            if (found) setSelectedItem(found);
          }}
          sentReminderIds={sentReminderIds}
          onSent={handleReminderSent}
        />
      )}
    </>
  );
};

