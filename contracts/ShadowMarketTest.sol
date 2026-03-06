// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ShadowMarketTest — Test version of ShadowMarket with configurable USDC address
/// @dev Used in Hardhat tests to inject a MockUSDC address
contract ShadowMarketTest is Ownable, ReentrancyGuard {
    uint256 public constant FEE_BPS = 200;
    uint256 public constant BPS_DENOM = 10_000;

    address public immutable USDC;

    enum MarketStatus { OPEN, RESOLVING, SETTLED }

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

    struct SealedBid {
        bytes32 commitmentHash;
        bool revealed;
        uint256 amount;
        bool side;
        bool claimed;
    }

    uint256 public marketIdCounter;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => SealedBid)) private sealedBids;
    mapping(uint256 => address[]) private marketBidders;
    mapping(uint256 => mapping(address => bool)) private hasBid;
    address public authorizedSettler;

    error MarketNotFound(uint256 marketId);
    error MarketNotOpen(uint256 marketId);
    error MarketNotResolving(uint256 marketId);
    error MarketNotSettled(uint256 marketId);
    error MarketExpiredError(uint256 marketId);
    error InvalidExpiry();
    error NotAuthorizedSettler();
    error CommitmentMismatch();
    error AlreadyRevealed();
    error AlreadyClaimed();
    error NotAWinner();
    error NoBidFound();
    error InvalidAmount();

    event MarketCreated(uint256 indexed marketId, string question, uint256 expiry);
    event BidSubmitted(uint256 indexed marketId, address indexed bidder, bytes32 commitmentHash);
    event BidRevealed(uint256 indexed marketId, address indexed bidder, uint256 amount, bool side);
    event MarketExpired(uint256 indexed marketId, string question, uint256 expiry);
    event MarketSettled(uint256 indexed marketId, bool outcome, string rationale);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    constructor(address usdcAddress) Ownable(msg.sender) {
        USDC = usdcAddress;
    }

    function createMarket(string calldata question, uint256 expiryTimestamp)
        external onlyOwner returns (uint256 marketId)
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

    function setResolvingStatus(uint256 marketId) external onlyOwner {
        Market storage market = _requireMarket(marketId);
        if (market.status != MarketStatus.OPEN) revert MarketNotOpen(marketId);
        market.status = MarketStatus.RESOLVING;
        emit MarketExpired(marketId, market.question, market.expiryTimestamp);
    }

    function settleMarket(uint256 marketId, bool outcome, string calldata rationale) external {
        if (msg.sender != authorizedSettler) revert NotAuthorizedSettler();
        Market storage market = _requireMarket(marketId);
        if (market.status != MarketStatus.RESOLVING) revert MarketNotResolving(marketId);
        market.status = MarketStatus.SETTLED;
        market.outcome = outcome;
        market.settlementRationale = rationale;
        emit MarketSettled(marketId, outcome, rationale);
    }

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

        uint256 fee = (totalPool * FEE_BPS) / BPS_DENOM;
        uint256 distributable = totalPool - fee;
        uint256 payout = (bid.amount * distributable) / winningPool;

        IERC20(USDC).transfer(msg.sender, payout);
        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    function setAuthorizedSettler(address settler) external onlyOwner {
        authorizedSettler = settler;
    }

    function withdrawFees(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getCommitment(uint256 marketId, address bidder) external view returns (bytes32) {
        return sealedBids[marketId][bidder].commitmentHash;
    }

    function getBidderCount(uint256 marketId) external view returns (uint256) {
        return marketBidders[marketId].length;
    }

    function _requireMarket(uint256 marketId) internal view returns (Market storage) {
        if (marketId == 0 || marketId > marketIdCounter) revert MarketNotFound(marketId);
        return markets[marketId];
    }
}
