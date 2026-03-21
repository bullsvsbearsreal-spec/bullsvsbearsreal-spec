'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const SpreadTrackerChart = dynamic(
  () => import('@/app/spreads/components/SpreadTrackerChart'),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center text-neutral-600">Loading chart...</div> },
);

export default function SpreadTrackerPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        <Suspense fallback={<div className="h-[500px]" />}>
          <SpreadTrackerChart />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
