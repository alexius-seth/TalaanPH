'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Search, UserPlus, Phone, CreditCard, ChevronRight, Pencil } from 'lucide-react';
import { db } from '../db';
import { ledgerService } from '../ledger';
import type { Customer } from '../types';

export interface CustomerWithBalance extends Customer {
  balance: number;
}

interface CustomerListProps {
  onSelectCustomer: (customer: Customer, balance: number) => void;
  onAddNewCustomer: () => void;
  onEditCustomer?: (customer: Customer, balance: number) => void;
  selectedCustomerId?: string;
  refreshKey?: number;
  onCustomersLoaded?: (customers: CustomerWithBalance[]) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  onSelectCustomer,
  onAddNewCustomer,
  onEditCustomer,
  selectedCustomerId,
  refreshKey = 0,
  onCustomersLoaded,
}) => {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const all = await db.customers.toArray();
        const records = all.filter((c) => c.isActive !== false);
        const withBalances: CustomerWithBalance[] = await Promise.all(
          records.map(async (c) => {
            const balance = await ledgerService.getCustomerBalance(c.id);
            return { ...c, balance };
          })
        );
        if (isMounted) {
          setCustomers(withBalances);
          onCustomersLoaded?.(withBalances);
        }
      } catch (err) {
        console.error('Failed to load customers:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.nickname.toLowerCase().includes(q) ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.phoneNumber.includes(q)
    );
  }, [customers, searchTerm]);

  return (
    <div className="w-full space-y-3">
      {/* Top Search & Add Row */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hanapin si Suki (Aling Nena, Carding)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
          />
        </div>
        <button
          onClick={onAddNewCustomer}
          className="p-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-xs transition shrink-0"
          title="Magdagdag ng Suki"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Suki Cards */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-gray-400">Kinukuha ang talaan...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300 p-6 shadow-xs">
            <p className="text-sm font-semibold text-gray-700">Walang natagpuang suki</p>
            <p className="text-xs text-gray-400 mt-1 mb-3">Magsimula sa pamamagitan ng paglista sa unang suki</p>
            <button
              onClick={onAddNewCustomer}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Ilista bilang bagong suki</span>
            </button>
          </div>
        ) : (
          filtered.map((customer) => {
            const isSelected = selectedCustomerId === customer.id;
            return (
              <button
                key={customer.id}
                onClick={() => onSelectCustomer(customer, customer.balance)}
                className={`w-full text-left rounded-xl p-3 shadow-xs border transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-white border-gray-200 hover:border-gray-300 active:bg-gray-50'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{customer.nickname}</h4>
                    <span className="text-xs text-gray-400">
                      ({customer.firstName} {customer.lastName})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      {customer.phoneNumber}
                    </span>
                    {customer.creditLimit > 0 && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-gray-400" />
                        Limit: ₱{customer.creditLimit}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] block text-gray-400 font-medium">Utang</span>
                    <span
                      className={`font-black text-sm ${
                        customer.balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      ₱{customer.balance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {onEditCustomer && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCustomer(customer, customer.balance);
                        }}
                        title="I-edit si Suki"
                        className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg active:scale-90 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-gray-300'}`} />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
