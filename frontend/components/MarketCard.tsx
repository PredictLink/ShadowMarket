"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { MarketData } from "../lib/hooks/useMarkets";
import { ethers } from "ethers";

function StatusBadge({ status }: { status: number }) {
  if (status === 0)
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        OPEN
      </span>
    );
  if (status === 1)
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
        RESOLVING
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-900/40 text-blue-400 border border-blue-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      SETTLED
    </span>
  );
}

interface MarketCardProps {
  market: MarketData;
}

export default function MarketCard({ market }: MarketCardProps) {
  const expiryDate = new Date(market.expiryTimestamp * 1000);
  const isExpired = expiryDate < new Date();

  const totalPoolFormatted = parseFloat(
    ethers.formatUnits(market.totalPool, 6)
  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 rounded-xl bg-shadow-800 border border-purple-900/30 hover:border-purple-600/50 transition-all hover:shadow-lg hover:shadow-purple-900/20 group">
      <div className="flex items-start justify-between mb-4">
        <StatusBadge status={market.status} />
        <span className="text-slate-500 text-xs">
          {isExpired
            ? "Expired"
            : `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`}
        </span>
      </div>

      <h3 className="text-white font-semibold mb-4 line-clamp-2 leading-snug group-hover:text-purple-200 transition-colors">
        {market.question}
      </h3>

      {market.status === 2 && (
        <div className="mb-4 p-2 rounded-lg bg-purple-900/20 border border-purple-700/30 text-center">
          <span className="text-sm font-medium text-purple-300">
            Outcome: {market.outcome ? "✅ YES" : "❌ NO"}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Total Pool</p>
          <p className="text-purple-400 font-semibold">{totalPoolFormatted} USDC</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-0.5">Sealed Bids</p>
          <p className="text-slate-300 font-semibold">{market.totalBids.toString()} 🔒</p>
        </div>
      </div>

      <Link
        href={`/markets/${market.id}`}
        className="block w-full text-center py-2.5 bg-purple-700/30 hover:bg-purple-600/50 text-purple-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-purple-700/30 hover:border-purple-500"
      >
        View Market →
      </Link>
    </div>
  );
}
