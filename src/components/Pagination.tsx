'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  label?: string;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  pages.push(1);
  if (currentPage > 3) pages.push('...');
  const rangeStart = Math.max(2, currentPage - 1);
  const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  pages.push(totalPages);
  return pages;
}

export default function Pagination({ currentPage, totalPages, totalItems, rowsPerPage, onPageChange, label = 'items' }: PaginationProps) {
  if (totalPages <= 1) return null;
  const startIdx = (currentPage - 1) * rowsPerPage;

  return (
    <div className="px-4 py-3 border-t border-white/[0.06] grid grid-cols-3 items-center">
      {/* Left: item range */}
      <span className="text-neutral-600 text-xs">
        {startIdx + 1}–{Math.min(startIdx + rowsPerPage, totalItems)} of {totalItems} {label}
      </span>

      {/* Center: page buttons */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {getPageNumbers(currentPage, totalPages).map((page, i) =>
          page === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-neutral-600 text-xs">…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors ${
                page === currentPage
                  ? 'bg-hub-yellow text-black'
                  : 'text-neutral-500 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: page indicator */}
      <span className="text-neutral-600 text-xs text-right">
        Page {currentPage} of {totalPages}
      </span>
    </div>
  );
}
