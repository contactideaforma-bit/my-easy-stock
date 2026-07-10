import { redirect } from 'next/navigation';

// L'accès démo sans identifiants a été retiré : la démonstration se fait
// avec un compte classique (identifiants transmis temporairement).
export default function DemoPage() {
  redirect('/login');
}
