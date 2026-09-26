import AssetPage from '@/components/marketplace/asset';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetPage id={id} />;
}
