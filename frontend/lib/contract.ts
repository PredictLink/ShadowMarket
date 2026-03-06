// ShadowMarket contract ABI and addresses

export const SHADOWMARKET_ABI = [
  // View functions
  "function getMarket(uint256 marketId) external view returns (tuple(uint256 id, string question, uint256 expiryTimestamp, uint8 status, bool outcome, uint256 totalYesPool, uint256 totalNoPool, uint256 totalBids, string settlementRationale))",
  "function getCommitment(uint256 marketId, address bidder) external view returns (bytes32)",
  "function getBidderCount(uint256 marketId) external view returns (uint256)",
  "function marketIdCounter() external view returns (uint256)",
  "function authorizedSettler() external view returns (address)",

  // Write functions
  "function createMarket(string calldata question, uint256 expiryTimestamp) external returns (uint256)",
  "function submitSealedBid(uint256 marketId, bytes32 commitmentHash) external",
  "function revealBid(uint256 marketId, uint256 amount, bool side, bytes32 salt) external",
  "function settleMarket(uint256 marketId, bool outcome, string calldata rationale) external",
  "function claimWinnings(uint256 marketId) external",
  "function setResolvingStatus(uint256 marketId) external",
  "function setAuthorizedSettler(address settler) external",
  "function withdrawFees(address token) external",

  // Events
  "event MarketCreated(uint256 indexed marketId, string question, uint256 expiry)",
  "event BidSubmitted(uint256 indexed marketId, address indexed bidder, bytes32 commitmentHash)",
  "event BidRevealed(uint256 indexed marketId, address indexed bidder, uint256 amount, bool side)",
  "event MarketExpired(uint256 indexed marketId, string question, uint256 expiry)",
  "event MarketSettled(uint256 indexed marketId, bool outcome, string rationale)",
  "event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount)",
] as const;

export const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
] as const;

export const SHADOWMARKET_ADDRESS =
  process.env.NEXT_PUBLIC_SHADOWMARKET_ADDRESS ?? "";

export const USDC_ADDRESS_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

export const CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111",
  10
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://rpc.sepolia.org";
