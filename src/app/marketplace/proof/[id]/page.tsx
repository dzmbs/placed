import { redirect } from 'next/navigation';
import { chainId, readCampaign, readSlot } from '@/lib/marketplace/server/reader';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await readCampaign(chainId(id));
  const slot = await readSlot(chainId(campaign.slotId));
  redirect(`/assets/${slot.assetId}?slot=${slot.id}&campaign=${id}`);
}
