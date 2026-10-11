'use client';

import React, { useEffect, useState } from 'react';
import { Phone, CreditCard, PlusCircle, MinusCircle, Clock, Receipt, AlertTriangle, Pencil } from 'lucide-react';
import { db } from '../db';
import { getCustomerAccountCode } from '../ledger';
import type { Customer, TransactionType } from '../types';

interface CustomerDetailProps {
  customer: Customer;
  balance: number;
  refreshKey?: number;
  onOpenTransaction: (initialType: TransactionType) => void;
  onEditCustomer?: (customer: Customer) => void;
}

interface TimelineItem {
  id: string;
  referenceNumber: string;
  type: TransactionType;
  amount: number;
  description?: string;
  createdAt: string;
  direction: 'DEBIT' | 'CREDIT';
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({
  customer,
  balance,
  refreshKey = 0,
  onOpenTransaction,
  onEditCustomer,
}) => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const arCode = getCustomerAccountCode(customer.id);
        const account = await db.accounts.where('code').equals(arCode).first();
        if (!account) {
          if (isMounted) setTimeline([]);
          return;
        }

        const entries = await db.ledgerEntries.where('accountId').equals(account.id).toArray();
        const txnIds = entries.map((e) => e.transactionId);
        const txns = await db.transactions.where('id').anyOf(txnIds).toArray();
        const txnMap = new Map(txns.map((t) => [t.id, t]));

        const items: TimelineItem[] = entries.map((entry) => {
          const txn = txnMap.get(entry.transactionId);
          return {
            id: entry.id,
            referenceNumber: txn?.referenceNumber ?? 'N/A',
            type: txn?.type ?? 'CREDIT_PURCHASE',
            amount: entry.amount,
            description: txn?.description,
            createdAt: txn?.createdAt ?? entry.createdAt,
            direction: entry.direction,
          };
        });

        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (isMounted) setTimeline(items);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [customer.id, refreshKey]);

  const limitPercentage =
    customer.creditLimit > 0
      ? Math.min(100, Math.round((balance / customer.creditLimit) * 100))
      : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
      {/* Suki Overview Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black text-gray-900">{customer.nickname}</h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Aktibo
            </span>
            {onEditCustomer && (
              <button
                onClick={() => onEditCustomer(customer)}
                title="I-edit si Suki"
                className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg active:scale-95 transition"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {customer.firstName} {customer.lastName}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1 font-medium">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              {customer.phoneNumber}
            </span>
            {customer.creditLimit > 0 && (
              <span className="flex items-center gap-1 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                Limit: ₱{customer.creditLimit.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onOpenTransaction('CREDIT_PURCHASE')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Bagong Utang</span>
          </button>
          <button
            onClick={() => onOpenTransaction('PAYMENT')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-xs transition"
          >
            <MinusCircle className="w-4 h-4" />
            <span>Magbayad</span>
          </button>
        </div>
      </div>

      {/* Balance & Credit Limit Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Kasalukuyang Utang
          </span>
          <span
            className={`text-3xl font-black mt-1 block ${
              balance > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            ₱{balance.toFixed(2)}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-gray-500 uppercase tracking-wider">Credit Limit Status</span>
            <span className="text-gray-700 font-bold">
              {customer.creditLimit > 0
                ? `${limitPercentage}% (₱${balance.toFixed(0)} / ₱${customer.creditLimit.toFixed(0)})`
                : 'Walang Limit'}
            </span>
          </div>
          {customer.creditLimit > 0 ? (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    limitPercentage >= 100
                      ? 'bg-rose-600'
                      : limitPercentage >= 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${limitPercentage}%` }}
                />
              </div>
              {limitPercentage >= 100 && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold mt-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Abot o lampas na sa itinakdang limit</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 mt-2">Maaaring mag-pautang nang walang limit.</span>
          )}
        </div>
      </div>

      {/* Ledger Transaction Timeline */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-800">Talaan ng mga Transaksyon</h3>
          </div>
          <span className="text-xs text-gray-400 font-medium">{timeline.length} transaksyon</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-xs text-gray-400">Kinukuha ang kasaysayan...</div>
        ) : timeline.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
            Wala pang naitatalang utang o bayad para kay {customer.nickname}.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
            {timeline.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        item.direction === 'DEBIT'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {item.direction === 'DEBIT' ? 'UTANG' : 'BAYAD'}
                    </span>
                    <span className="font-mono text-gray-400 text-[11px]">{item.referenceNumber}</span>
                  </div>
                  {item.description && (
                    <p className="text-gray-600 font-medium">{item.description}</p>
                  )}
                  <span className="text-[10px] text-gray-400 block">
                    {new Date(item.createdAt).toLocaleString('tl-PH', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`font-black text-sm block ${
                      item.direction === 'DEBIT' ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {item.direction === 'DEBIT' ? '+' : '-'}₱{item.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

