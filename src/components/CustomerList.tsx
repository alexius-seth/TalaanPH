'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Search, UserPlus, Phone, CreditCard, ChevronRight } from 'lucide-react';
import { db } from '../db';
import { ledgerService } from '../ledger';
import type { Customer } from '../types';

interface CustomerWithBalance extends Customer {
  balance: number;
}

interface CustomerListProps {
  onSelectCustomer: (customer: Customer, balance: number) => void;
  onAddNewCustomer: () => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  onSelectCustomer,
  onAddNewCustomer,
}) => {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const records = await db.customers.where('isActive').equals(1).toArray();
      const withBalances: CustomerWithBalance[] = await Promise.all(
        records.map(async (c) => {
          const balance = await ledgerService.getCustomerBalance(c.id);
          return { ...c, balance };
        })
      );
      setCustomers(withBalances);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

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
    <div className="w-full max-w-lg mx-auto p-4 space-y-4">
      {/* Top action row */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hanapin si Suki (Aling Nena, Carding)..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        <button
          onClick={onAddNewCustomer}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow transition"
          title="Magdagdag ng Suki"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Customer items */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-gray-400">Kinukuha ang talaan...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-sm font-semibold text-gray-600">Walang natagpuang suki</p>
            <button
              onClick={onAddNewCustomer}
              className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
            >
              + Ilista bilang bagong suki
            </button>
          </div>
        ) : (
          filtered.map((customer) => (
            <button
              key={customer.id}
              onClick={() => onSelectCustomer(customer, customer.balance)}
              className="w-full text-left bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm active:bg-gray-50 flex items-center justify-between transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-gray-900 text-base">{customer.nickname}</h4>
                  <span className="text-xs text-gray-500">
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

              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <span className="text-[11px] block text-gray-400 font-medium">Utang</span>
                  <span
                    className={`font-bold text-sm ${
                      customer.balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    ₱{customer.balance.toFixed(2)}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

