import MarketAssetPage from '@/components/market-asset';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string; tab?: string; campaign?: string }>;
}) {
  const { id } = await params;
  const { slot, tab, campaign } = await searchParams;
  return (
    <MarketAssetPage
      key={`${id}:${slot ?? ''}:${tab ?? ''}:${campaign ?? ''}`}
      id={id}
      initialSlot={slot}
      initialTab={tab}
      initialCampaign={campaign}
    />
  );
}
