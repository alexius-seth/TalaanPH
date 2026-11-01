'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Delete, ArrowRight, Store, ShieldCheck, AlertCircle } from 'lucide-react';
import { getStoreSettings } from '../settings';
import { hashPin } from '../lib/hash';
import { useLanguage, LanguageToggle } from '../i18n';

interface PinLockScreenProps {
  storeName?: string;
  onUnlocked: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  storeName: initialStoreName,
  onUnlocked,
}) => {
  const { t } = useLanguage();
  const [storeName, setStoreName] = useState(initialStoreName || 'Talaan Store');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getStoreSettings().then((s) => {
      if (s?.storeName) setStoreName(s.storeName);
    });
    inputRef.current?.focus();
  }, []);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setPin('');
    setTimeout(() => setIsShaking(false), 500);
    inputRef.current?.focus();
  };

  const handleVerifyPin = async (candidatePin: string) => {
    if (candidatePin.length < 4) {
      triggerError(t('incorrectPin'));
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const settings = await getStoreSettings();
      const hashed = hashPin(candidatePin);

      if (hashed === settings.pinHash) {
        onUnlocked();
      } else {
        triggerError(t('incorrectPin'));
      }
    } catch {
      triggerError(t('incorrectPin'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const next = pin + num;
      setPin(next);
      setErrorMsg('');
      if (next.length >= 4 && next.length <= 6) {
        // Can be manually submitted or automatic on 4/6
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
    inputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleVerifyPin(pin);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 text-white p-6 select-none overflow-y-auto"
      suppressHydrationWarning
    >
      {/* Top Bar with Language Toggle */}
      <div className="w-full max-w-sm flex justify-between items-center pt-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-700/80 rounded-lg">
            <Lock className="w-4 h-4 text-emerald-200" />
          </div>
          <span className="text-xs font-semibold text-emerald-200 tracking-wider uppercase">
            {t('lockedStatus')}
          </span>
        </div>
        <LanguageToggle />
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-sm flex flex-col items-center my-auto py-4">
        <div className="p-4 bg-emerald-700/50 rounded-3xl border border-emerald-500/30 shadow-xl mb-3 flex items-center justify-center">
          <Store className="w-10 h-10 text-emerald-200" />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-black tracking-widest text-emerald-200">TALAAN</span>
          <span className="text-[10px] font-bold bg-emerald-800 text-emerald-100 px-1.5 py-0.2 rounded">PWA</span>
        </div>

        <h1 className="text-base font-bold text-white/90 text-center tracking-tight" suppressHydrationWarning>
          {storeName}
        </h1>
        <p className="text-xs text-emerald-200/90 text-center mt-1 mb-6">
          {t('lockScreenSubtitle')}
        </p>

        {/* Hidden keyboard input for physical typing */}
        <form onSubmit={handleFormSubmit} className="w-full flex flex-col items-center">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setPin(val);
              setErrorMsg('');
            }}
            className="sr-only"
          />

          {/* Masked PIN Dots Indicator */}
          <div
            onClick={() => inputRef.current?.focus()}
            className={`flex items-center justify-center gap-3 py-3 px-6 bg-emerald-950/40 border border-emerald-600/40 rounded-2xl cursor-pointer transition ${
              isShaking ? 'animate-bounce border-red-400 bg-red-950/40' : ''
            }`}
          >
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const filled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    filled
                      ? 'bg-emerald-300 scale-110 shadow-sm shadow-emerald-400/50'
                      : 'border-2 border-emerald-500/50 bg-transparent'
                  }`}
                />
              );
            })}
          </div>

          {errorMsg ? (
            <div className="flex items-center gap-1.5 text-xs text-red-300 font-semibold mt-3 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <span className="text-[11px] text-emerald-300/70 mt-3">
              {t('enterPinPrompt')}
            </span>
          )}

          {/* On-Screen Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mt-6">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-14 rounded-2xl bg-emerald-800/60 hover:bg-emerald-700/80 active:bg-emerald-600 text-xl font-bold text-white shadow-sm border border-emerald-600/30 flex items-center justify-center transition active:scale-95"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-2xl bg-emerald-900/40 hover:bg-emerald-800/60 active:bg-emerald-700 text-xs font-semibold text-emerald-200 border border-emerald-700/30 flex items-center justify-center transition active:scale-95"
            >
              C
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 rounded-2xl bg-emerald-800/60 hover:bg-emerald-700/80 active:bg-emerald-600 text-xl font-bold text-white shadow-sm border border-emerald-600/30 flex items-center justify-center transition active:scale-95"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="h-14 rounded-2xl bg-emerald-900/40 hover:bg-emerald-800/60 active:bg-emerald-700 text-white border border-emerald-700/30 flex items-center justify-center transition active:scale-95"
              title="Delete"
            >
              <Delete className="w-5 h-5 text-emerald-200" />
            </button>
          </div>

          {/* Unlock Submit Button */}
          <button
            type="submit"
            disabled={pin.length < 4 || isVerifying}
            className="w-full max-w-[280px] mt-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-emerald-500 text-emerald-950 font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"
          >
            <span>{isVerifying ? '...' : t('unlockBtn')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="w-full max-w-sm text-center py-2">
        <p className="text-[10px] text-emerald-300/50 tracking-wider">
          TALAAN POS & LEDGER • OFFLINE-FIRST
        </p>
      </div>
    </div>
  );
};

