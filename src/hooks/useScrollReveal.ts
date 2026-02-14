'use client';

import { useEffect } from 'react';

/**
 * Tiny IntersectionObserver hook that adds `.revealed` to `.reveal` elements
 * when they scroll into view. Pairs with CSS classes in globals.css.
 *
 * Usage: call `useScrollReveal()` in a page component, then add
 * `className="reveal"` to any element you want to animate in.
 */
export function useScrollReveal(rootMargin = '-40px') {
  useEffect(() => {
    // Respect reduced-motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin, threshold: 0.1 },
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rootMargin]);
}
