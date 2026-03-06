import { ethers } from "ethers";

export interface BidData {
  amount: string;
  side: boolean;
  salt: string;
  commitment: string;
}

/**
 * Generate a cryptographically random 32-byte hex string for use as a salt.
 * Throws if the Web Crypto API is unavailable (e.g., non-secure context).
 */
export function generateSalt(): string {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    throw new Error(
      "Secure random number generation is not available. " +
        "ShadowMarket requires a browser with Web Crypto API (secure context / HTTPS)."
    );
  }
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute commitment hash matching Solidity: keccak256(abi.encode(amount, side, salt))
 * The salt parameter is expected to be a 32-byte hex string (bytes32).
 */
export function computeCommitment(
  amount: bigint,
  side: boolean,
  salt: string
): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "bool", "bytes32"],
      [amount, side, salt]
    )
  );
}

/**
 * Store bid data in localStorage for later reveal.
 */
export function storeBidData(
  marketId: number,
  address: string,
  amount: string,
  side: boolean,
  salt: string
): void {
  const commitment = computeCommitment(
    ethers.parseUnits(amount, 6),
    side,
    salt
  );
  const key = `shadow_bid_${marketId}_${address.toLowerCase()}`;
  localStorage.setItem(key, JSON.stringify({ amount, side, salt, commitment }));
}

/**
 * Load stored bid data from localStorage.
 */
export function loadBidData(marketId: number, address: string): BidData | null {
  if (typeof window === "undefined") return null;
  const key = `shadow_bid_${marketId}_${address.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BidData;
  } catch {
    return null;
  }
}

/**
 * Clear stored bid data from localStorage.
 */
export function clearBidData(marketId: number, address: string): void {
  if (typeof window === "undefined") return;
  const key = `shadow_bid_${marketId}_${address.toLowerCase()}`;
  localStorage.removeItem(key);
}
