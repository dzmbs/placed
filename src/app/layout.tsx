import type { Metadata } from 'next';
import './globals.css';
import './market.css';
import SepoliaProvider from '@/components/sepolia-provider';

export const metadata: Metadata = {
  title: 'Placed — Ad space marketplace',
  description: 'List ad space, book placements and trade creator revenue tokens.',
  icons: {
    icon: '/examples/placed-logo.png',
    apple: '/examples/placed-logo.png',
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SepoliaProvider>{children}</SepoliaProvider>
      </body>
    </html>
  );
}
