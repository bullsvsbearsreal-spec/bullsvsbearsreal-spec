'use client';

interface Props {
  data: number[]; // 24 values, one per hour (0-23)
  label?: string;
}

export default function HeatmapChart({ data, label }: Props) {
  const max = Math.max(...data, 1);

  return (
    <div>
      {label && <p className="text-xs text-neutral-500 mb-2">{label}</p>}
      <div className="grid grid-cols-12 gap-0.5">
        {data.map((val, i) => {
          const intensity = val / max;
          const bg =
            intensity === 0
              ? 'bg-white/[0.03]'
              : intensity < 0.25
              ? 'bg-amber-500/20'
              : intensity < 0.5
              ? 'bg-amber-500/40'
              : intensity < 0.75
              ? 'bg-amber-500/60'
              : 'bg-amber-500/80';
          return (
            <div
              key={i}
              className={`aspect-square rounded-sm ${bg} relative group cursor-default`}
              title={`${i}:00 — ${val}`}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-neutral-800 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                {i}:00 — {val}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-neutral-600">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
