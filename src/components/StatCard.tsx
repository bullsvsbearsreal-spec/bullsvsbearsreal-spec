'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon?: LucideIcon;
  subtitle?: string;
}

export default function StatCard({ title, value, change, changePositive, icon: Icon, subtitle }: StatCardProps) {
  return (
    <div className="glass-card rounded-2xl p-5 hover-lift group transition-all duration-300 relative overflow-hidden">
      {/* Top accent gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-hub-yellow-dark/40 to-transparent" />
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-hub-gray-text text-sm font-medium mb-2">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-white stat-value tracking-tight">{value}</p>
          {change && (
            <div className={`flex items-center gap-1 mt-2 ${changePositive ? 'text-success' : 'text-danger'}`}>
              {changePositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold">{change}</span>
            </div>
          )}
          {subtitle && (
            <p className="text-hub-gray-text text-xs mt-2">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="p-3 bg-gradient-to-br from-hub-yellow-light/15 via-hub-yellow/20 to-hub-orange/10 rounded-xl group-hover:from-hub-yellow-light/25 group-hover:via-hub-yellow/30 group-hover:to-hub-orange/20 transition-all duration-300">
            <Icon className="w-6 h-6 text-hub-yellow group-hover:text-hub-yellow-light group-hover:scale-110 transition-all duration-300" />
          </div>
        )}
      </div>

      {/* Subtle shimmer effect on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-hub-yellow/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}