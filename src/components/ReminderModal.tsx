'use client';

import React, { useState } from 'react';
import { X, Send, Clock, Check, MessageSquare } from 'lucide-react';
import { formatReminderText, dispatchReminderSms, type ReminderTone } from '../sms';
import { useLanguage } from '../i18n';

export interface ReminderCustomerItem {
  reminderId?: string;
  customer: {
    id: string;
    nickname: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  };
  balance: number;
  dueDate: string;
}

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerItem: ReminderCustomerItem;
  storeName?: string;
  dueItems?: ReminderCustomerItem[];
  onSelectCustomer?: (item: ReminderCustomerItem) => void;
  sentReminderIds?: Set<string>;
  onSent?: (reminderId?: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  customerItem,
  storeName = 'Talaan Store',
  dueItems,
  onSelectCustomer,
  sentReminderIds,
  onSent,
}) => {
  const { t, lang } = useLanguage();
  const [tone, setTone] = useState<ReminderTone>('friendly');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !customerItem) return null;

  const previewText = formatReminderText({
    storeName,
    nickname: customerItem.customer.nickname,
    balance: customerItem.balance,
    dueDate: customerItem.dueDate,
    phoneNumber: customerItem.customer.phoneNumber,
    lang,
    tone,
  });

  const charLength = previewText.length;
  const isSingleSegment = charLength <= 160;

  const handleSend = async () => {
    setIsSending(true);
    try {
      const dispatched = await dispatchReminderSms({
        storeName,
        nickname: customerItem.customer.nickname,
        balance: customerItem.balance,
        dueDate: customerItem.dueDate,
        phoneNumber: customerItem.customer.phoneNumber,
        lang,
        tone,
      });

      if (dispatched) {
        onSent?.(customerItem.reminderId);
      }
    } catch (err) {
      console.error('Failed to trigger SMS reminder:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-gray-900">{t('dueTodayTitle')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 active:scale-95 transition"
            title={t('cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer tabs (if multiple customers due) */}
        {dueItems && dueItems.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
            {dueItems.map((item) => {
              const isSelected = item.customer.id === customerItem.customer.id;
              const isSent = item.reminderId && sentReminderIds?.has(item.reminderId);
              return (
                <button
                  key={item.reminderId || item.customer.id}
                  onClick={() => onSelectCustomer?.(item)}
                  className={`px-3 py-1.5 rounded-xl text-left border shrink-0 transition text-xs ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/80 ring-1 ring-amber-500 font-bold'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{item.customer.nickname}</span>
                    {isSent && <Check className="w-3 h-3 text-emerald-600" />}
                  </div>
                  <span className="text-rose-600 font-extrabold block">
                    ₱{item.balance.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Customer Info Card */}
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs">
          <div>
            <span className="text-gray-500 text-[10px] block uppercase font-bold tracking-wider">
              {t('customerLabel')}
            </span>
            <span className="font-bold text-gray-900 text-sm">
              {customerItem.customer.nickname}{' '}
              {customerItem.customer.firstName ? `(${customerItem.customer.firstName})` : ''}
            </span>
            {customerItem.customer.phoneNumber && (
              <span className="text-gray-500 text-[11px] block">
                {customerItem.customer.phoneNumber}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-gray-500 text-[10px] block uppercase font-bold tracking-wider">
              {t('totalBalance')}
            </span>
            <span className="font-black text-rose-600 text-sm">
              ₱{customerItem.balance.toFixed(2)}
            </span>
            <span className="text-gray-400 text-[11px] block">Due: {customerItem.dueDate}</span>
          </div>
        </div>

        {/* Tone Selector: 3-way segment control */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700">{t('toneSelect')}</label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setTone('friendly')}
              className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition ${
                tone === 'friendly'
                  ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{t('toneFriendly')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTone('formal')}
              className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition ${
                tone === 'formal'
                  ? 'bg-white text-amber-800 shadow-xs border border-amber-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">{t('toneFormal')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTone('firm')}
              className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition ${
                tone === 'firm'
                  ? 'bg-white text-rose-800 shadow-xs border border-rose-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="truncate">{t('toneFirm')}</span>
            </button>
          </div>
        </div>

        {/* Live SMS Preview Box */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-700 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
              {t('smsPreview')}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  isSingleSegment ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {t('charCountLabel', { count: charLength })}
              </span>
              <span className="text-[10px] text-gray-400 hidden sm:inline">
                {t('singleSegmentBadge')}
              </span>
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 shadow-inner">
            <pre className="whitespace-pre-wrap font-sans text-xs text-gray-800 leading-relaxed break-words">
              {previewText}
            </pre>
          </div>
          <span className="text-[11px] text-gray-400 block">{t('smsNotice')}</span>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition text-sm"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? '...' : t('sendViaSim')}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition"
          >
            {t('doneClose')}
          </button>
        </div>
      </div>
    </div>
  );
};
