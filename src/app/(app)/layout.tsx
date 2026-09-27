'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CabinetProvider, useCabinet } from '@/components/Cabinet';
import Logo from '@/components/Logo';
import Modal from '@/components/Modal';
import { AppointmentForm, RequestForm, TaskForm } from '@/components/Forms';
import {
  IconBell, IconCalendar, IconEuro, IconInbox, IconList, IconLogout, IconMenu, IconPlus,
  IconSettings, IconSun, IconUsers, IconX,
} from '@/components/Icons';

type NavItem = { href: string; label: string; icon: (p: { className?: string }) => JSX.Element };

const NAV: NavItem[] = [
  { href: '/app', label: 'Ma journée', icon: IconSun },
  { href: '/sollicitations', label: 'Demandes', icon: IconInbox },
  { href: '/taches', label: 'Tâches', icon: IconList },
  { href: '/agenda', label: 'Agenda', icon: IconCalendar },
  { href: '/clients', label: 'Clients', icon: IconUsers },
  { href: '/factures', label: 'Factures', icon: IconEuro },
  { href: '/relances', label: 'Relances', icon: IconBell },
];
const MOBILE = ['/app', '/sollicitations', '/taches', '/factures'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
      else setUserId(data.session.user.id);
    });
    const { data: sub } = supabase().auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const onMissing = useCallback(() => router.replace('/bienvenue'), [router]);

  if (!userId) return <div className="min-h-dvh" />;
  return (
    <CabinetProvider userId={userId} onMissing={onMissing}>
      <Shell>{children}</Shell>
    </CabinetProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { cabinet, me } = useCabinet();
  const [menu, setMenu] = useState(false);
  const [quick, setQuick] = useState<null | 'menu' | 'request' | 'task' | 'appt'>(null);
  const active = (href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href));

  useEffect(() => setMenu(false), [pathname]);

  // Raccourci clavier « N » : nouvelle demande (capture éclair pendant un appel)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setQuick('request'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const extra: NavItem[] = [
    ...(me.role === 'titulaire' ? [{ href: '/equipe', label: 'Équipe', icon: IconUsers }] : []),
    { href: '/parametres', label: 'Paramètres', icon: IconSettings },
  ];

  const sideLinks = (
    <>
      {[...NAV, ...extra].map((n) => {
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${active(n.href) ? 'bg-white text-ink shadow-card border border-paper-line' : 'text-ink-soft hover:bg-white/60'}`}>
            <Icon className={`w-[18px] h-[18px] ${active(n.href) ? 'text-sage-600' : ''}`} />{n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barre latérale ordinateur */}
      <aside className="hidden lg:flex no-print flex-col w-64 shrink-0 h-dvh sticky top-0 border-r border-paper-line bg-paper-deep/60 p-4">
        <div className="px-2 py-2"><Logo /></div>
        <p className="px-3 mt-1 text-xs text-ink-mute truncate">{cabinet.name}</p>
        <button onClick={() => setQuick('menu')} className="btn-primary mt-5 mb-4"><IconPlus className="w-4 h-4" />Noter quelque chose</button>
        <nav className="flex-1 space-y-1 overflow-y-auto">{sideLinks}</nav>
        <UserBox />
      </aside>

      {/* En-tête mobile */}
      <header className="lg:hidden no-print sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-paper/90 backdrop-blur border-b border-paper-line">
        <Logo />
        <button onClick={() => setMenu(true)} className="p-2 -mr-2 rounded-lg hover:bg-paper-deep" aria-label="Menu"><IconMenu /></button>
      </header>

      {menu && (
        <div className="lg:hidden fixed inset-0 z-50 bg-ink/30" onClick={() => setMenu(false)}>
          <div className="absolute right-0 top-0 h-full w-72 bg-paper p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><span className="font-display text-lg">{cabinet.name}</span>
              <button onClick={() => setMenu(false)} className="p-2 rounded-lg hover:bg-paper-deep"><IconX /></button></div>
            <nav className="flex-1 space-y-1">{sideLinks}</nav>
            <UserBox />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-5 lg:py-8 pb-28 lg:pb-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Navigation basse mobile */}
      <nav className="lg:hidden no-print fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-paper-line flex items-end px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
        {NAV.filter((n) => MOBILE.includes(n.href)).slice(0, 2).map((n) => <Tab key={n.href} n={n} on={active(n.href)} />)}
        <button onClick={() => setQuick('menu')} className="flex-1 flex flex-col items-center -mt-5">
          <span className="w-14 h-14 rounded-2xl bg-sage-600 text-white flex items-center justify-center shadow-pop active:scale-95 transition"><IconPlus className="w-7 h-7" /></span>
          <span className="text-[10px] mt-1 text-ink-mute">Noter</span>
        </button>
        {NAV.filter((n) => MOBILE.includes(n.href)).slice(2).map((n) => <Tab key={n.href} n={n} on={active(n.href)} />)}
      </nav>

      {/* Capture rapide */}
      <Modal open={quick === 'menu'} onClose={() => setQuick(null)} title="Qu'est-ce qu'on note ?">
        <div className="grid gap-2">
          <QuickBtn onClick={() => setQuick('request')} icon={<IconInbox />} title="Une demande qui arrive" text="Appel, mail, WhatsApp, passage… (raccourci : touche N)" />
          <QuickBtn onClick={() => setQuick('task')} icon={<IconList />} title="Une tâche à faire" text="Avec échéance, et répétition si besoin" />
          <QuickBtn onClick={() => setQuick('appt')} icon={<IconCalendar />} title="Un rendez-vous" text="Le client reçoit un rappel la veille" />
          <Link href="/factures/nouvelle" onClick={() => setQuick(null)} className="flex items-center gap-3 p-3 rounded-xl border border-paper-line bg-white hover:bg-paper-deep text-left">
            <span className="w-10 h-10 rounded-xl bg-sage-50 text-sage-700 flex items-center justify-center"><IconEuro /></span>
            <span><span className="block font-semibold text-sm">Une facture d'honoraires</span><span className="block text-xs text-ink-mute">Envoyée et relancée automatiquement</span></span>
          </Link>
        </div>
      </Modal>
      <Modal open={quick === 'request'} onClose={() => setQuick(null)} title="Nouvelle demande"><RequestForm onSaved={() => setQuick(null)} /></Modal>
      <Modal open={quick === 'task'} onClose={() => setQuick(null)} title="Nouvelle tâche"><TaskForm onSaved={() => setQuick(null)} /></Modal>
      <Modal open={quick === 'appt'} onClose={() => setQuick(null)} title="Nouveau rendez-vous"><AppointmentForm onSaved={() => setQuick(null)} /></Modal>
    </div>
  );
}

function Tab({ n, on }: { n: NavItem; on: boolean }) {
  const Icon = n.icon;
  return (
    <Link href={n.href} className="flex-1 flex flex-col items-center gap-0.5 py-1">
      <Icon className={`w-[22px] h-[22px] ${on ? 'text-sage-600' : 'text-ink-mute'}`} />
      <span className={`text-[10px] ${on ? 'text-ink font-semibold' : 'text-ink-mute'}`}>{n.label}</span>
    </Link>
  );
}

function QuickBtn({ onClick, icon, title, text }: { onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 p-3 rounded-xl border border-paper-line bg-white hover:bg-paper-deep text-left">
      <span className="w-10 h-10 rounded-xl bg-sage-50 text-sage-700 flex items-center justify-center">{icon}</span>
      <span><span className="block font-semibold text-sm">{title}</span><span className="block text-xs text-ink-mute">{text}</span></span>
    </button>
  );
}

function UserBox() {
  const { me } = useCabinet();
  const router = useRouter();
  return (
    <div className="mt-4 pt-4 border-t border-paper-line flex items-center gap-2">
      <Link href="/compte" className="flex items-center gap-2 flex-1 min-w-0 rounded-lg p-1 hover:bg-white/60">
        <span className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: me.color }}>
          {me.full_name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0"><span className="block text-sm font-semibold truncate">{me.full_name}</span>
          <span className="block text-[11px] text-ink-mute capitalize">{me.role}</span></span>
      </Link>
      <button title="Se déconnecter" onClick={async () => { await supabase().auth.signOut(); router.replace('/login'); }} className="p-2 rounded-lg text-ink-mute hover:bg-white/60"><IconLogout className="w-4 h-4" /></button>
    </div>
  );
}
