"use client";

import Link from "next/link";
import { useState } from "react";

const OWNER_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

export default function AdminPage() {
  const [question, setQuestion] = useState("");
  const [expiry, setExpiry] = useState("");
  const [marketId, setMarketId] = useState("");
  const [outcome, setOutcome] = useState<boolean | null>(null);
  const [rationale, setRationale] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const handleCreateMarket = async () => {
    if (!question || !expiry) return;
    setLoading(true);
    try {
      // TODO: connect wallet and call contract.createMarket()
      await new Promise((r) => setTimeout(r, 1500));
      setTxStatus("✅ Market created successfully (simulated)");
      setQuestion("");
      setExpiry("");
    } finally {
      setLoading(false);
    }
  };

  const handleSetResolving = async () => {
    if (!marketId) return;
    setLoading(true);
    try {
      // TODO: call contract.setResolvingStatus()
      await new Promise((r) => setTimeout(r, 1500));
      setTxStatus(`✅ Market ${marketId} set to RESOLVING (simulated)`);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!marketId || outcome === null || !rationale) return;
    setLoading(true);
    try {
      // TODO: call contract.settleMarket()
      await new Promise((r) => setTimeout(r, 1500));
      setTxStatus(`✅ Market ${marketId} settled as ${outcome ? "YES" : "NO"} (simulated)`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-shadow-900">
      <nav className="border-b border-purple-900/30 bg-shadow-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-purple-400 tracking-widest uppercase">
            ⬡ ShadowMarket
          </Link>
          <span className="text-yellow-400 text-sm">🔐 Admin Panel</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-slate-400 mb-8">
          Manage prediction markets. Requires owner wallet.
        </p>

        {txStatus && (
          <div className="mb-6 p-4 rounded-xl bg-purple-900/20 border border-purple-600/30 text-purple-200 text-sm">
            {txStatus}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Market */}
          <div className="p-6 rounded-xl bg-shadow-800 border border-purple-900/30">
            <h2 className="text-lg font-semibold text-white mb-4">Create Market</h2>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-sm block mb-1">Market Question</label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Will ETH exceed $4,000 by April 2026?"
                  className="w-full bg-shadow-900 border border-purple-700/30 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Expiry Date</label>
                <input
                  type="datetime-local"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="w-full bg-shadow-900 border border-purple-700/30 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 text-sm"
                />
              </div>
              <button
                onClick={handleCreateMarket}
                disabled={loading || !question || !expiry}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {loading ? "Creating..." : "Create Market"}
              </button>
            </div>
          </div>

          {/* Set Resolving */}
          <div className="p-6 rounded-xl bg-shadow-800 border border-yellow-900/30">
            <h2 className="text-lg font-semibold text-white mb-4">Set Resolving Status</h2>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-sm block mb-1">Market ID</label>
                <input
                  type="number"
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  placeholder="1"
                  min="1"
                  className="w-full bg-shadow-900 border border-yellow-700/30 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-500 text-sm"
                />
              </div>
              <button
                onClick={handleSetResolving}
                disabled={loading || !marketId}
                className="w-full py-2.5 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {loading ? "Processing..." : "Set RESOLVING"}
              </button>
            </div>
          </div>

          {/* Manual Settle */}
          <div className="p-6 rounded-xl bg-shadow-800 border border-blue-900/30 md:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">Manual Settlement</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm block mb-1">Market ID</label>
                <input
                  type="number"
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  placeholder="1"
                  min="1"
                  className="w-full bg-shadow-900 border border-blue-700/30 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOutcome(true)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-colors border-2 ${
                      outcome === true
                        ? "bg-green-600 border-green-500 text-white"
                        : "bg-green-900/20 border-green-700/30 text-green-400"
                    }`}
                  >
                    YES ✅
                  </button>
                  <button
                    onClick={() => setOutcome(false)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-colors border-2 ${
                      outcome === false
                        ? "bg-red-600 border-red-500 text-white"
                        : "bg-red-900/20 border-red-700/30 text-red-400"
                    }`}
                  >
                    NO ❌
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-slate-400 text-sm block mb-1">Settlement Rationale</label>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Gemini AI with Search grounding confirmed outcome based on real-time data."
                  rows={3}
                  className="w-full bg-shadow-900 border border-blue-700/30 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  onClick={handleSettle}
                  disabled={loading || !marketId || outcome === null || !rationale}
                  className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  {loading ? "Settling..." : "Settle Market"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
