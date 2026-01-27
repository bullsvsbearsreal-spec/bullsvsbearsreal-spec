'use client';

import { exchanges } from '@/lib/mockData';
import { ExchangeLogo, exchangeColors } from './ExchangeLogos';
import { ExternalLink } from 'lucide-react';

export default function ExchangeList() {
  const cexExchanges = exchanges.filter(e => e.type === 'CEX');
  const dexExchanges = exchanges.filter(e => e.type === 'DEX');

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-hub-gray/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Supported Exchanges</h2>
            <p className="text-hub-gray-text text-sm mt-1">{exchanges.length} exchanges tracked in real-time</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-success">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              All Connected
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* CEX Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-gradient-to-b from-hub-yellow to-hub-orange rounded-full"></div>
            <h3 className="text-hub-yellow font-semibold">Centralized Exchanges</h3>
            <span className="text-hub-gray-text text-sm">({cexExchanges.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {cexExchanges.map((exchange) => (
              <div
                key={exchange.id}
                className="group flex items-center gap-3 px-4 py-3 bg-hub-gray/30 rounded-xl border border-transparent hover:border-hub-yellow/30 hover:bg-hub-gray/50 transition-all duration-300 cursor-pointer"
              >
                <ExchangeLogo exchange={exchange.id} size={28} className="transition-transform group-hover:scale-110" />
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium text-sm truncate block group-hover:text-hub-yellow transition-colors">
                    {exchange.name}
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-hub-gray-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>

        {/* DEX Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-gradient-to-b from-info to-purple-500 rounded-full"></div>
            <h3 className="text-info font-semibold">Decentralized Exchanges</h3>
            <span className="text-hub-gray-text text-sm">({dexExchanges.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {dexExchanges.map((exchange) => (
              <div
                key={exchange.id}
                className="group flex items-center gap-3 px-4 py-3 bg-hub-gray/30 rounded-xl border border-transparent hover:border-info/30 hover:bg-hub-gray/50 transition-all duration-300 cursor-pointer"
              >
                <ExchangeLogo exchange={exchange.id} size={28} className="transition-transform group-hover:scale-110" />
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium text-sm truncate block group-hover:text-info transition-colors">
                    {exchange.name}
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-hub-gray-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}