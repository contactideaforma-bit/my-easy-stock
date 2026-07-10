import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'My Easy Stock',
  description: 'Gestion de stock textile & chaussures — simple, mobile, indispensable.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'My Easy Stock' },
};

export const viewport: Viewport = {
  themeColor: '#e8f4fd',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={jakarta.className}>
        <div className="liquid-bg" />
        {children}
      </body>
    </html>
  );
}
