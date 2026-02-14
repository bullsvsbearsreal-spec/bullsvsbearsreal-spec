'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { CoinSearchResult } from '@/lib/api/coingecko';

interface CoinSearchProps {
  onSelect?: (coin: CoinSearchResult) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export default function CoinSearch({
  onSelect,
  placeholder = 'Search any coin...',
  className = '',
  autoFocus = false,
  compact = false
}: CoinSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<CoinSearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const saved = localStorage.getItem('recentCoinSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (e) {
        console.error('Failed to parse recent searches');
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 1) {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/coin-search?q=${encodeURIComponent(query)}`);
          const json = await res.json();
          setResults(json.results || []);
        } catch {
          setResults([]);
        }
        setIsLoading(false);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (coin: CoinSearchResult) => {
    const updated = [coin, ...recentSearches.filter(c => c.id !== coin.id)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentCoinSearches', JSON.stringify(updated));

    setQuery('');
    setIsOpen(false);
    onSelect?.(coin);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentCoinSearches');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          aria-label="Search coins"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          role="combobox"
          className={`w-full pl-9 pr-9 ${compact ? 'py-2' : 'py-2.5'} bg-[#111] border border-white/[0.06] rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/30 transition-colors`}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-3.5 h-3.5 text-neutral-600" />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-hub-yellow/20 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-white/[0.06] rounded-lg shadow-2xl overflow-hidden z-50">
          {results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <div className="px-3 py-1.5 border-b border-white/[0.04]">
                <span className="text-[10px] text-neutral-600 uppercase tracking-wider">Results</span>
              </div>
              {results.map((coin) => (
                <button
                  key={coin.id}
                  onClick={() => handleSelect(coin)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors"
                >
                  <img src={coin.thumb} alt={coin.name} className="w-6 h-6 rounded-full" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-medium text-xs">{coin.name}</span>
                      <span className="text-neutral-600 text-[10px]">{coin.symbol.toUpperCase()}</span>
                    </div>
                    {coin.market_cap_rank && (
                      <span className="text-[10px] text-neutral-600">#{coin.market_cap_rank}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.length > 0 && !isLoading ? (
            <div className="px-3 py-4 text-center">
              <p className="text-neutral-600 text-xs">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <>
              {recentSearches.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center justify-between">
                    <span className="text-[10px] text-neutral-600 uppercase tracking-wider">Recent</span>
                    <button
                      onClick={clearRecent}
                      className="text-[10px] text-neutral-600 hover:text-hub-yellow transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {recentSearches.map((coin) => (
                    <button
                      key={coin.id}
                      onClick={() => handleSelect(coin)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors"
                    >
                      <img src={coin.thumb} alt={coin.name} className="w-6 h-6 rounded-full" />
                      <span className="text-white font-medium text-xs">{coin.name}</span>
                      <span className="text-neutral-600 text-[10px]">{coin.symbol.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="px-3 py-1.5 border-t border-white/[0.04]">
                <span className="text-[10px] text-neutral-600 uppercase tracking-wider">Popular</span>
              </div>
              <div className="flex flex-wrap gap-1 px-3 py-2">
                {['bitcoin', 'ethereum', 'solana', 'jupiter', 'arbitrum'].map((id) => (
                  <button
                    key={id}
                    onClick={() => setQuery(id)}
                    className="px-2 py-0.5 rounded bg-white/[0.04] text-[10px] text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    {id.charAt(0).toUpperCase() + id.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
