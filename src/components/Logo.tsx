export default function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-display text-lg ${light ? 'bg-white text-sage-800' : 'bg-sage-600 text-white'}`}>A</span>
      <span className={`font-display text-xl ${light ? 'text-white' : 'text-ink'}`}>My Assistanad</span>
    </div>
  );
}
