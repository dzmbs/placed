import { MarketplaceProvider } from '@/components/marketplace/context';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
