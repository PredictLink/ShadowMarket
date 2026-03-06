import { ethers } from "ethers";
import * as hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  console.log(`\nDeploying ShadowMarket to ${network}...`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  let usdcAddress: string;

  // Step 1: Deploy MockUSDC on testnet only
  if (network !== "mainnet") {
    console.log("Deploying MockUSDC (testnet only)...");
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log(`MockUSDC deployed: ${usdcAddress}`);
  } else {
    usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    console.log(`Using real USDC: ${usdcAddress}`);
  }

  // Step 2: Deploy ShadowMarket
  console.log("\nDeploying ShadowMarket...");
  const ShadowMarket = await hre.ethers.getContractFactory("ShadowMarket");
  const shadowMarket = await ShadowMarket.deploy();
  await shadowMarket.waitForDeployment();
  const shadowMarketAddress = await shadowMarket.getAddress();
  console.log(`ShadowMarket deployed: ${shadowMarketAddress}`);

  // Step 3: Set authorised settler
  const donAddress = process.env.CRE_DON_ADDRESS;
  if (donAddress) {
    console.log(`\nSetting authorizedSettler to: ${donAddress}`);
    const tx = await shadowMarket.setAuthorizedSettler(donAddress);
    await tx.wait();
    console.log("authorizedSettler set.");
  } else {
    console.log("\nWARNING: CRE_DON_ADDRESS not set — authorizedSettler not configured.");
  }

  // Step 4: Create 3 sample markets
  const now = Math.floor(Date.now() / 1000);
  const markets = [
    {
      question: "Will ETH exceed $3,500 by March 1, 2026?",
      expiry: Math.floor(new Date("2026-03-01T00:00:00Z").getTime() / 1000),
    },
    {
      question: "Will the Chainlink Convergence Hackathon exceed 2,000 submissions?",
      expiry: Math.floor(new Date("2026-02-28T23:59:59Z").getTime() / 1000),
    },
    {
      question: "Will Bitcoin stay above $90,000 at end of February 2026?",
      expiry: Math.floor(new Date("2026-02-28T23:59:59Z").getTime() / 1000),
    },
  ];

  console.log("\nCreating sample markets...");
  for (const market of markets) {
    if (market.expiry <= now) {
      console.log(`  Skipping "${market.question}" — expiry is in the past.`);
      continue;
    }
    const tx = await shadowMarket.createMarket(market.question, market.expiry);
    await tx.wait();
    console.log(`  Created: "${market.question}"`);
  }

  // Step 5: Write deployment artifacts
  const deployment = {
    network,
    shadowMarket: shadowMarketAddress,
    mockUsdc: network !== "mainnet" ? usdcAddress : undefined,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to: ${deploymentFile}`);

  // Step 6: Write env files
  const creEnvPath = path.join(__dirname, "..", "cre-workflow", ".env");
  updateEnvFile(creEnvPath, "SHADOWMARKET_CONTRACT_ADDRESS", shadowMarketAddress);
  console.log(`Updated cre-workflow/.env: SHADOWMARKET_CONTRACT_ADDRESS=${shadowMarketAddress}`);

  const frontendEnvPath = path.join(__dirname, "..", "frontend", ".env.local");
  updateEnvFile(frontendEnvPath, "NEXT_PUBLIC_SHADOWMARKET_ADDRESS", shadowMarketAddress);
  console.log(`Updated frontend/.env.local: NEXT_PUBLIC_SHADOWMARKET_ADDRESS=${shadowMarketAddress}`);

  console.log("\n✅ Deployment complete!");
  console.log(`\nContract address: ${shadowMarketAddress}`);
}

function updateEnvFile(filePath: string, key: string, value: string) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  }
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(filePath, content.trim() + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
