export default function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-2xl flex items-center justify-center font-display text-lg text-white shadow-[0_4px_14px_rgba(204,58,115,.35)]"
        style={{ background: 'linear-gradient(135deg,#f07aa6 0%,#cc3a73 60%,#9b7fd4 130%)' }}>A</span>
      <span className={`font-display text-xl ${light ? 'text-white' : 'text-ink'}`}>My <span className="italic text-rose-600">Assistanad</span></span>
    </div>
  );
}
