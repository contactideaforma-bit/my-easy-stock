import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans' });
const display = Fraunces({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'My Assistanad',
  description: 'Votre assistante de cabinet : clients, demandes, rendez-vous, tâches et relances de paiement automatiques.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'My Assistanad' },
};

export const viewport: Viewport = {
  themeColor: '#f6f5f1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
