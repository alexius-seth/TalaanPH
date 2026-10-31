'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '../i18n';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className = '' }: LanguageToggleProps) {
  const { lang, setLang } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeLang = mounted ? lang : 'tl';

  return (
    <div
      className={`inline-flex items-center bg-emerald-800/80 p-0.5 rounded-lg border border-emerald-500/50 text-xs font-bold shadow-xs ${className}`}
      role="group"
      aria-label="Language selector"
      suppressHydrationWarning
    >
      <button
        type="button"
        onClick={() => setLang('tl')}
        className={`px-2 py-1 rounded-md text-[11px] font-extrabold transition-all duration-150 ${
          activeLang === 'tl'
            ? 'bg-white text-emerald-800 shadow-sm'
            : 'text-emerald-100 hover:text-white hover:bg-emerald-700/50'
        }`}
        title="Tagalog"
      >
        TL
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2 py-1 rounded-md text-[11px] font-extrabold transition-all duration-150 ${
          activeLang === 'en'
            ? 'bg-white text-emerald-800 shadow-sm'
            : 'text-emerald-100 hover:text-white hover:bg-emerald-700/50'
        }`}
        title="English"
      >
        EN
      </button>
    </div>
  );
}

export default LanguageToggle;

