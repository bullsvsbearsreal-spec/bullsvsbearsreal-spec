'use client';

import { useRef } from 'react';

export type AdminTab = 'overview' | 'pipeline' | 'alerts' | 'database' | 'users' | 'actions';

interface TabDef {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface Props {
  tabs: TabDef[];
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}

export default function TabBar({ tabs, activeTab, onChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-white/[0.06] pb-0 mb-4"
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium whitespace-nowrap rounded-t-lg border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-hub-yellow text-hub-yellow bg-hub-yellow/5'
              : 'border-transparent text-neutral-500 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.badge && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
              activeTab === tab.id
                ? 'bg-hub-yellow/20 text-hub-yellow'
                : 'bg-white/[0.08] text-neutral-400'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
