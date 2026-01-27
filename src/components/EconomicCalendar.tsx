'use client';

import { economicEvents } from '@/lib/mockData';
import { Calendar, AlertTriangle, AlertCircle, Info, Clock, ChevronRight, Globe } from 'lucide-react';

const impactConfig = {
  high: { bg: 'bg-danger/10', border: 'border-danger/30', text: 'text-danger', icon: AlertTriangle, label: 'High Impact' },
  medium: { bg: 'bg-hub-yellow/10', border: 'border-hub-yellow/30', text: 'text-hub-yellow', icon: AlertCircle, label: 'Medium' },
  low: { bg: 'bg-info/10', border: 'border-info/30', text: 'text-info', icon: Info, label: 'Low' },
};

const countryFlags: Record<string, string> = {
  US: '🇺🇸',
  EU: '🇪🇺',
  UK: '🇬🇧',
  JP: '🇯🇵',
  CN: '🇨🇳',
};

export default function EconomicCalendar() {
  const groupedByDate = economicEvents.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, typeof economicEvents>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-hub-gray/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-info/10 rounded-xl">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Economic Calendar</h2>
              <p className="text-hub-gray-text text-xs">Market-moving events</p>
            </div>
          </div>
          <button className="flex items-center gap-1 text-sm text-hub-yellow hover:text-hub-yellow-light transition-colors">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">All Regions</span>
          </button>
        </div>

        {/* Impact legend */}
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(impactConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${config.bg.replace('/10', '')}`} style={{
                backgroundColor: key === 'high' ? '#ef4444' : key === 'medium' ? '#FFA500' : '#3b82f6'
              }} />
              <span className="text-hub-gray-text capitalize">{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div className="max-h-[400px] overflow-y-auto">
        {Object.entries(groupedByDate).map(([date, events]) => (
          <div key={date}>
            {/* Date header */}
            <div className="sticky top-0 bg-hub-gray/40 backdrop-blur-sm px-5 py-2 border-b border-hub-gray/20">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-hub-yellow" />
                <span className="text-sm font-semibold text-hub-yellow">{formatDate(date)}</span>
                <span className="text-xs text-hub-gray-text">({events.length} events)</span>
              </div>
            </div>

            {/* Event items */}
            {events.map((event) => {
              const impact = impactConfig[event.impact];
              const ImpactIcon = impact.icon;

              return (
                <div
                  key={event.id}
                  className="px-5 py-4 border-b border-hub-gray/10 hover:bg-hub-gray/20 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    {/* Impact indicator */}
                    <div className={`p-2 rounded-xl ${impact.bg} border ${impact.border} shrink-0`}>
                      <ImpactIcon className={`w-4 h-4 ${impact.text}`} />
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm group-hover:text-hub-yellow transition-colors truncate">
                            {event.event}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg">{countryFlags[event.country] || '🌐'}</span>
                            <span className="text-xs text-hub-gray-text">{event.time} ET</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${impact.bg} ${impact.text}`}>
                              {impact.label}
                            </span>
                          </div>
                        </div>

                        {/* Forecast/Previous */}
                        <div className="text-right shrink-0">
                          {event.forecast && (
                            <div className="text-xs">
                              <span className="text-hub-gray-text">Fcst: </span>
                              <span className="text-white font-medium">{event.forecast}</span>
                            </div>
                          )}
                          {event.previous && (
                            <div className="text-xs">
                              <span className="text-hub-gray-text">Prev: </span>
                              <span className="text-hub-gray-text-light">{event.previous}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-hub-gray-text opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-hub-gray/20 bg-hub-gray/10">
        <div className="flex items-center justify-between">
          <p className="text-xs text-hub-gray-text">All times in Eastern Time (ET)</p>
          <button className="text-xs text-hub-yellow hover:text-hub-yellow-light transition-colors font-medium">
            View Full Calendar →
          </button>
        </div>
      </div>
    </div>
  );
}