import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chart | InfoHub',
  description:
    'Professional cryptocurrency charting with technical indicators powered by TradingView lightweight-charts',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
