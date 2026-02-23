'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}

export default function AnimatedNumber({ value, format, className = '', duration = 400 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevValue = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevValue.current;
    if (prev === value) return;

    // Flash direction
    setFlash(value > prev ? 'up' : 'down');
    const flashTimer = setTimeout(() => setFlash(null), 600);

    // Animate number
    const startTime = performance.now();
    const startVal = prev;
    const diff = value - prev;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + diff * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    prevValue.current = value;

    return () => {
      clearTimeout(flashTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span
      className={`transition-colors duration-300 ${
        flash === 'up' ? 'text-green-400' : flash === 'down' ? 'text-red-400' : ''
      } ${className}`}
    >
      {format(displayValue)}
    </span>
  );
}
