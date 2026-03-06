"use client";

interface StatusBadgeProps {
  status: number; // 0=OPEN, 1=RESOLVING, 2=SETTLED
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-500/30 shadow-sm shadow-green-900/20">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        OPEN
      </span>
    );
  }

  if (status === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-500/30 animate-status-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
        RESOLVING
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-400 border border-blue-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      SETTLED
    </span>
  );
}
