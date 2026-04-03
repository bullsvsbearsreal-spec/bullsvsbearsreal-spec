/** Returns CSS class for directional pip arrow (▲/▼) based on value sign */
export function pipClass(value: number | null | undefined): string {
  if (value == null || value === 0) return 'pip-neutral';
  return value > 0 ? 'pip-up' : 'pip-down';
}

/** Returns combined delta-badge + pip classes for a percentage change */
export function deltaBadgeClass(value: number | null | undefined, extremeThreshold = 15): string {
  if (value == null) return '';
  const isExtreme = Math.abs(value) >= extremeThreshold;
  const direction = value >= 0 ? 'up' : 'down';
  const badge = isExtreme ? `delta-badge-extreme-${direction}` : `delta-badge-${direction}`;
  const pip = value === 0 ? 'pip-neutral' : value > 0 ? 'pip-up' : 'pip-down';
  return `delta-badge ${badge} ${pip}`;
}
