import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InfoHub Admin',
  description: 'InfoHub monitoring dashboard',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          `try{var t=localStorage.getItem('infohub-admin-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
