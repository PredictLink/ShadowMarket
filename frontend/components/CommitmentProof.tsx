"use client";

import { useState } from "react";
import { loadBidData } from "../lib/crypto";

interface CommitmentProofProps {
  marketId: number;
  address: string;
}

export default function CommitmentProof({ marketId, address }: CommitmentProofProps) {
  const [copied, setCopied] = useState(false);
  const bidData = loadBidData(marketId, address);

  if (!bidData) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(bidData.commitment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-5 rounded-xl bg-shadow-800 border border-purple-700/30">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Your Sealed Bid Proof
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">Side</span>
          <span className={`font-semibold text-sm ${bidData.side ? "text-green-400" : "text-red-400"}`}>
            {bidData.side ? "YES ✅" : "NO ❌"}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">Amount</span>
          <span className="text-purple-300 text-sm">🔒 Sealed</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">Salt</span>
          <code className="text-xs text-slate-500 font-mono">
            {bidData.salt.slice(0, 10)}...
          </code>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-400 text-sm">Commitment</span>
            <button
              onClick={handleCopy}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <code className="block text-xs text-purple-300 font-mono bg-shadow-900 px-3 py-2 rounded break-all">
            {bidData.commitment.slice(0, 20)}...{bidData.commitment.slice(-8)}
          </code>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30">
        <p className="text-yellow-300 text-xs">
          ⚠️ Save your salt to reveal later. Clearing browser data will lose this information.
        </p>
      </div>
    </div>
  );
}
