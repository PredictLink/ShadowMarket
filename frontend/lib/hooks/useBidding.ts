"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  SHADOWMARKET_ABI,
  SHADOWMARKET_ADDRESS,
  USDC_ABI,
  USDC_ADDRESS_SEPOLIA,
} from "../contract";
import {
  generateSalt,
  computeCommitment,
  storeBidData,
  loadBidData,
  clearBidData,
} from "../crypto";

export function useBidding(marketId: number) {
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSigner = async (): Promise<ethers.Signer> => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("No wallet detected. Please install MetaMask.");
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    return provider.getSigner();
  };

  const submitSealedBid = useCallback(
    async (amount: string, side: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const signer = await getSigner();
        const address = await signer.getAddress();

        const salt = generateSalt();
        const amountBn = ethers.parseUnits(amount, 6);
        const commitment = computeCommitment(amountBn, side, salt);

        // Store to localStorage before sending tx (in case tx fails, user still has salt)
        storeBidData(marketId, address, amount, side, salt);

        const contract = new ethers.Contract(
          SHADOWMARKET_ADDRESS,
          SHADOWMARKET_ABI,
          signer
        );
        const tx = await contract.submitSealedBid(marketId, commitment);
        const receipt = await tx.wait();
        setTxHash(receipt.hash);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transaction failed");
      } finally {
        setLoading(false);
      }
    },
    [marketId]
  );

  const revealBid = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const signer = await getSigner();
      const address = await signer.getAddress();

      const bidData = loadBidData(marketId, address);
      if (!bidData) throw new Error("No stored bid data found for this market.");

      const amountBn = ethers.parseUnits(bidData.amount, 6);

      // Check and approve USDC allowance
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS_SEPOLIA,
        USDC_ABI,
        signer
      );
      const allowance = await usdcContract.allowance(address, SHADOWMARKET_ADDRESS);
      if (BigInt(allowance) < amountBn) {
        const approveTx = await usdcContract.approve(
          SHADOWMARKET_ADDRESS,
          ethers.MaxUint256
        );
        await approveTx.wait();
      }

      const contract = new ethers.Contract(
        SHADOWMARKET_ADDRESS,
        SHADOWMARKET_ABI,
        signer
      );
      const tx = await contract.revealBid(
        marketId,
        amountBn,
        bidData.side,
        bidData.salt
      );
      const receipt = await tx.wait();
      setTxHash(receipt.hash);

      clearBidData(marketId, address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reveal failed");
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  const claimWinnings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(
        SHADOWMARKET_ADDRESS,
        SHADOWMARKET_ABI,
        signer
      );
      const tx = await contract.claimWinnings(marketId);
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  return { submitSealedBid, revealBid, claimWinnings, loading, txHash, error };
}
