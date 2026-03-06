/**
 * E2E test script — runs a full lifecycle on the local Hardhat node.
 * Run with: npx hardhat run scripts/e2e-test.ts
 */
import { ethers } from "ethers";
import * as hre from "hardhat";

const USDC_DECIMALS = 6n;
const parseUSDC = (amount: string) => ethers.parseUnits(amount, USDC_DECIMALS);

function computeCommitment(amount: bigint, side: boolean, salt: string): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "bool", "bytes32"],
      [amount, side, salt]
    )
  );
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function main() {
  console.log("\nShadowMarket E2E Test\n" + "=".repeat(40));

  const [owner, account1, account2, account3] = await hre.ethers.getSigners();

  // Deploy contracts
  console.log("\n1. Deploying contracts...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const ShadowMarketTest = await hre.ethers.getContractFactory("ShadowMarketTest");
  const shadowMarket = await ShadowMarketTest.deploy(await usdc.getAddress());
  await shadowMarket.waitForDeployment();

  await shadowMarket.setAuthorizedSettler(owner.address);

  // Mint USDC
  await usdc.mint(account1.address, parseUSDC("10000"));
  await usdc.mint(account2.address, parseUSDC("10000"));
  await usdc.mint(account3.address, parseUSDC("10000"));

  const contractAddress = await shadowMarket.getAddress();
  await usdc.connect(account1).approve(contractAddress, ethers.MaxUint256);
  await usdc.connect(account2).approve(contractAddress, ethers.MaxUint256);
  await usdc.connect(account3).approve(contractAddress, ethers.MaxUint256);

  console.log("  Contract deployed:", contractAddress);

  // Create market
  console.log("\n2. Creating market...");
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour
  await shadowMarket.createMarket("E2E test market?", expiry);
  check("Market created with ID 1", (await shadowMarket.marketIdCounter()) === 1n);

  // Submit sealed bids
  console.log("\n3. Submitting sealed bids...");
  const salt1 = ethers.id("salt-account1");
  const salt2 = ethers.id("salt-account2");
  const salt3 = ethers.id("salt-account3");

  const amount1 = parseUSDC("100"); // YES
  const amount2 = parseUSDC("50");  // NO
  const amount3 = parseUSDC("200"); // YES

  await shadowMarket.connect(account1).submitSealedBid(1, computeCommitment(amount1, true, salt1));
  await shadowMarket.connect(account2).submitSealedBid(1, computeCommitment(amount2, false, salt2));
  await shadowMarket.connect(account3).submitSealedBid(1, computeCommitment(amount3, true, salt3));
  check("3 bids submitted", (await shadowMarket.getBidderCount(1)) === 3n);

  // Advance time past expiry
  console.log("\n4. Advancing time past expiry...");
  await hre.ethers.provider.send("evm_increaseTime", [3700]);
  await hre.ethers.provider.send("evm_mine", []);

  // Set RESOLVING
  console.log("\n5. Setting RESOLVING status...");
  await shadowMarket.setResolvingStatus(1);
  const market = await shadowMarket.getMarket(1);
  check("Market status is RESOLVING", market.status === 1);

  // Reveal all bids
  console.log("\n6. Revealing bids...");
  await shadowMarket.connect(account1).revealBid(1, amount1, true, salt1);
  await shadowMarket.connect(account2).revealBid(1, amount2, false, salt2);
  await shadowMarket.connect(account3).revealBid(1, amount3, true, salt3);
  const m = await shadowMarket.getMarket(1);
  check("YES pool = 300 USDC", m.totalYesPool === amount1 + amount3);
  check("NO pool = 50 USDC", m.totalNoPool === amount2);

  // Settle: YES wins
  console.log("\n7. Settling market (YES wins)...");
  await shadowMarket.settleMarket(1, true, "AI oracle confirmed YES outcome");
  const settled = await shadowMarket.getMarket(1);
  check("Market is SETTLED", settled.status === 2);
  check("Outcome is YES", settled.outcome === true);

  // Claim winnings
  console.log("\n8. Claiming winnings...");
  const totalPool = amount1 + amount2 + amount3; // 350 USDC
  const fee = (totalPool * 200n) / 10000n;       // 7 USDC
  const distributable = totalPool - fee;          // 343 USDC
  const yesPool = amount1 + amount3;              // 300 USDC

  const expectedAccount1 = (amount1 * distributable) / yesPool;
  const expectedAccount3 = (amount3 * distributable) / yesPool;

  const bal1Before = await usdc.balanceOf(account1.address);
  const bal3Before = await usdc.balanceOf(account3.address);

  await shadowMarket.connect(account1).claimWinnings(1);
  await shadowMarket.connect(account3).claimWinnings(1);

  const bal1After = await usdc.balanceOf(account1.address);
  const bal3After = await usdc.balanceOf(account3.address);

  check(
    `account1 received ~${ethers.formatUnits(expectedAccount1, 6)} USDC`,
    bal1After - bal1Before === expectedAccount1
  );
  check(
    `account3 received ~${ethers.formatUnits(expectedAccount3, 6)} USDC`,
    bal3After - bal3Before === expectedAccount3
  );

  // account2 (NO side) should fail to claim
  console.log("\n9. Verifying NO-side cannot claim...");
  try {
    await shadowMarket.connect(account2).claimWinnings(1);
    check("account2 claim reverted", false);
  } catch {
    check("account2 claim correctly reverted", true);
  }

  // account1 double-claim should fail
  console.log("\n10. Verifying double claim prevention...");
  try {
    await shadowMarket.connect(account1).claimWinnings(1);
    check("Double claim reverted", false);
  } catch {
    check("Double claim correctly reverted", true);
  }

  // Summary
  console.log("\n" + "=".repeat(40));
  console.log(`E2E Test Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(40) + "\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
