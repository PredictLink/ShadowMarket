"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// Mock market detail for demonstration
const getMockMarket = (id: string) => ({
  id: Number(id),
  question:
    id === "1"
      ? "Will ETH exceed $3,500 by March 1, 2026?"
      : id === "2"
      ? "Will the Chainlink Convergence Hackathon exceed 2,000 submissions?"
      : "Will Bitcoin stay above $90,000 at end of February 2026?",
  status: id === "3" ? 1 : id === "4" ? 2 : 0, // 0=OPEN, 1=RESOLVING, 2=SETTLED
  outcome: true,
  totalYesPool: "850.00",
  totalNoPool: "400.00",
  totalPool: "1,250.00",
  expiryTimestamp: Math.floor(new Date("2026-03-01").getTime() / 1000),
  settlementRationale:
    "The Chainlink AI oracle determined: ETH price crossed $3,500 on February 27, 2026 based on CoinMarketCap data confirmed by multiple sources.",
  totalBids: 12,
});

const STATUS_LABELS = ["OPEN", "RESOLVING", "SETTLED"];

function CountdownTimer({ expiry }: { expiry: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isRed, setIsRed] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setIsRed(diff < 3600);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [expiry]);

  return (
    <span className={`font-mono text-sm ${isRed ? "text-red-400" : "text-slate-300"}`}>
      {timeLeft}
    </span>
  );
}

function ActivityItem({ type, hash, amount, side }: any) {
  if (type === "bid")
    return (
      <div className="flex items-start gap-3 py-3 border-b border-purple-900/20">
        <span className="text-lg">🔒</span>
        <div>
          <p className="text-slate-300 text-sm">
            A sealed position was recorded
          </p>
          <p className="text-slate-500 text-xs font-mono">hash: {hash}</p>
        </div>
      </div>
    );
  if (type === "reveal")
    return (
      <div className="flex items-start gap-3 py-3 border-b border-purple-900/20">
        <span className="text-lg">👁</span>
        <div>
          <p className="text-slate-300 text-sm">
            A position was revealed:{" "}
            <span className={side ? "text-green-400" : "text-red-400"}>
              {side ? "YES" : "NO"}
            </span>{" "}
            for {amount} USDC
          </p>
        </div>
      </div>
    );
  return (
    <div className="flex items-start gap-3 py-3 border-b border-purple-900/20">
      <span className="text-lg">⚖️</span>
      <p className="text-slate-300 text-sm">Oracle settled: {side ? "YES" : "NO"}</p>
    </div>
  );
}

export default function MarketDetailClient({ id }: { id: string }) {
  const market = getMockMarket(id);
  const [bidSide, setBidSide] = useState<boolean | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidSubmitted, setBidSubmitted] = useState(false);
  const [commitment, setCommitment] = useState("");
  const [claiming, setClaiming] = useState(false);

  const statusLabel = STATUS_LABELS[market.status];

  const mockActivity = [
    { type: "bid", hash: "0xabcd...ef01" },
    { type: "bid", hash: "0x1234...5678" },
    ...(market.status >= 1
      ? [
          { type: "reveal", side: true, amount: "150" },
          { type: "reveal", side: false, amount: "75" },
        ]
      : []),
    ...(market.status === 2
      ? [{ type: "settle", side: market.outcome }]
      : []),
  ];

  const handleSubmitBid = () => {
    if (bidSide === null || !bidAmount) return;
    const fakeCommitment = "0x" + Math.random().toString(16).slice(2).padEnd(64, "0");
    setCommitment(fakeCommitment);
    setBidSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-shadow-900">
      <nav className="border-b border-purple-900/30 bg-shadow-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-purple-400 tracking-widest uppercase">
            ⬡ ShadowMarket
          </Link>
          <Link href="/markets" className="text-slate-400 hover:text-purple-400 transition-colors text-sm">
            ← Markets
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market header */}
          <div className="p-6 rounded-xl bg-shadow-800 border border-purple-900/30">
            <div className="flex items-center justify-between mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  market.status === 0
                    ? "bg-green-900/40 text-green-400 border-green-500/30"
                    : market.status === 1
                    ? "bg-yellow-900/40 text-yellow-400 border-yellow-500/30"
                    : "bg-blue-900/40 text-blue-400 border-blue-500/30"
                }`}
              >
                {statusLabel}
              </span>
              <span className="text-slate-500 text-sm">Market #{market.id}</span>
            </div>
            <h1 className="text-xl font-bold text-white mb-6">{market.question}</h1>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">Expires</p>
                <CountdownTimer expiry={market.expiryTimestamp} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Total Pool</p>
                <p className="text-purple-400 font-semibold">{market.totalPool} USDC</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Your Position</p>
                <p className="text-slate-300">
                  {bidSubmitted ? "Hidden 🔒" : "None"}
                </p>
              </div>
            </div>
          </div>

          {/* Bid section — OPEN */}
          {market.status === 0 && (
            <div className="p-6 rounded-xl bg-shadow-800 border border-purple-900/30">
              <h2 className="text-lg font-semibold text-white mb-4">Submit Sealed Bid</h2>
              {!bidSubmitted ? (
                <>
                  <div className="mb-4">
                    <p className="text-slate-400 text-sm mb-3">Choose your side:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setBidSide(true)}
                        className={`py-3 rounded-lg font-semibold text-lg transition-all border-2 ${
                          bidSide === true
                            ? "bg-green-600 border-green-500 text-white"
                            : "bg-green-900/20 border-green-700/30 text-green-400 hover:bg-green-800/30"
                        }`}
                      >
                        ✅ YES
                      </button>
                      <button
                        onClick={() => setBidSide(false)}
                        className={`py-3 rounded-lg font-semibold text-lg transition-all border-2 ${
                          bidSide === false
                            ? "bg-red-600 border-red-500 text-white"
                            : "bg-red-900/20 border-red-700/30 text-red-400 hover:bg-red-800/30"
                        }`}
                      >
                        ❌ NO
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-slate-400 text-sm block mb-2">Amount (USDC)</label>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="100"
                      min="1"
                      className="w-full bg-shadow-900 border border-purple-700/30 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="mb-5 p-3 rounded-lg bg-purple-900/20 border border-purple-700/30">
                    <p className="text-purple-300 text-xs">
                      🔒 Privacy guarantee: Your bid amount remains hidden until market resolution.
                      Only the commitment hash is stored on-chain.
                    </p>
                  </div>

                  <button
                    onClick={handleSubmitBid}
                    disabled={bidSide === null || !bidAmount}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/40 disabled:text-purple-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Seal Bid
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">🔒</div>
                  <h3 className="text-green-400 font-semibold text-lg mb-2">Bid sealed ✓</h3>
                  <p className="text-slate-400 text-sm mb-3">Your commitment hash:</p>
                  <code className="text-xs text-purple-300 bg-shadow-900 px-3 py-2 rounded font-mono break-all">
                    {commitment.slice(0, 20)}...{commitment.slice(-8)}
                  </code>
                  <p className="text-yellow-400 text-xs mt-3">
                    ⚠️ Save your salt to reveal later. It is stored in your browser.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reveal section — RESOLVING */}
          {market.status === 1 && (
            <div className="p-6 rounded-xl bg-shadow-800 border border-yellow-600/30">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-yellow-400 text-xl">⏰</span>
                <h2 className="text-lg font-semibold text-yellow-400">Time to reveal your bid!</h2>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                The market has expired. Reveal your sealed bid to participate in the settlement pool.
              </p>
              <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30 mb-4">
                <p className="text-xs text-yellow-300">
                  Your bid details are loaded automatically from your browser&apos;s local storage.
                </p>
              </div>
              <button className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-semibold transition-colors">
                Approve USDC + Reveal Bid
              </button>
            </div>
          )}

          {/* Settlement section — SETTLED */}
          {market.status === 2 && (
            <div className="p-6 rounded-xl bg-shadow-800 border border-blue-600/30">
              <h2 className="text-lg font-semibold text-white mb-4">Market Settled</h2>
              <div className="text-center py-4 mb-4">
                <div className="text-5xl mb-3 animate-bounce">
                  {market.outcome ? "✅" : "❌"}
                </div>
                <p className="text-xl font-bold text-white mb-1">
                  Outcome: {market.outcome ? "YES" : "NO"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-700/30 mb-4">
                <p className="text-xs text-slate-400 mb-1">AI Oracle Rationale:</p>
                <p className="text-sm text-blue-200">{market.settlementRationale}</p>
              </div>
              <button
                onClick={() => setClaiming(true)}
                disabled={claiming}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/40 text-white rounded-lg font-semibold transition-colors"
              >
                {claiming ? "Claiming..." : "Claim Winnings"}
              </button>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-1">
          <div className="p-5 rounded-xl bg-shadow-800 border border-purple-900/30 sticky top-24">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Activity Feed
            </h3>
            <div className="space-y-0 max-h-96 overflow-y-auto">
              {mockActivity.map((item, i) => (
                <ActivityItem key={i} {...item} />
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-3 text-center">
              Updates every 15s
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
