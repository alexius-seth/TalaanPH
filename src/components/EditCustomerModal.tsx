'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2, AlertCircle } from 'lucide-react';
import { ledgerService } from '../ledger';
import { isValidPHPhoneNumber } from './AddCustomerModal';
import { useLanguage } from '../i18n';
import type { Customer } from '../types';

interface EditCustomerModalProps {
  isOpen: boolean;
  customer: Customer;
  currentBalance: number;
  onClose: () => void;
  onCustomerUpdated: (updatedCustomer: Customer) => void;
  onCustomerArchived: (customerId: string) => void;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  customer,
  currentBalance,
  onClose,
  onCustomerUpdated,
  onCustomerArchived,
}) => {
  const { t } = useLanguage();
  const [nickname, setNickname] = useState(customer.nickname);
  const [firstName, setFirstName] = useState(customer.firstName);
  const [lastName, setLastName] = useState(customer.lastName);
  const [phoneNumber, setPhoneNumber] = useState(customer.phoneNumber);
  const [creditLimit, setCreditLimit] = useState(customer.creditLimit ? customer.creditLimit.toString() : '');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setNickname(customer.nickname);
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setPhoneNumber(customer.phoneNumber);
      setCreditLimit(customer.creditLimit ? customer.creditLimit.toString() : '');
      setErrorMsg('');
    }
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanNick = nickname.trim();
    if (!cleanNick) {
      setErrorMsg(t('requiredNickname'));
      return;
    }

    const cleanPhone = phoneNumber.trim().replace(/[\s-]/g, '');
    if (cleanPhone && !isValidPHPhoneNumber(cleanPhone)) {
      setErrorMsg(t('invalidPhone'));
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await ledgerService.updateCustomer(customer.id, {
        nickname: cleanNick,
        firstName: firstName.trim() || cleanNick,
        lastName: lastName.trim() || '',
        phoneNumber: cleanPhone || customer.phoneNumber,
        creditLimit: parseFloat(creditLimit) || 0,
      });

      onCustomerUpdated(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setErrorMsg('');
    if (currentBalance !== 0) {
      setErrorMsg(t('cannotArchiveDebt', { balance: currentBalance.toFixed(2) }));
      return;
    }

    const confirmed = window.confirm(t('archiveConfirm', { name: customer.nickname }));
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await ledgerService.archiveCustomer(customer.id);
      onCustomerArchived(customer.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error archiving customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl max-h-[90dvh] flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">{t('editCustomerTitle', { name: customer.nickname })}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 overscroll-contain pt-3 pb-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {t('nicknameLabel')}
            </label>
            <input
              type="text"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {t('firstNameLabel')}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {t('lastNameLabel')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {t('phoneLabel')}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {t('creditLimitLabel')}
            </label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder={t('noLimitHelp')}
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-gray-900"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? t('saving') : t('saveChanges')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-700 font-semibold rounded-xl text-xs transition"
            >
              {t('cancel')}
            </button>
          </div>
        </form>

        {/* Destructive Archive Section */}
        <div className="mt-6 pt-5 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-800">{t('archiveCustomerTitle')}</p>
              <p className="text-[11px] text-gray-500">
                {t('archiveCustomerHelp')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleArchive}
              disabled={isSubmitting || currentBalance !== 0}
              title={
                currentBalance !== 0
                  ? t('cannotArchiveDebt', { balance: currentBalance.toFixed(2) })
                  : t('archiveCustomerTitle')
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('archiveBtn')}</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

