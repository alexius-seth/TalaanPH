import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '../i18n';

export const metadata: Metadata = {
  title: 'Talaan - Tindahan Ledger',
  description: 'Offline-First Micro-Credit and Inventory para sa Sari-Sari Stores',
  manifest: '/manifest.json',
  icons: {
    apple: '/icons/icon-192x192.png',
  },
  other: {
    google: 'notranslate',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Talaan',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tl" translate="no" className="notranslate" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 select-none notranslate" suppressHydrationWarning>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

