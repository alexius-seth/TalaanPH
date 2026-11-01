'use client';

import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { getStoreSettings, updateStoreSettings } from '../settings';
import { useLanguage } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (newStoreName: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { t } = useLanguage();
  const [storeName, setStoreName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setNewPin('');
      setCurrentPin('');
      void getStoreSettings().then((s) => {
        setStoreName(s.storeName);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPin.trim()) {
      setErrorMsg(t('currentPinHelp'));
      return;
    }

    if (newPin.trim() && !/^\d{4,6}$/.test(newPin.trim())) {
      setErrorMsg(t('pinLengthError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateStoreSettings({
        storeName: storeName.trim(),
        newPin: newPin.trim() || undefined,
        currentPin: currentPin.trim(),
      });

      setSuccessMsg(t('settingsSaved'));
      onSaved?.(updated.storeName);
      setNewPin('');
      setCurrentPin('');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || t('invalidCurrentPin'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('settingsTitle')}</h3>
              <p className="text-xs text-gray-500">{t('defaultPinHelp')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 active:scale-95 transition"
            title={t('cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('storeNameLabel')}
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Hal. Aling Nena Tindahan"
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-gray-800">Store PIN Protection</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('newPinLabel')}
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none tracking-widest"
                placeholder="4-6 digits"
              />
              <span className="text-[11px] text-gray-400 block mt-0.5">
                {t('newPinPlaceholder')}
              </span>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('currentPinLabel')}
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none tracking-widest"
                placeholder={t('currentPinPlaceholder')}
              />
              <span className="text-[11px] text-gray-500 block mt-0.5">
                {t('currentPinHelp')}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 rounded-xl transition shadow-xs"
            >
              {isSubmitting ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

