"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ethers } from "ethers";
import { generateSalt, computeCommitment } from "../lib/crypto";

interface BidModalProps {
  marketId: number;
  onSubmit: (amount: string, side: boolean) => Promise<void>;
  loading: boolean;
  children: React.ReactNode;
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function BidModal({
  marketId,
  onSubmit,
  loading,
  children,
}: BidModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [side, setSide] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("");
  const [salt] = useState(generateSalt);
  const [commitment, setCommitment] = useState("");

  const handleNext = () => {
    if (step === 2 && amount) {
      const amountBn = ethers.parseUnits(amount, 6);
      const c = computeCommitment(amountBn, side!, salt);
      setCommitment(c);
      setStep(3);
    } else if (step < 4) {
      setStep((s) => (s + 1) as Step);
    }
  };

  const handleSubmit = async () => {
    setStep(4);
    try {
      await onSubmit(amount, side!);
      setStep(5);
    } catch {
      setStep(3);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep(1);
      setSide(null);
      setAmount("");
      setCommitment("");
    }, 300);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-shadow-800 border border-purple-700/50 rounded-2xl p-6 z-50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold text-white">
              Submit Sealed Bid
            </Dialog.Title>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Privacy banner */}
          <div className="mb-5 p-3 rounded-lg bg-purple-900/20 border border-purple-700/30">
            <p className="text-purple-300 text-xs">
              🔒 Privacy guarantee: Your bid amount remains hidden until market resolution.
              Only the commitment hash is stored on-chain.
            </p>
          </div>

          {/* Step 1: Choose side */}
          {step === 1 && (
            <div>
              <p className="text-slate-400 text-sm mb-4">Step 1 of 4 — Choose your prediction:</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setSide(true)}
                  className={`py-6 rounded-xl font-bold text-2xl transition-all border-2 ${
                    side === true
                      ? "bg-green-600 border-green-500 text-white shadow-lg shadow-green-900/30"
                      : "bg-green-900/20 border-green-700/30 text-green-400 hover:bg-green-800/30"
                  }`}
                >
                  ✅ YES
                </button>
                <button
                  onClick={() => setSide(false)}
                  className={`py-6 rounded-xl font-bold text-2xl transition-all border-2 ${
                    side === false
                      ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30"
                      : "bg-red-900/20 border-red-700/30 text-red-400 hover:bg-red-800/30"
                  }`}
                >
                  ❌ NO
                </button>
              </div>
              <button
                onClick={handleNext}
                disabled={side === null}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl font-semibold transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          {/* Step 2: Enter amount */}
          {step === 2 && (
            <div>
              <p className="text-slate-400 text-sm mb-4">Step 2 of 4 — Enter USDC amount:</p>
              <div className="relative mb-6">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  min="1"
                  autoFocus
                  className="w-full bg-shadow-900 border border-purple-700/30 rounded-xl px-4 py-4 text-white text-xl text-center placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  USDC
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-purple-700/30 text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl font-semibold transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview commitment */}
          {step === 3 && (
            <div>
              <p className="text-slate-400 text-sm mb-4">Step 3 of 4 — Review your sealed bid:</p>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center p-3 rounded-lg bg-shadow-900 border border-purple-700/20">
                  <span className="text-slate-400 text-sm">Side</span>
                  <span className={`font-semibold ${side ? "text-green-400" : "text-red-400"}`}>
                    {side ? "YES ✅" : "NO ❌"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-shadow-900 border border-purple-700/20">
                  <span className="text-slate-400 text-sm">Amount</span>
                  <span className="text-purple-300 font-semibold">🔒 Sealed</span>
                </div>
                <div className="p-3 rounded-lg bg-shadow-900 border border-purple-700/20">
                  <p className="text-slate-400 text-xs mb-1">Commitment hash:</p>
                  <code className="text-xs text-purple-300 font-mono break-all">
                    {commitment.slice(0, 18)}...{commitment.slice(-8)}
                  </code>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 border border-purple-700/30 text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-colors"
                >
                  Submit Bid
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Submitting */}
          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold">Sealing your bid...</p>
              <p className="text-slate-400 text-sm mt-2">
                Please confirm the transaction in your wallet.
              </p>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 5 && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-green-400 font-bold text-xl mb-2">Your bid is sealed ✓</h3>
              <p className="text-slate-400 text-sm mb-4">
                Your position is hidden until market resolution.
              </p>
              <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30 mb-4">
                <p className="text-yellow-300 text-xs">
                  ⚠️ Save your salt to reveal later. It is stored in your browser&apos;s
                  local storage.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
