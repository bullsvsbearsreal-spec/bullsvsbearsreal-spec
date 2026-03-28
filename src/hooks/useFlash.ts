'use client';

import { useRef, useState, useEffect } from 'react';

/**
 * Returns a CSS class name that flashes green or red when the value changes.
 * Uses the existing .animate-flash-green / .animate-flash-red classes from globals.css.
 */
export function useFlash(value: number | undefined | null): string {
  const prevRef = useRef<number | null>(null);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (value == null || !isFinite(value)) return;
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === null) return; // first render — no flash
    if (value === prev) return;

    setFlash(value > prev ? 'animate-flash-green' : 'animate-flash-red');
    const timer = setTimeout(() => setFlash(''), 600);
    return () => clearTimeout(timer);
  }, [value]);

  return flash;
}
