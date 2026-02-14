'use client';

import { useAlertEngine } from '@/hooks/useAlertEngine';

/**
 * Invisible component that mounts the global alert engine.
 * Placed in the root layout to run alert checks on every page.
 */
export default function AlertEngine() {
  useAlertEngine(60_000);
  return null;
}
