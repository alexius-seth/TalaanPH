'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Send, X, Check, Clock } from 'lucide-react';
import { db } from '../db';
import { ledgerService } from '../ledger';
import { dispatchReminderSms, formatReminderText } from '../sms';
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

  const handleSendReminder = async () => {
    if (!activeTarget) return;

    const dispatched = await dispatchReminderSms({
      storeName,
      nickname: activeTarget.customer.nickname,
      balance: activeTarget.balance,
      dueDate: activeTarget.reminder.dueDate,
      phoneNumber: activeTarget.customer.phoneNumber,
    });

    if (dispatched) {
      await db.paymentReminders.update(activeTarget.reminder.id, {
        status: 'REMINDED',
        remindedAt: new Date().toISOString(),
      });
      setSentReminderIds((prev) => new Set(prev).add(activeTarget.reminder.id));
      onReminderSent?.();
    }
  };

  return (
    <>
      {/* Top Banner Alert Bar */}
      <div className="w-full bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold shadow-xs flex items-center justify-between transition animate-in fade-in">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-950 shrink-0" />
          <span>
            ⚠️ {dueItems.length} suki ang dapat singilin ngayong araw ({new Date().toLocaleDateString('tl-PH', { month: 'short', day: 'numeric' })})
          </span>
        </div>
        <button
          onClick={() => setIsOpenDialog(true)}
          className="px-2.5 py-1 bg-amber-950 text-amber-100 hover:bg-black active:scale-95 text-[11px] font-extrabold rounded-lg transition"
        >
          Tingnan / Singilin
        </button>
      </div>

      {/* Reminder Dialog / Modal */}
      {isOpenDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-gray-900">Mga Suking Dapat Singilin</h3>
              </div>
              <button
                onClick={() => setIsOpenDialog(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of due customers */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dueItems.map((item) => {
                const isSelected = activeTarget.reminder.id === item.reminder.id;
                const isSent = sentReminderIds.has(item.reminder.id);
                return (
                  <button
                    key={item.reminder.id}
                    onClick={() => setSelectedItem(item)}
                    className={`px-3 py-2 rounded-xl text-left border shrink-0 transition text-xs ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 ring-1 ring-amber-500 font-bold'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{item.customer.nickname}</span>
                      {isSent && <Check className="w-3 h-3 text-emerald-600" />}
                    </div>
                    <span className="text-rose-600 font-extrabold block">₱{item.balance.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>

            {/* SMS Preview Card */}
            {activeTarget && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 font-mono text-xs text-gray-800 space-y-2">
                <div className="flex justify-between text-gray-500 text-[11px] pb-1 border-b border-amber-200">
                  <span>Suki: {activeTarget.customer.firstName} ({activeTarget.customer.phoneNumber})</span>
                  <span>Due: {activeTarget.reminder.dueDate}</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs text-gray-800 leading-relaxed">
                  {formatReminderText({
                    storeName,
                    nickname: activeTarget.customer.nickname,
                    balance: activeTarget.balance,
                    dueDate: activeTarget.reminder.dueDate,
                  })}
                </pre>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleSendReminder}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold rounded-xl shadow-md transition text-sm"
              >
                <Send className="w-4 h-4" />
                <span>I-text ang Paalala (Libre via SIM)</span>
              </button>

              <button
                onClick={() => setIsOpenDialog(false)}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition"
              >
                Isara
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

