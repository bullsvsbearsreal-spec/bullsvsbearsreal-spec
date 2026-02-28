'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedValueProps {
  value: number;
  format: (v: number) => string;
  className?: string;
}

/**
 * Displays a number that animates smoothly when the value changes.
 * Uses CSS transition on opacity for a brief flash effect:
 * when the value changes, the text briefly fades then returns,
 * and a green/red flash indicates direction.
 *
 * Light-weight: no requestAnimationFrame counting, just a CSS class toggle.
 */
export default function AnimatedValue({ value, format, className = '' }: AnimatedValueProps) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (prevRef.current !== value) {
      const dir = value > prevRef.current ? 'up' : 'down';
      prevRef.current = value;
      setFlash(dir);
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  const flashColor =
    flash === 'up'
      ? 'text-green-400'
      : flash === 'down'
        ? 'text-red-400'
        : '';

  return (
    <span
      className={`${className} ${flashColor} transition-colors duration-500`}
    >
      {format(value)}
    </span>
  );
}
