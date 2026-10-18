import './globals.css';
import type { Metadata, Viewport } from 'next';
import Liquid from '@/components/Liquid';

export const metadata: Metadata = {
  title: 'MyEasy SEO',
  description: 'Audit, suivi de mots-clés et assistant IA pour le référencement des sites IDEA et de ses clients.',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#eef0fb', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Liquid />
        {children}
      </body>
    </html>
  );
}
