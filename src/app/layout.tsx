import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Placed — Your world. Their billboard.',
  description: 'Turn the things you carry, wear, and share into beautiful sponsorships.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
