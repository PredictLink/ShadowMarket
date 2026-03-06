"use client";

import { useState } from "react";
import { ethers } from "ethers";

export default function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("Please install MetaMask to use ShadowMarket.");
      return;
    }
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAddress(addr);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  if (address) {
    return (
      <button
        onClick={disconnect}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-900/30 border border-purple-600/50 text-purple-300 hover:bg-purple-800/40 transition-colors text-sm font-medium"
      >
        <span className="w-2 h-2 rounded-full bg-green-400" />
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-sm transition-all glow-purple-sm hover:glow-purple"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : null}
      {loading ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
