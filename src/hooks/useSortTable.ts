'use client';

import { useState, useCallback } from 'react';

type SortDirection = 'asc' | 'desc';

interface UseSortTableReturn<F extends string> {
  sortField: F;
  sortDir: SortDirection;
  handleSort: (field: F) => void;
}

/**
 * Reusable sort-toggle state for any table.
 * Click same column → flip direction. Click new column → desc first.
 *
 * @example
 *   const { sortField, sortDir, handleSort } = useSortTable<'price'|'volume'>('price');
 */
export function useSortTable<F extends string>(
  defaultField: F,
  defaultDir: SortDirection = 'desc',
): UseSortTableReturn<F> {
  const [sortField, setSortField] = useState<F>(defaultField);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultDir);

  const handleSort = useCallback(
    (field: F) => {
      if (field === sortField) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField],
  );

  return { sortField, sortDir, handleSort };
}
