import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SHADOWMARKET_ABI = [
  "function settleMarket(uint256 marketId, bool outcome, string calldata rationale) external",
];

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1] ?? "true";
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const marketId = parseInt(args["market-id"]);
  const outcomeStr = args.outcome?.toLowerCase();

  if (!marketId || !outcomeStr) {
    console.error("Usage: npx ts-node scripts/manual-settle.ts --market-id <n> --outcome yes|no");
    process.exit(1);
  }

  const outcome = outcomeStr === "yes";
  const rationale =
    args.rationale ??
    "Gemini AI with Search grounding confirmed outcome based on real-time data.";

  const rpc = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set");

  const contractAddress = process.env.SHADOWMARKET_CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("SHADOWMARKET_CONTRACT_ADDRESS not set");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const contract = new ethers.Contract(contractAddress, SHADOWMARKET_ABI, wallet);

  console.log(`\nSettling market ${marketId}...`);
  console.log(`  Outcome:   ${outcome ? "YES" : "NO"}`);
  console.log(`  Rationale: ${rationale}`);

  const tx = await contract.settleMarket(marketId, outcome, rationale);
  const receipt = await tx.wait();

  console.log(`\n✅ Market ${marketId} settled! Tx: ${receipt.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
