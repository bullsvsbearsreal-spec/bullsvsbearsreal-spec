'use client';

import { useTheme } from '@/hooks/useTheme';
import HomeOrange from './HomeOrange';
import HomeGreen from './HomeGreen';
import HomeBlue from './HomeBlue';

export default function Home() {
  const theme = useTheme();
  if (theme === 'green') return <HomeGreen />;
  if (theme === 'blue') return <HomeBlue />;
  return <HomeOrange />;
}
