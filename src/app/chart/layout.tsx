import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chart | InfoHub',
  description:
    'Professional charting for crypto, stocks, forex, commodities and indices powered by TradingView',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
