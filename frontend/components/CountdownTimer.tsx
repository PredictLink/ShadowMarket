"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  expiry: number; // Unix timestamp
}

export default function CountdownTimer({ expiry }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        setIsUrgent(false);
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setIsUrgent(diff < 3600); // turn red under 1 hour

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiry]);

  return (
    <span
      className={`font-mono text-sm font-semibold ${
        isUrgent ? "text-red-400 animate-pulse" : "text-slate-200"
      }`}
    >
      {timeLeft}
    </span>
  );
}
