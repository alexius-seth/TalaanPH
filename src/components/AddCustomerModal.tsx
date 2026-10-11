'use client';

import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { ledgerService } from '../ledger';
import type { Customer } from '../types';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
}

export function isValidPHPhoneNumber(phone: string): boolean {
  const cleaned = phone.trim().replace(/[\s-]/g, '');
  return /^(09|\+639)\d{9}$/.test(cleaned);
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerCreated,
}) => {
  const [nickname, setNickname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanNick = nickname.trim();
    if (!cleanNick) {
      setErrorMsg('Kailangan ang palayaw o nickname ni suki.');
      return;
    }

    const cleanPhone = phoneNumber.trim().replace(/[\s-]/g, '');
    if (!isValidPHPhoneNumber(cleanPhone)) {
      setErrorMsg('Maling numero. Gamitin ang 09xxxxxxxxx o +639xxxxxxxxx.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCustomer = await ledgerService.createCustomer({
        nickname: cleanNick,
        firstName: firstName.trim() || cleanNick,
        lastName: lastName.trim() || '',
        phoneNumber: cleanPhone,
        creditLimit: parseFloat(creditLimit) || 0,
      });

      onCustomerCreated(newCustomer);
      onClose();
      // Reset form
      setNickname('');
      setFirstName('');
      setLastName('');
      setPhoneNumber('');
      setCreditLimit('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Hindi maitala ang suki.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Bagong Suki</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prominent Nickname */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Palayaw / Nickname *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="hal. Aling Nena, Kuya Carding"
              className="w-full text-lg font-bold py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pangalan</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Elena"
                className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apelyido</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Santos"
                className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Cellphone Number *</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="09171234567 o +639171234567"
              className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Credit Limit (₱) — 0 kung walang limit
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="0.00"
              className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {errorMsg && <p className="text-xs text-rose-600 font-semibold">{errorMsg}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 text-base"
          >
            {isSubmitting ? 'Inililista...' : 'Ilista si Suki'}
          </button>
        </form>
      </div>
    </div>
  );
};

