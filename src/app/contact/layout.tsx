import type { Metadata } from 'next';

// Per-page metadata wrapper — page.tsx is a client component (form +
// state), so the metadata export can't live there. This layout sits
// between the root layout and the page and contributes a page-specific
// <title> + <meta description> for share previews and SEO. Without
// this the /contact page inherited the generic site default "InfoHub |
// Real-Time Crypto Derivatives Dashboard" which buried support intent.
export const metadata: Metadata = {
  title: 'Contact Support',
  description: 'Open a support ticket for account, billing, or product questions. Bug reports use the Report button on any page (faster triage).',
  alternates: { canonical: 'https://info-hub.io/contact' },
  robots: { index: true, follow: true },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
