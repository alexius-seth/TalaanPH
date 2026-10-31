import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '../i18n';

export const metadata: Metadata = {
  title: 'Talaan - Tindahan Ledger',
  description: 'Offline-First Micro-Credit and Inventory para sa Sari-Sari Stores',
  manifest: '/manifest.json',
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
      <head>
        <meta name="google" content="notranslate" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="antialiased bg-slate-50 select-none notranslate" suppressHydrationWarning>
        <LanguageProvider>
          {children}
        </LanguageProvider>
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.warn('[PWA] Service worker registration failed:', err);
                    });
                  });
                }
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}

