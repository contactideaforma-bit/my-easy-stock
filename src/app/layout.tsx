import type { Metadata, Viewport } from 'next';
import './globals.css';

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
      <body>
        <div className="liquid-bg" />
        {children}
      </body>
    </html>
  );
}
