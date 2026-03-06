import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SHADOWMARKET_ABI = [
  "function createMarket(string calldata question, uint256 expiryTimestamp) external returns (uint256)",
];

const MOCK_USDC_ABI = [
  "function mint(address to, uint256 amount) external",
];

async function main() {
  const deploymentFile = path.join(__dirname, "..", "deployments", "sepolia.json");
  if (!fs.existsSync(deploymentFile)) {
    throw new Error("deployments/sepolia.json not found. Run deploy:sepolia first.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const shadowMarketAddress = deployment.shadowMarket;
  const mockUsdcAddress = deployment.mockUsdc;

  const rpc = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const shadowMarket = new ethers.Contract(shadowMarketAddress, SHADOWMARKET_ABI, wallet);

  // Create a fresh market
  const expiry = Math.floor(Date.now() / 1000) + 48 * 3600; // 48 hours
  console.log("\nCreating demo market...");
  const tx = await shadowMarket.createMarket(
    "Will ETH exceed $3,000 on March 1, 2026?",
    expiry
  );
  const receipt = await tx.wait();
  console.log(`Demo market created! Tx: ${receipt.hash}`);

  // Mint USDC to demo wallets
  const wallet1 = process.env.DEMO_WALLET_1;
  const wallet2 = process.env.DEMO_WALLET_2;

  if (mockUsdcAddress && (wallet1 || wallet2)) {
    const usdc = new ethers.Contract(mockUsdcAddress, MOCK_USDC_ABI, wallet);
    if (wallet1) {
      const mintTx = await usdc.mint(wallet1, ethers.parseUnits("1000", 6));
      await mintTx.wait();
      console.log(`Minted 1,000 USDC to ${wallet1}`);
    }
    if (wallet2) {
      const mintTx = await usdc.mint(wallet2, ethers.parseUnits("1000", 6));
      await mintTx.wait();
      console.log(`Minted 1,000 USDC to ${wallet2}`);
    }
  }

  console.log(`
============================================================
Demo Setup Complete!
============================================================

Contract:  ${shadowMarketAddress}
Network:   Sepolia (chainId 11155111)

Demo Instructions:
1. Visit the frontend and connect wallet
2. Navigate to the "Will ETH exceed $3,000 on March 1, 2026?" market
3. Submit a sealed bid (YES or NO) with your USDC amount
4. After expiry, reveal your bid to contribute to the pool
5. Wait for the Chainlink AI oracle to settle the market
6. Claim your winnings if you predicted correctly!

Useful commands:
  npm run demo:settle -- --market-id 1 --outcome yes
  npx ts-node scripts/interact.ts --command submit-bid --market-id 1 --commitment 0x...
============================================================
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
