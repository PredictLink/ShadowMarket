"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { format } from "date-fns";
import { SHADOWMARKET_ABI, SHADOWMARKET_ADDRESS, RPC_URL } from "../contract";

export interface MarketData {
  id: number;
  question: string;
  expiryTimestamp: number;
  expiryFormatted: string;
  status: number; // 0=OPEN, 1=RESOLVING, 2=SETTLED
  outcome: boolean;
  totalYesPool: bigint;
  totalNoPool: bigint;
  totalPool: bigint;
  totalBids: bigint;
  settlementRationale: string;
}

export function useMarkets() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    if (!SHADOWMARKET_ADDRESS) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(
        SHADOWMARKET_ADDRESS,
        SHADOWMARKET_ABI,
        provider
      );

      const counter = await contract.marketIdCounter();
      const count = Number(counter);
      const marketList: MarketData[] = [];

      for (let i = 1; i <= count; i++) {
        const m = await contract.getMarket(i);
        const expiry = Number(m.expiryTimestamp);
        marketList.push({
          id: i,
          question: m.question,
          expiryTimestamp: expiry,
          expiryFormatted: format(new Date(expiry * 1000), "MMM d, yyyy"),
          status: Number(m.status),
          outcome: m.outcome,
          totalYesPool: BigInt(m.totalYesPool),
          totalNoPool: BigInt(m.totalNoPool),
          totalPool: BigInt(m.totalYesPool) + BigInt(m.totalNoPool),
          totalBids: BigInt(m.totalBids),
          settlementRationale: m.settlementRationale,
        });
      }

      // Listen for MarketCreated to refresh
      contract.on("MarketCreated", () => {
        fetchMarkets();
      });

      setMarkets(marketList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    return () => {
      // cleanup listeners
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(
        SHADOWMARKET_ADDRESS,
        SHADOWMARKET_ABI,
        provider
      );
      contract.removeAllListeners();
    };
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
