/**
 * CRE Workflow shared types for ShadowMarket settlement.
 */

/** Input request decoded from the MarketExpired EVM log */
export interface MarketResolutionRequest {
  marketId: number;
  question: string;
  expiryTimestamp: number;
  contractAddress: string;
}

/** Result produced by the Gemini settlement engine */
export interface SettlementResult {
  marketId: number;
  outcome: boolean;
  rationale: string;
  confidence: number;
  sources: string[];
}
