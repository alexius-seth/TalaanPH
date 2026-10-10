'use client';

import React, { useState } from 'react';
import { X, PlusCircle, MinusCircle, AlertTriangle } from 'lucide-react';
import { ledgerService } from '../ledger';
import type { Customer, TransactionType } from '../types';
import type { ReceiptParams } from '../sms';

interface TransactionModalProps {
  isOpen: boolean;
  customer: Customer;
  currentBalance: number;
  storeName?: string;
  onClose: () => void;
  onSuccess: (receipt: ReceiptParams) => void;
}

const UTANG_PRESETS = [
  { name: 'Kape', price: 20 },
  { name: 'Canton', price: 35 },
  { name: 'Itlog', price: 12 },
  { name: 'Bigas 1kg', price: 55 },
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  customer,
  currentBalance,
  storeName = 'Sari-Sari Store',
  onClose,
  onSuccess,
}) => {
  const [txnType, setTxnType] = useState<TransactionType>('CREDIT_PURCHASE');
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const numericAmount = parseFloat(amountStr) || 0;
  const projectedBalance =
    txnType === 'CREDIT_PURCHASE'
      ? currentBalance + numericAmount
      : Math.max(0, currentBalance - numericAmount);

  const isOverLimit =
    customer.creditLimit > 0 &&
    txnType === 'CREDIT_PURCHASE' &&
    projectedBalance > customer.creditLimit;

  const handleApplyPreset = (price: number, name?: string) => {
    setAmountStr((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + price).toFixed(2);
    });
    if (name) {
      setDescription((prev) => (prev ? `${prev}, ${name}` : name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setErrorMsg('Maglagay ng tamang halaga.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await ledgerService.recordTransaction({
        type: txnType,
        customerId: customer.id,
        amount: numericAmount,
        description: description.trim() || undefined,
      });

      onSuccess({
        storeName,
        nickname: customer.nickname,
        refNumber: result.transaction.referenceNumber,
        type: txnType === 'CREDIT_PURCHASE' ? 'Utang' : 'Bayad',
        amount: numericAmount,
        balance: result.newBalance,
        phoneNumber: customer.phoneNumber,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Pumalya ang transaksyon.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{customer.nickname}</h3>
            <p className="text-xs text-gray-500">
              {customer.firstName} {customer.lastName} • {customer.phoneNumber}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setTxnType('CREDIT_PURCHASE');
              setErrorMsg('');
            }}
            className={`py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              txnType === 'CREDIT_PURCHASE'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Bagong Utang</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTxnType('PAYMENT');
              setErrorMsg('');
            }}
            className={`py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              txnType === 'PAYMENT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MinusCircle className="w-4 h-4" />
            <span>Bayad</span>
          </button>
        </div>

        {/* Live balance indicator */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-200 flex justify-between items-center text-sm">
          <div>
            <span className="text-gray-500 text-xs block">Kasalukuyan:</span>
            <span className="font-semibold text-gray-800">₱{currentBalance.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500 text-xs block">Bagong Balanse:</span>
            <span
              className={`font-bold ${
                txnType === 'CREDIT_PURCHASE' ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              ₱{projectedBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {isOverLimit && (
          <div className="flex items-center gap-2 p-2.5 mb-4 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Lalagpas sa credit limit na ₱{customer.creditLimit.toFixed(2)}</span>
          </div>
        )}

        {/* Amount Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Halaga (₱)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full text-2xl font-bold py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Quick preset chips */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {txnType === 'CREDIT_PURCHASE' ? 'Madalas utangin:' : 'Mabilisang bayad:'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {txnType === 'CREDIT_PURCHASE' ? (
                UTANG_PRESETS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleApplyPreset(item.price, item.name)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-xs font-semibold rounded-lg text-gray-800 transition"
                  >
                    +{item.name} (₱{item.price})
                  </button>
                ))
              ) : (
                <>
                  {[50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountStr(amt.toFixed(2))}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 active:scale-95 text-xs font-semibold rounded-lg transition"
                    >
                      ₱{amt}
                    </button>
                  ))}
                  {currentBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmountStr(currentBalance.toFixed(2))}
                      className="px-3 py-1.5 bg-emerald-700 text-white active:scale-95 text-xs font-bold rounded-lg transition"
                    >
                      Buo (₱{currentBalance.toFixed(2)})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Optional item/note description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Deskripsyon / Tindang Kinuha (Opsyonal)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="hal. 2 sardinas, 1 coke sakto"
              className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {errorMsg && <p className="text-xs text-rose-600 font-semibold">{errorMsg}</p>}

          <button
            type="submit"
            disabled={isSubmitting || numericAmount <= 0}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-md transition active:scale-98 disabled:opacity-50 text-base ${
              txnType === 'CREDIT_PURCHASE'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSubmitting ? 'Itinatala...' : 'Itala ang Transaksyon'}
          </button>
        </form>
      </div>
    </div>
  );
};

