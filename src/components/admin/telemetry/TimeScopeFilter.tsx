'use client';

interface TimeScopeFilterProps {
  scope: 'all' | 'past' | 'live' | 'future';
  onChange: (scope: 'all' | 'past' | 'live' | 'future') => void;
}

const SCOPES: { id: TimeScopeFilterProps['scope']; label: string }[] = [
  { id: 'past', label: 'Past' },
  { id: 'live', label: 'Ongoing / Live' },
  { id: 'future', label: 'Future' },
  { id: 'all', label: 'All' },
];

export function TimeScopeFilter({ scope, onChange }: TimeScopeFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SCOPES.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`text-[10px] font-body px-3 py-1.5 border transition-colors ${
            scope === s.id
              ? 'bg-[#C9A84C]/15 border-[#C9A84C]/30 text-[#C9A84C]'
              : 'border-white/10 text-white/40 hover:text-white'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
