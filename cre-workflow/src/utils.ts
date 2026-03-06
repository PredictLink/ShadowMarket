import { ethers } from "ethers";

/**
 * Compute a commitment hash matching the Solidity keccak256(abi.encode(amount, side, salt)).
 * @param amount USDC amount in 6-decimal bigint units
 * @param side true = YES, false = NO
 * @param salt Arbitrary secret string (will be hashed with ethers.id first)
 */
export function generateCommitmentHash(
  amount: bigint,
  side: boolean,
  salt: string
): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "bool", "bytes32"],
      [amount, side, ethers.id(salt)]
    )
  );
}

/**
 * Format a raw USDC amount (6-decimal bigint) as a human-readable string.
 * @param amount Raw USDC amount (e.g. 1000000n = 1.00 USDC)
 */
export function formatUSDC(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = amount % 1_000_000n;
  const fractionStr = fraction.toString().padStart(6, "0").slice(0, 2);
  return `${whole}.${fractionStr}`;
}

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * @param fn Async function to retry
 * @param maxRetries Maximum number of retry attempts (not counting the first call)
 * @param baseDelayMs Base delay in milliseconds (doubles on each retry)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
