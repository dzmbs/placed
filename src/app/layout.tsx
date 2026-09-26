import type { Metadata } from 'next';
import './globals.css';
import './market.css';
import { MarketProvider } from '@/components/market-provider';

export const metadata: Metadata = {
  title: 'Placed — Ad space marketplace',
  description: 'List ad space, book placements and trade creator revenue tokens.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MarketProvider>{children}</MarketProvider>
      </body>
    </html>
  );
}
