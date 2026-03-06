"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { SHADOWMARKET_ABI, SHADOWMARKET_ADDRESS, RPC_URL } from "../lib/contract";

interface ActivityEvent {
  type: "BidSubmitted" | "BidRevealed" | "MarketSettled";
  timestamp: number;
  data: Record<string, unknown>;
}

interface ActivityFeedProps {
  marketId: number;
}

function formatEvent(event: ActivityEvent) {
  if (event.type === "BidSubmitted") {
    const hash = event.data.commitmentHash as string;
    return `🔒 A sealed position was recorded (hash: ${hash.slice(0, 6)}...${hash.slice(-4)})`;
  }
  if (event.type === "BidRevealed") {
    const side = event.data.side ? "YES" : "NO";
    const amount = parseFloat(
      ethers.formatUnits(BigInt(event.data.amount as string), 6)
    ).toFixed(2);
    return `👁 A position was revealed: ${side} for ${amount} USDC`;
  }
  if (event.type === "MarketSettled") {
    const outcome = event.data.outcome ? "YES" : "NO";
    return `⚖️ Oracle settled: ${outcome}`;
  }
  return "Unknown event";
}

export default function ActivityFeed({ marketId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!SHADOWMARKET_ADDRESS) {
      setLoading(false);
      return;
    }
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(
        SHADOWMARKET_ADDRESS,
        SHADOWMARKET_ABI,
        provider
      );

      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000);

      const bidFilter = contract.filters.BidSubmitted(marketId);
      const revealFilter = contract.filters.BidRevealed(marketId);
      const settleFilter = contract.filters.MarketSettled(marketId);

      const [bidLogs, revealLogs, settleLogs] = await Promise.all([
        contract.queryFilter(bidFilter, fromBlock),
        contract.queryFilter(revealFilter, fromBlock),
        contract.queryFilter(settleFilter, fromBlock),
      ]);

      const allEvents: ActivityEvent[] = [
        ...bidLogs.map((log) => ({
          type: "BidSubmitted" as const,
          timestamp: log.blockNumber,
          data: { commitmentHash: (log as any).args[2] as string },
        })),
        ...revealLogs.map((log) => ({
          type: "BidRevealed" as const,
          timestamp: log.blockNumber,
          data: {
            amount: ((log as any).args[2] as bigint).toString(),
            side: (log as any).args[3] as boolean,
          },
        })),
        ...settleLogs.map((log) => ({
          type: "MarketSettled" as const,
          timestamp: log.blockNumber,
          data: { outcome: (log as any).args[1] as boolean },
        })),
      ].sort((a, b) => b.timestamp - a.timestamp);

      setEvents(allEvents);
    } catch {
      // Silent fail for feed
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 15_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return (
    <div className="p-5 rounded-xl bg-shadow-800 border border-purple-900/30">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Activity Feed
      </h3>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-shadow-900 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-4">No activity yet.</p>
      )}

      <div className="space-y-0 max-h-80 overflow-y-auto">
        {events.map((event, i) => (
          <div
            key={i}
            className="py-3 border-b border-purple-900/20 last:border-0"
          >
            <p className="text-slate-300 text-sm">{formatEvent(event)}</p>
            <p className="text-slate-600 text-xs mt-0.5">Block #{event.timestamp}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 mt-3 text-center">
        Refreshes every 15s
      </p>
    </div>
  );
}
