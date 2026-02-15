'use client';

import { useTheme } from '@/hooks/useTheme';
import HomeOrange from './HomeOrange';
import HomeGreen from './HomeGreen';

export default function Home() {
  const theme = useTheme();
  return theme === 'green' ? <HomeGreen /> : <HomeOrange />;
}
