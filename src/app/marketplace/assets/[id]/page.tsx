import { redirect } from 'next/navigation';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['slot', 'campaign', 'tab']) {
    const value = values[key];
    if (typeof value === 'string') query.set(key, value);
  }
  redirect(`/assets/${encodeURIComponent(id)}${query.size ? `?${query}` : ''}`);
}
