'use client';

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost">Télécharger / imprimer (PDF)</button>
  );
}
