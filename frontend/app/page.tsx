"use client";

import Link from "next/link";

// Mock data for the hero page (replaced by live data via hooks)
const HERO_MARKETS = [
  {
    id: 1,
    question: "Will ETH exceed $3,500 by March 1, 2026?",
    totalPool: "1,250 USDC",
    status: "OPEN",
    expiry: "Mar 1, 2026",
  },
  {
    id: 2,
    question: "Will the Chainlink Convergence Hackathon exceed 2,000 submissions?",
    totalPool: "3,400 USDC",
    status: "OPEN",
    expiry: "Feb 28, 2026",
  },
  {
    id: 3,
    question: "Will Bitcoin stay above $90,000 at end of February 2026?",
    totalPool: "8,700 USDC",
    status: "RESOLVING",
    expiry: "Feb 28, 2026",
  },
];

function StatusBadgeSimple({ status }: { status: string }) {
  if (status === "OPEN")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900/50 text-green-400 border border-green-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        OPEN
      </span>
    );
  if (status === "RESOLVING")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-500/30 animate-status-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        RESOLVING
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-900/50 text-blue-400 border border-blue-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      SETTLED
    </span>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-shadow-900">
      {/* Navigation */}
      <nav className="border-b border-purple-900/30 bg-shadow-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-purple-400 tracking-widest uppercase">
            ⬡ ShadowMarket
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/markets" className="text-slate-400 hover:text-purple-400 transition-colors text-sm">
              Markets
            </Link>
            <Link href="/admin" className="text-slate-400 hover:text-purple-400 transition-colors text-sm">
              Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-32 px-6 text-center">
        {/* Glow backdrop */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-purple-900/30 border border-purple-700/50 text-purple-300 text-sm font-medium">
            Powered by Chainlink CRE · Gemini AI Oracle
          </div>
          <h1 className="text-6xl md:text-8xl font-bold font-gothic tracking-tight text-white mb-6 animate-float">
            Shadow
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Market
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Private prediction markets.{" "}
            <span className="text-purple-300">Sealed bids.</span>{" "}
            Zero front-running.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/markets"
              className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all glow-purple-sm hover:glow-purple"
            >
              Browse Markets
            </Link>
            <a
              href={process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/UncleTom29/ShadowMarket"}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border border-purple-700/50 hover:border-purple-500 text-slate-300 hover:text-white rounded-xl font-semibold transition-all"
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-shadow-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-12">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Seal", desc: "Submit a commitment hash — your bet is hidden" },
              { step: "2", title: "Reveal", desc: "Reveal your bid after the market expires" },
              { step: "3", title: "Resolve", desc: "Chainlink AI oracle settles the outcome" },
              { step: "4", title: "Claim", desc: "Winners claim proportional share of the pool" },
            ].map((item) => (
              <div
                key={item.step}
                className="p-6 rounded-xl bg-shadow-700/50 border border-purple-900/30 text-center hover:border-purple-600/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/50 flex items-center justify-center mx-auto mb-3 text-purple-300 font-bold">
                  {item.step}
                </div>
                <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Active markets preview */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Active Markets</h2>
            <Link href="/markets" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
              View all →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {HERO_MARKETS.map((market) => (
              <Link
                key={market.id}
                href={`/markets/${market.id}`}
                className="block p-6 rounded-xl bg-shadow-800 border border-purple-900/30 hover:border-purple-600/50 transition-all hover:glow-purple-sm group"
              >
                <div className="flex items-start justify-between mb-4">
                  <StatusBadgeSimple status={market.status} />
                  <span className="text-slate-500 text-xs">{market.expiry}</span>
                </div>
                <p className="text-white font-medium mb-4 group-hover:text-purple-200 transition-colors line-clamp-2">
                  {market.question}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-purple-400 font-semibold text-sm">
                    {market.totalPool}
                  </span>
                  <span className="text-slate-500 text-xs">Total Pool</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-purple-900/20 text-center text-slate-500 text-sm">
        <p>ShadowMarket · Built for Chainlink Convergence Hackathon 2026 · MIT License</p>
      </footer>
    </main>
  );
}
