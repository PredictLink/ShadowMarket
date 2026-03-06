"use client";

import Link from "next/link";
import { useState } from "react";

const MOCK_MARKETS = [
  {
    id: 1,
    question: "Will ETH exceed $3,500 by March 1, 2026?",
    totalPool: "1,250 USDC",
    status: "OPEN",
    expiry: "Mar 1, 2026",
    bids: 12,
  },
  {
    id: 2,
    question: "Will the Chainlink Convergence Hackathon exceed 2,000 submissions?",
    totalPool: "3,400 USDC",
    status: "OPEN",
    expiry: "Feb 28, 2026",
    bids: 34,
  },
  {
    id: 3,
    question: "Will Bitcoin stay above $90,000 at end of February 2026?",
    totalPool: "8,700 USDC",
    status: "RESOLVING",
    expiry: "Feb 28, 2026",
    bids: 67,
  },
  {
    id: 4,
    question: "Will ETH exceed $3,000 on March 1, 2026?",
    totalPool: "4,200 USDC",
    status: "SETTLED",
    expiry: "Mar 1, 2026",
    bids: 45,
    outcome: true,
  },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "OPEN")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        OPEN
      </span>
    );
  if (status === "RESOLVING")
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

export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState<"active" | "resolving" | "settled">("active");

  const filtered = MOCK_MARKETS.filter((m) => {
    if (activeTab === "active") return m.status === "OPEN";
    if (activeTab === "resolving") return m.status === "RESOLVING";
    return m.status === "SETTLED";
  });

  return (
    <main className="min-h-screen bg-shadow-900">
      <nav className="border-b border-purple-900/30 bg-shadow-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-purple-400 tracking-widest uppercase">
            ⬡ ShadowMarket
          </Link>
          <Link href="/admin" className="text-slate-400 hover:text-purple-400 transition-colors text-sm">
            Admin
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Prediction Markets</h1>
        <p className="text-slate-400 mb-8">Sealed bid markets powered by Chainlink AI oracles.</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-purple-900/30 pb-0">
          {(["active", "resolving", "settled"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-purple-500 text-purple-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "active" ? "Active" : tab === "resolving" ? "Resolving" : "Settled"}
            </button>
          ))}
        </div>

        {/* Market cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-slate-500">
              No markets in this category.
            </div>
          ) : (
            filtered.map((market) => (
              <div
                key={market.id}
                className="p-6 rounded-xl bg-shadow-800 border border-purple-900/30 hover:border-purple-600/50 transition-all hover:shadow-lg hover:shadow-purple-900/20"
              >
                <div className="flex items-start justify-between mb-4">
                  <StatusBadge status={market.status} />
                  <span className="text-slate-500 text-xs">Expires {market.expiry}</span>
                </div>

                <h3 className="text-white font-semibold mb-4 line-clamp-2 leading-snug">
                  {market.question}
                </h3>

                {market.status === "SETTLED" && (
                  <div className="mb-4 p-2 rounded-lg bg-purple-900/20 border border-purple-700/30 text-center">
                    <span className="text-sm font-medium text-purple-300">
                      Outcome: {(market as any).outcome ? "✅ YES" : "❌ NO"}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Total Pool</p>
                    <p className="text-purple-400 font-semibold">{market.totalPool}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-0.5">Bids</p>
                    <p className="text-slate-300 font-semibold">{market.bids} 🔒</p>
                  </div>
                </div>

                <Link
                  href={`/markets/${market.id}`}
                  className="block w-full text-center py-2.5 bg-purple-700/30 hover:bg-purple-600/50 text-purple-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-purple-700/30 hover:border-purple-500"
                >
                  View Market →
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
