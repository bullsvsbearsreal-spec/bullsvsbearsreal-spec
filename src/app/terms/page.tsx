import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { FileText } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/terms');

/* -- Sections ------------------------------------------------------------ */

const sections = [
  {
    title: 'Acceptance of Terms',
    body: 'By accessing or using InfoHub ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you should not use the Service. Your continued use of InfoHub constitutes acceptance of any updates or modifications to these terms.',
  },
  {
    title: 'Description of Service',
    body: 'InfoHub provides real-time cryptocurrency market data aggregated from third-party exchanges and data providers. This includes funding rates, open interest, liquidation data, screener tools, options analytics, and related market information. All data is provided for informational purposes only.',
  },
  {
    title: 'No Financial Advice',
    body: 'InfoHub does not provide financial, investment, or trading advice. All data, charts, and analytics presented on the platform are strictly for informational purposes. Nothing on InfoHub should be interpreted as a recommendation to buy, sell, or hold any asset. Users are solely responsible for their own trading and investment decisions and should conduct their own research before making any financial commitments.',
  },
  {
    title: 'Data Accuracy',
    body: 'While we strive for accuracy and reliability, all data displayed on InfoHub is sourced from third-party exchange APIs and may be delayed, incomplete, or inaccurate. Exchange APIs may experience downtime, rate limiting, or return erroneous data. InfoHub makes no guarantees about the accuracy, completeness, or timeliness of any data. InfoHub is not responsible for any trading decisions made based on data displayed on the platform.',
  },
  {
    title: 'Intellectual Property',
    body: 'All content, design, code, graphics, logos, and other intellectual property on InfoHub are owned by InfoHub or its licensors. You may not reproduce, distribute, modify, or create derivative works from any part of the Service without prior written permission.',
  },
  {
    title: 'User Conduct',
    body: 'You agree not to: scrape, crawl, or use automated tools to extract data from InfoHub without explicit permission; attempt to interfere with or disrupt the Service; use the Service for any unlawful purpose; redistribute InfoHub data for commercial purposes without authorization; attempt to reverse-engineer or decompile any part of the Service.',
  },
  {
    title: 'Limitation of Liability',
    body: 'To the fullest extent permitted by law, InfoHub and its operators shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of or inability to use the Service. This includes, but is not limited to, losses resulting from trading decisions, data inaccuracies, service interruptions, or unauthorized access to the platform.',
  },
  {
    title: 'Third-Party Links & Services',
    body: 'InfoHub may contain links to third-party websites, exchanges, and services. These links are provided for convenience only. InfoHub does not endorse, control, or assume responsibility for the content, privacy policies, or practices of any third-party services. Your interactions with third-party services are solely between you and the third party.',
  },
  {
    title: 'Privacy',
    body: 'InfoHub does not require user registration or login. We do not collect personal information such as names, emails, or passwords. We use basic, anonymous analytics to understand usage patterns and improve the Service. No personal data is sold or shared with third parties.',
  },
  {
    title: 'Changes to Terms',
    body: 'InfoHub reserves the right to modify these Terms and Conditions at any time without prior notice. Changes become effective immediately upon being posted on the platform. Your continued use of InfoHub after any modifications constitutes acceptance of the updated terms. We encourage you to review these terms periodically.',
  },
  {
    title: 'Contact',
    body: 'If you have questions or concerns about these Terms and Conditions, please reach out via our website at info-hub.io or contact us at contact@info-hub.io.',
  },
];

/* -- Page ---------------------------------------------------------------- */

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-hub-yellow" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Terms & Conditions</h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              Last updated: February 2026
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
            By using InfoHub, you acknowledge that you have read and agree to these Terms & Conditions.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
