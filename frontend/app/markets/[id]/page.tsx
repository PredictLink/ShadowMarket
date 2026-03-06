import MarketDetailClient from "./client";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MarketDetailClient id={id} />;
}
