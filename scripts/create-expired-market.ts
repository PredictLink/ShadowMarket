import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SHADOWMARKET_ABI = [
    "function createMarket(string calldata question, uint256 expiryTimestamp) external returns (uint256)",
    "function setResolvingStatus(uint256 marketId) external",
    "event MarketCreated(uint256 indexed marketId, string question, uint256 expiryTimestamp)"
];

async function main() {
    const deploymentFile = path.join(__dirname, "..", "deployments", "sepolia.json");
    if (!fs.existsSync(deploymentFile)) {
        throw new Error("deployments/sepolia.json not found. Run deploy:sepolia first.");
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
    const shadowMarketAddress = deployment.shadowMarket;

    const rpc = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error("PRIVATE_KEY not set");

    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);
    const shadowMarket = new ethers.Contract(shadowMarketAddress, SHADOWMARKET_ABI, wallet);

    // Create a market that expires in 10 seconds
    const expiry = Math.floor(Date.now() / 1000) + 10;
    console.log(`\nCreating short-lived market (expiring in 10s)...`);
    const tx = await shadowMarket.createMarket(
        "Did Argentina win the 2022 FIFA World Cup?",
        expiry
    );
    const receipt = await tx.wait();

    // get market id from event CreateMarket(uint256 indexed marketId, ...)
    let marketId = 1n;
    for (const log of receipt?.logs || []) {
        try {
            const parsed = shadowMarket.interface.parseLog(log as any);
            if (parsed?.name === "MarketCreated") {
                marketId = parsed.args[0];
                break;
            }
        } catch (e) { }
    }
    console.log(`Market created! Tx: ${receipt.hash}, Market ID: ${marketId}`);

    console.log("Waiting 15 seconds for expiry...");
    await new Promise(r => setTimeout(r, 15000));

    console.log("Setting resolving status to emit MarketExpired event...");
    const tx2 = await shadowMarket.setResolvingStatus(marketId);
    await tx2.wait();
    console.log(`Market #${marketId} set to RESOLVING. CRE workflow should now be able to trigger.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
