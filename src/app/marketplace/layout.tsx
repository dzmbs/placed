import MarketplaceProviders from '@/components/marketplace/providers';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MarketplaceProviders>{children}</MarketplaceProviders>;
}
