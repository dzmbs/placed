import MarketPortfolio from '@/components/market-portfolio';
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <MarketPortfolio key={tab ?? 'holdings'} initialTab={tab} />;
}
