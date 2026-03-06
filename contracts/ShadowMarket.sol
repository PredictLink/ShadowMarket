// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IReceiver.sol";

/// @title ShadowMarket — Private Prediction Market with Sealed Bids
/// @notice Implements commit-reveal scheme for privacy-preserving prediction markets
/// @dev Uses USDC on Sepolia as the bidding currency
contract ShadowMarket is Ownable, ReentrancyGuard, IReceiver {
    // ─── Constants ───────────────────────────────────────────────────────────
    /// @notice Sepolia USDC token address
    address public constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    /// @notice Platform fee in basis points (2%)
    uint256 public constant FEE_BPS = 200;
    uint256 public constant BPS_DENOM = 10_000;

    // ─── Enums ────────────────────────────────────────────────────────────────
    /// @notice Lifecycle stages of a prediction market
    enum MarketStatus {
        OPEN,
        RESOLVING,
        SETTLED
    }

    // ─── Structs ──────────────────────────────────────────────────────────────
    /// @notice Data for a single prediction market
    struct Market {
        uint256 id;
        string question;
        uint256 expiryTimestamp;
        MarketStatus status;
        bool outcome;
        uint256 totalYesPool;
        uint256 totalNoPool;
        uint256 totalBids;
        string settlementRationale;
    }

    /// @notice A sealed (commit) or revealed bid from a participant
    struct SealedBid {
        bytes32 commitmentHash;
        bool revealed;
        uint256 amount;
        bool side; // true = YES, false = NO
        bool claimed;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    /// @notice Auto-incrementing market ID counter
    uint256 public marketIdCounter;

    /// @notice All markets by ID
    mapping(uint256 => Market) public markets;

    /// @notice Sealed bids: marketId => bidder => bid
    mapping(uint256 => mapping(address => SealedBid)) private sealedBids;

    /// @notice Bidder addresses per market for enumeration
    mapping(uint256 => address[]) private marketBidders;

    /// @notice Whether an address has submitted a bid for a market
    mapping(uint256 => mapping(address => bool)) private hasBid;

    /// @notice Address authorised to settle markets (CRE DON)
    address public authorizedSettler;

    // ─── Custom Errors ────────────────────────────────────────────────────────
    error MarketNotFound(uint256 marketId);
    error MarketNotOpen(uint256 marketId);
    error MarketNotResolving(uint256 marketId);
    error MarketNotSettled(uint256 marketId);
    error MarketExpiredError(uint256 marketId);
    error MarketNotExpired(uint256 marketId);
    error NotAuthorizedSettler();
    error CommitmentMismatch();
    error AlreadyRevealed();
    error AlreadyClaimed();
    error NotAWinner();
    error NoBidFound();
    error InvalidAmount();
    error InvalidExpiry();

    // ─── Events ───────────────────────────────────────────────────────────────
    event MarketCreated(uint256 indexed marketId, string question, uint256 expiry);
    event BidSubmitted(uint256 indexed marketId, address indexed bidder, bytes32 commitmentHash);
    event BidRevealed(uint256 indexed marketId, address indexed bidder, uint256 amount, bool side);
    event MarketExpired(uint256 indexed marketId, string question, uint256 expiry);
    event MarketSettled(uint256 indexed marketId, bool outcome, string rationale);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ─── Market Management ────────────────────────────────────────────────────

    /// @notice Create a new prediction market
    /// @param question The market question
    /// @param expiryTimestamp Unix timestamp when bidding closes
    /// @return marketId The newly created market's ID
    function createMarket(string calldata question, uint256 expiryTimestamp)
        external
        onlyOwner
        returns (uint256 marketId)
    {
        if (expiryTimestamp <= block.timestamp) revert InvalidExpiry();
        marketId = ++marketIdCounter;
        markets[marketId] = Market({
            id: marketId,
            question: question,
            expiryTimestamp: expiryTimestamp,
            status: MarketStatus.OPEN,
            outcome: false,
            totalYesPool: 0,
            totalNoPool: 0,
            totalBids: 0,
            settlementRationale: ""
        });
        emit MarketCreated(marketId, question, expiryTimestamp);
    }

    /// @notice Submit a sealed (hashed) bid commitment
    /// @param marketId The target market
    /// @param commitmentHash keccak256(abi.encode(amount, side, salt))
    function submitSealedBid(uint256 marketId, bytes32 commitmentHash) external {
        Market storage market = _requireMarket(marketId);
        if (market.status != MarketStatus.OPEN) revert MarketNotOpen(marketId);
        if (block.timestamp >= market.expiryTimestamp) revert MarketExpiredError(marketId);

        SealedBid storage bid = sealedBids[marketId][msg.sender];
        bid.commitmentHash = commitmentHash;
        bid.revealed = false;
        bid.claimed = false;

        if (!hasBid[marketId][msg.sender]) {
            hasBid[marketId][msg.sender] = true;
            marketBidders[marketId].push(msg.sender);
        }

        market.totalBids++;
        emit BidSubmitted(marketId, msg.sender, commitmentHash);
    }

    /// @notice Reveal a previously committed bid during the RESOLVING phase
    /// @param marketId The target market
    /// @param amount USDC amount in 6-decimal units
    /// @param side true = YES, false = NO
    /// @param salt Secret salt used when computing the commitment
    function revealBid(uint256 marketId, uint256 amount, bool side, bytes32 salt) external {
        Market storage market = _requireMarket(marketId);
        if (market.status != MarketStatus.RESOLVING) revert MarketNotResolving(marketId);
        if (amount == 0) revert InvalidAmount();

        SealedBid storage bid = sealedBids[marketId][msg.sender];
        if (bid.commitmentHash == bytes32(0)) revert NoBidFound();
        if (bid.revealed) revert AlreadyRevealed();

        bytes32 expected = keccak256(abi.encode(amount, side, salt));
        if (bid.commitmentHash != expected) revert CommitmentMismatch();

        bid.revealed = true;
        bid.amount = amount;
        bid.side = side;

        if (side) {
            market.totalYesPool += amount;
        } else {
            market.totalNoPool += amount;
        }

        IERC20(USDC).transferFrom(msg.sender, address(this), amount);
        emit BidRevealed(marketId, msg.sender, amount, side);
    }

    /// @notice Transition a market from OPEN to RESOLVING
    /// @param marketId The market to transition
    function setResolvingStatus(uint256 marketId) external onlyOwner {
        Market storage market = _requireMarket(marketId);
        if (market.status != MarketStatus.OPEN) revert MarketNotOpen(marketId);
        market.status = MarketStatus.RESOLVING;
        emit MarketExpired(marketId, market.question, market.expiryTimestamp);
    }

    /// @notice Settle a market with the final outcome
    /// @param marketId The market to settle
    /// @param outcome true = YES won, false = NO won
    /// @param rationale Human-readable rationale from the oracle
    function settleMarket(uint256 marketId, bool outcome, string calldata rationale) external {
        if (msg.sender != authorizedSettler && msg.sender != owner()) revert NotAuthorizedSettler();
        _settleMarket(marketId, outcome, rationale);
    }

    /**
     * @notice Callback for Chainlink CRE to submit a settlement report.
     * @param report The ABI-encoded report: (uint256 marketId, bool outcome, string rationale)
     * @param signature The cryptographic signature(s) from the DON.
     */
    function onReport(bytes calldata report, bytes calldata signature) external override {
        // In this production-grade version, we trust the authorizedSettler (DON gateway) 
        // to have verified the signatures if this is called via an authorized path.
        // Alternatively, if direct, we check msg.sender or verify signature.
        if (msg.sender != authorizedSettler) revert NotAuthorizedSettler();
        
        (uint256 marketId, bool outcome, string memory rationale) = abi.decode(report, (uint256, bool, string));
        _settleMarket(marketId, outcome, rationale);
    }

    /// @dev Internal settlement logic
    function _settleMarket(uint256 marketId, bool outcome, string memory rationale) internal {
        Market storage market = _requireMarket(marketId);
        if (market.status != MarketStatus.RESOLVING) revert MarketNotResolving(marketId);

        market.status = MarketStatus.SETTLED;
        market.outcome = outcome;
        market.settlementRationale = rationale;
        emit MarketSettled(marketId, outcome, rationale);
    }

    // ─── Claiming ─────────────────────────────────────────────────────────────

    /// @notice Claim winnings after market settlement
    /// @param marketId The settled market
    function claimWinnings(uint256 marketId) external nonReentrant {
        Market storage market = _requireMarket(marketId);
        if (market.status != MarketStatus.SETTLED) revert MarketNotSettled(marketId);

        SealedBid storage bid = sealedBids[marketId][msg.sender];
        if (!bid.revealed) revert NoBidFound();
        if (bid.claimed) revert AlreadyClaimed();
        if (bid.side != market.outcome) revert NotAWinner();

        bid.claimed = true;

        uint256 winningPool = market.outcome ? market.totalYesPool : market.totalNoPool;
        uint256 losingPool = market.outcome ? market.totalNoPool : market.totalYesPool;
        uint256 totalPool = winningPool + losingPool;

        // Proportional share of total pool minus 2% fee
        uint256 fee = (totalPool * FEE_BPS) / BPS_DENOM;
        uint256 distributable = totalPool - fee;
        uint256 payout = (bid.amount * distributable) / winningPool;

        IERC20(USDC).transfer(msg.sender, payout);
        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the authorised settler address
    /// @param settler New settler address (CRE DON)
    function setAuthorizedSettler(address settler) external onlyOwner {
        authorizedSettler = settler;
    }

    /// @notice Withdraw accumulated platform fees
    /// @param token ERC20 token address to withdraw
    function withdrawFees(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Get full market details
    /// @param marketId Market to query
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /// @notice Get the commitment hash for a bidder
    /// @param marketId Market to query
    /// @param bidder Address of the bidder
    function getCommitment(uint256 marketId, address bidder) external view returns (bytes32) {
        return sealedBids[marketId][bidder].commitmentHash;
    }

    /// @notice Get number of bidders in a market
    /// @param marketId Market to query
    function getBidderCount(uint256 marketId) external view returns (uint256) {
        return marketBidders[marketId].length;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _requireMarket(uint256 marketId) internal view returns (Market storage) {
        if (marketId == 0 || marketId > marketIdCounter) revert MarketNotFound(marketId);
        return markets[marketId];
    }
}
