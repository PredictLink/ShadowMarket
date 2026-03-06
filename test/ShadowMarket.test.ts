import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const USDC_DECIMALS = 6n;
const parseUSDC = (amount: string) => ethers.parseUnits(amount, USDC_DECIMALS);

function computeCommitment(amount: bigint, side: boolean, salt: string): string {
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bool", "bytes32"],
    [amount, side, salt]
  ));
}

describe("ShadowMarket", function () {
  // We use a test helper contract that accepts a configurable USDC address
  // to avoid depending on a real Sepolia USDC deployment in unit tests.

  async function deployTestFixture() {
    const [owner, settler, alice, bob, charlie] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = (await MockUSDCFactory.deploy()) as MockUSDC;

    const ShadowMarketTestFactory = await ethers.getContractFactory("ShadowMarketTest");
    const shadowMarket = await ShadowMarketTestFactory.deploy(await usdc.getAddress());

    const mintAmount = parseUSDC("10000");
    await usdc.mint(alice.address, mintAmount);
    await usdc.mint(bob.address, mintAmount);
    await usdc.mint(charlie.address, mintAmount);

    const shadowMarketAddress = await shadowMarket.getAddress();
    await usdc.connect(alice).approve(shadowMarketAddress, ethers.MaxUint256);
    await usdc.connect(bob).approve(shadowMarketAddress, ethers.MaxUint256);
    await usdc.connect(charlie).approve(shadowMarketAddress, ethers.MaxUint256);

    await shadowMarket.setAuthorizedSettler(settler.address);

    const now = await time.latest();
    const expiry = now + 7 * 24 * 3600;

    return { shadowMarket, usdc, owner, settler, alice, bob, charlie, expiry };
  }

  it("should create a market", async function () {
    const { shadowMarket, owner, expiry } = await loadFixture(deployTestFixture);

    const question = "Will ETH exceed $3,500 by March 1, 2026?";
    const tx = await shadowMarket.createMarket(question, expiry);
    await tx.wait();

    await expect(tx)
      .to.emit(shadowMarket, "MarketCreated")
      .withArgs(1n, question, BigInt(expiry));

    const market = await shadowMarket.getMarket(1n);
    expect(market.id).to.equal(1n);
    expect(market.question).to.equal(question);
    expect(market.expiryTimestamp).to.equal(BigInt(expiry));
    expect(market.status).to.equal(0); // OPEN
  });

  it("should accept sealed bids", async function () {
    const { shadowMarket, alice, expiry } = await loadFixture(deployTestFixture);

    await shadowMarket.createMarket("Test question?", expiry);

    const salt = ethers.id("my-secret-salt");
    const commitment = computeCommitment(parseUSDC("100"), true, salt);

    await expect(shadowMarket.connect(alice).submitSealedBid(1n, commitment))
      .to.emit(shadowMarket, "BidSubmitted")
      .withArgs(1n, alice.address, commitment);

    expect(await shadowMarket.getCommitment(1n, alice.address)).to.equal(commitment);
    expect(await shadowMarket.getBidderCount(1n)).to.equal(1n);
  });

  it("should reject bid after expiry", async function () {
    const { shadowMarket, alice, expiry } = await loadFixture(deployTestFixture);

    await shadowMarket.createMarket("Test question?", expiry);

    // Fast-forward past expiry
    await time.increaseTo(expiry + 1);

    const salt = ethers.id("salt");
    const commitment = computeCommitment(parseUSDC("100"), true, salt);

    await expect(shadowMarket.connect(alice).submitSealedBid(1n, commitment))
      .to.be.revertedWithCustomError(shadowMarket, "MarketExpiredError");
  });

  it("should reveal bid correctly", async function () {
    const { shadowMarket, alice, expiry } = await loadFixture(deployTestFixture);

    await shadowMarket.createMarket("Test question?", expiry);

    const amount = parseUSDC("100");
    const side = true;
    const salt = ethers.id("my-salt");
    const commitment = computeCommitment(amount, side, salt);

    await shadowMarket.connect(alice).submitSealedBid(1n, commitment);

    // Transition to RESOLVING
    await shadowMarket.setResolvingStatus(1n);

    await expect(shadowMarket.connect(alice).revealBid(1n, amount, side, salt))
      .to.emit(shadowMarket, "BidRevealed")
      .withArgs(1n, alice.address, amount, side);

    const market = await shadowMarket.getMarket(1n);
    expect(market.totalYesPool).to.equal(amount);
  });

  it("should reject bad reveal (wrong salt)", async function () {
    const { shadowMarket, alice, expiry } = await loadFixture(deployTestFixture);

    await shadowMarket.createMarket("Test question?", expiry);

    const amount = parseUSDC("100");
    const side = true;
    const salt = ethers.id("correct-salt");
    const commitment = computeCommitment(amount, side, salt);

    await shadowMarket.connect(alice).submitSealedBid(1n, commitment);
    await shadowMarket.setResolvingStatus(1n);

    const wrongSalt = ethers.id("wrong-salt");
    await expect(shadowMarket.connect(alice).revealBid(1n, amount, side, wrongSalt))
      .to.be.revertedWithCustomError(shadowMarket, "CommitmentMismatch");
  });

  it("should settle via authorized settler", async function () {
    const { shadowMarket, settler, expiry } = await loadFixture(deployTestFixture);

    await shadowMarket.createMarket("Test question?", expiry);
    await shadowMarket.setResolvingStatus(1n);

    const rationale = "AI oracle confirmed YES outcome.";
    await expect(shadowMarket.connect(settler).settleMarket(1n, true, rationale))
      .to.emit(shadowMarket, "MarketSettled")
      .withArgs(1n, true, rationale);

    const market = await shadowMarket.getMarket(1n);
    expect(market.outcome).to.equal(true);
    expect(market.status).to.equal(2); // SETTLED
    expect(market.settlementRationale).to.equal(rationale);
  });

  it("should reject settlement from non-settler", async function () {
    const { shadowMarket, alice, expiry } = await loadFixture(deployTestFixture);

    await shadowMarket.createMarket("Test question?", expiry);
    await shadowMarket.setResolvingStatus(1n);

    await expect(shadowMarket.connect(alice).settleMarket(1n, true, "rationale"))
      .to.be.revertedWithCustomError(shadowMarket, "NotAuthorizedSettler");
  });

  it("should pay winners correctly (full flow)", async function () {
    const { shadowMarket, usdc, settler, alice, bob, charlie, expiry } =
      await loadFixture(deployTestFixture);

    const shadowMarketAddress = await shadowMarket.getAddress();

    await shadowMarket.createMarket("Test question?", expiry);

    // alice: YES 100 USDC, charlie: YES 200 USDC, bob: NO 50 USDC
    const aliceAmount = parseUSDC("100");
    const bobAmount = parseUSDC("50");
    const charlieAmount = parseUSDC("200");

    const saltAlice = ethers.id("alice-salt");
    const saltBob = ethers.id("bob-salt");
    const saltCharlie = ethers.id("charlie-salt");

    await shadowMarket.connect(alice).submitSealedBid(1n, computeCommitment(aliceAmount, true, saltAlice));
    await shadowMarket.connect(bob).submitSealedBid(1n, computeCommitment(bobAmount, false, saltBob));
    await shadowMarket.connect(charlie).submitSealedBid(1n, computeCommitment(charlieAmount, true, saltCharlie));

    // Transition to RESOLVING
    await shadowMarket.setResolvingStatus(1n);

    // Reveal all bids
    await shadowMarket.connect(alice).revealBid(1n, aliceAmount, true, saltAlice);
    await shadowMarket.connect(bob).revealBid(1n, bobAmount, false, saltBob);
    await shadowMarket.connect(charlie).revealBid(1n, charlieAmount, true, saltCharlie);

    // Settle: YES wins
    await shadowMarket.connect(settler).settleMarket(1n, true, "YES confirmed");

    const aliceBalBefore = await usdc.balanceOf(alice.address);
    const charlieBalBefore = await usdc.balanceOf(charlie.address);

    // total pool = 350, fee = 7, distributable = 343
    // YES pool = 300, NO pool = 50
    // alice share: 100/300 * 343 ≈ 114.33 → 114333333 (integer math)
    // charlie share: 200/300 * 343 ≈ 228.66 → 228666666 (integer math)

    await shadowMarket.connect(alice).claimWinnings(1n);
    await shadowMarket.connect(charlie).claimWinnings(1n);

    const aliceBalAfter = await usdc.balanceOf(alice.address);
    const charlieBalAfter = await usdc.balanceOf(charlie.address);

    const totalPool = aliceAmount + bobAmount + charlieAmount;
    const fee = (totalPool * 200n) / 10000n;
    const distributable = totalPool - fee;
    const yesPool = aliceAmount + charlieAmount;

    const expectedAlice = (aliceAmount * distributable) / yesPool;
    const expectedCharlie = (charlieAmount * distributable) / yesPool;

    expect(aliceBalAfter - aliceBalBefore).to.equal(expectedAlice);
    expect(charlieBalAfter - charlieBalBefore).to.equal(expectedCharlie);
  });

  it("should block double claim", async function () {
    const { shadowMarket, settler, alice, expiry } = await loadFixture(deployTestFixture);

    await shadowMarket.createMarket("Test question?", expiry);

    const amount = parseUSDC("100");
    const salt = ethers.id("salt");
    const commitment = computeCommitment(amount, true, salt);

    await shadowMarket.connect(alice).submitSealedBid(1n, commitment);
    await shadowMarket.setResolvingStatus(1n);
    await shadowMarket.connect(alice).revealBid(1n, amount, true, salt);
    await shadowMarket.connect(settler).settleMarket(1n, true, "YES wins");

    await shadowMarket.connect(alice).claimWinnings(1n);

    await expect(shadowMarket.connect(alice).claimWinnings(1n))
      .to.be.revertedWithCustomError(shadowMarket, "AlreadyClaimed");
  });

  it("should allow fee withdrawal", async function () {
    const { shadowMarket, usdc, owner, settler, alice, bob, expiry } =
      await loadFixture(deployTestFixture);

    const shadowMarketAddress = await shadowMarket.getAddress();

    await shadowMarket.createMarket("Test question?", expiry);

    const aliceAmount = parseUSDC("100");
    const bobAmount = parseUSDC("50");

    const saltAlice = ethers.id("a");
    const saltBob = ethers.id("b");

    await shadowMarket.connect(alice).submitSealedBid(1n, computeCommitment(aliceAmount, true, saltAlice));
    await shadowMarket.connect(bob).submitSealedBid(1n, computeCommitment(bobAmount, false, saltBob));

    await shadowMarket.setResolvingStatus(1n);
    await shadowMarket.connect(alice).revealBid(1n, aliceAmount, true, saltAlice);
    await shadowMarket.connect(bob).revealBid(1n, bobAmount, false, saltBob);
    await shadowMarket.connect(settler).settleMarket(1n, true, "YES wins");

    await shadowMarket.connect(alice).claimWinnings(1n);

    // Some USDC remains in contract as fees
    const contractBalance = await usdc.balanceOf(shadowMarketAddress);
    expect(contractBalance).to.be.gt(0n);

    const ownerBalBefore = await usdc.balanceOf(owner.address);
    await shadowMarket.withdrawFees(await usdc.getAddress());
    const ownerBalAfter = await usdc.balanceOf(owner.address);

    expect(ownerBalAfter - ownerBalBefore).to.equal(contractBalance);
  });
});
