'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Clock, Star } from 'lucide-react';
import { searchCoins, CoinSearchResult } from '@/lib/api/coingecko';

interface CoinSearchProps {
  onSelect?: (coin: CoinSearchResult) => void;
  placeholder?: string;
  className?: string;
}

export default function CoinSearch({ onSelect, placeholder = 'Search any coin...', className = '' }: CoinSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<CoinSearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
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

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 1) {
        setIsLoading(true);
        const coins = await searchCoins(query);
        setResults(coins);
        setIsLoading(false);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
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
    // Save to recent searches
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
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-hub-gray-text" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 bg-hub-gray/30 border border-hub-gray/50 rounded-2xl text-white placeholder-hub-gray-text focus:outline-none focus:border-hub-yellow/50 focus:ring-2 focus:ring-hub-yellow/20 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-hub-gray/50 transition-colors"
          >
            <X className="w-4 h-4 text-hub-gray-text" />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-hub-gray/95 backdrop-blur-xl border border-hub-gray/50 rounded-2xl shadow-2xl overflow-hidden z-50">
          {/* Results */}
          {results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              <div className="px-4 py-2 border-b border-hub-gray/30">
                <span className="text-xs text-hub-gray-text uppercase tracking-wider">Results</span>
              </div>
              {results.map((coin) => (
                <button
                  key={coin.id}
                  onClick={() => handleSelect(coin)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hub-yellow/10 transition-colors"
                >
                  <img src={coin.thumb} alt={coin.name} className="w-8 h-8 rounded-full" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{coin.name}</span>
                      <span className="text-hub-gray-text text-sm">{coin.symbol.toUpperCase()}</span>
                    </div>
                    {coin.market_cap_rank && (
                      <span className="text-xs text-hub-gray-text">Rank #{coin.market_cap_rank}</span>
                    )}
                  </div>
                  <TrendingUp className="w-4 h-4 text-hub-gray-text" />
                </button>
              ))}
            </div>
          ) : query.length > 0 && !isLoading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-hub-gray-text">No coins found for "{query}"</p>
            </div>
          ) : (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="px-4 py-2 border-b border-hub-gray/30 flex items-center justify-between">
                    <span className="text-xs text-hub-gray-text uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Recent
                    </span>
                    <button
                      onClick={clearRecent}
                      className="text-xs text-hub-gray-text hover:text-hub-yellow transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {recentSearches.map((coin) => (
                    <button
                      key={coin.id}
                      onClick={() => handleSelect(coin)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hub-yellow/10 transition-colors"
                    >
                      <img src={coin.thumb} alt={coin.name} className="w-8 h-8 rounded-full" />
                      <div className="flex-1 text-left">
                        <span className="text-white font-medium">{coin.name}</span>
                        <span className="text-hub-gray-text text-sm ml-2">{coin.symbol.toUpperCase()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Popular Coins */}
              <div className="px-4 py-2 border-t border-hub-gray/30">
                <span className="text-xs text-hub-gray-text uppercase tracking-wider flex items-center gap-1.5">
                  <Star className="w-3 h-3" />
                  Popular
                </span>
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-3">
                {['bitcoin', 'ethereum', 'solana', 'jupiter', 'arbitrum'].map((id) => (
                  <button
                    key={id}
                    onClick={() => setQuery(id)}
                    className="px-3 py-1.5 rounded-lg bg-hub-gray/50 text-sm text-hub-gray-text hover:text-white hover:bg-hub-yellow/20 transition-colors"
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
