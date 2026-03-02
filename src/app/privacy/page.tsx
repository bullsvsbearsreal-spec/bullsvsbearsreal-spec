import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Shield } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/privacy');

/* -- Sections ------------------------------------------------------------ */

const sections = [
  {
    title: 'Information We Collect',
    body: 'An account is required to access most of InfoHub. When you register, we store the information you provide: email address, display name, and your saved preferences (watchlist, alerts, layout settings). We do not collect or store any financial data, wallet addresses, or trading activity.',
  },
  {
    title: 'How We Use Information',
    body: 'Any information we collect is used solely to provide and improve the Service. Account data is used to authenticate you and sync your preferences. We do not sell, rent, or share personal data with third parties for marketing or any other purpose.',
  },
  {
    title: 'Analytics',
    body: 'InfoHub uses Vercel Web Analytics to understand general usage patterns and improve the Service. Vercel Analytics is privacy-focused: it does not use cookies, does not collect personally identifiable information (PII), and does not track users across websites. All analytics data is aggregated and anonymous.',
  },
  {
    title: 'Cookies',
    body: 'InfoHub uses minimal cookies. If you create an account and sign in, a session cookie is used to keep you authenticated. No tracking cookies, advertising cookies, or third-party cookies are used. Unauthenticated users receive no cookies at all.',
  },
  {
    title: 'Third-Party Services',
    body: 'InfoHub aggregates data from third-party cryptocurrency exchange APIs (such as Binance, Bybit, OKX, and others) to display market information. These API requests are made server-side — your browser does not directly communicate with exchange APIs, and no user data is sent to these services.',
  },
  {
    title: 'Data Retention & Deletion',
    body: 'Account data is retained for as long as your account exists. If you request account deletion, all associated data (email, preferences, saved watchlists) will be permanently removed within 30 days. Backup copies may persist for up to 90 days before being purged. Anonymous analytics data is retained in aggregated form and cannot be linked to individual users.',
  },
  {
    title: 'Your Rights',
    body: 'You have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your account and associated data; export your data in a machine-readable format (JSON). To exercise any of these rights, email us at contact@info-hub.io. We will respond to all requests within 30 days.',
  },
  {
    title: 'Security',
    body: 'We take reasonable measures to protect the information we store. Passwords are hashed using industry-standard algorithms. All data is transmitted over HTTPS. However, no system is perfectly secure, and we cannot guarantee absolute security of your data.',
  },
  {
    title: 'Data Breach Notification',
    body: 'In the event of a data breach that affects your personal information, we will notify affected users via email within 72 hours of becoming aware of the breach. The notification will include: what data was affected, what steps we are taking, and what actions you can take to protect yourself.',
  },
  {
    title: 'Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. Changes become effective immediately upon being posted on the platform. We encourage you to review this policy periodically. Your continued use of InfoHub after any modifications constitutes acceptance of the updated policy.',
  },
  {
    title: 'Contact',
    body: 'If you have questions or concerns about this Privacy Policy or your data, please reach out via our website at info-hub.io or contact us at contact@info-hub.io.',
  },
];

/* -- Page ---------------------------------------------------------------- */

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-hub-yellow" />
          </div>
          <div>
            <h1 className="heading-page">Privacy Policy</h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              Last updated: March 2026
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section, i) => (
            <div key={section.title} className="card-premium px-5 py-4">
              <h2 className="text-sm font-semibold text-white mb-2">
                <span className="text-hub-yellow mr-2">{i + 1}.</span>
                {section.title}
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-neutral-600">
            By using InfoHub, you acknowledge that you have read and understand this Privacy Policy.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
